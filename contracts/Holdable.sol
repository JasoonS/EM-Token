pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IHoldable.sol";

    /**
     * @title Holdable - generic holding mechanism for tokenized assets
     *
     * @dev This contract allows wallet owners to put tokens on hold. Holds are a sort of "projected payments", where
     * a payer and a payee are specified, along with an amount, a notary and an expiration. When the hold is established, the
     * relevant token balance from the payer (as specified by the amount) is put on hold, i.e. it cannot be transferred or used
     * in any manner until the hold is either executed or released. The hold can only be executed by the notary, which triggers
     * the transfer of the tokens from the payer to the payee. If the hold is not to be executed, it can be released either by
     * the notary at any time or by anyone after the expiration time has been reached.
     *
     * It is important to note that once the token has been put on hold, the execution of the hold will automatically result in
     * the tokens being transferred, even if the overdraft limits are reduced in the meanwhile and the final balances result
     * being over the authorized overdraft limit. Therefore hold execution is not revokable
     *
     * Holds can be specified to be "eternal", i.e. with no expiration. In this case, the hold cannot be released upon
     * expiration, and thus can only be released (or executed) either by the notary or by an operator
     */
contract Holdable is IHoldable, Compliant {

    // Data structures (in eternal storage)

    bytes32 constant private HOLDABLE_CONTRACT_NAME = "Holdable";

    /**
     * @dev Data structures:
     * @dev _HOLD_FROMS : mapping (address => mapping (string => address)) with the payers of the holds
     * @dev _HOLD_TOS : mapping (address => mapping (string => address)) with the payees of the holds
     * @dev _HOLD_NOTARIES : mapping (address => mapping (string => address)) with the notaries of the holds
     * @dev _HOLD_AMOUNTS : mapping (address => mapping (string => uint)) with the amounts of the holds
     * @dev _HOLD_EXPIRES : mapping (address => mapping (string => bool)) with the flags that mark whether
     * holds expire or not
     * @dev _HOLD_EXPIRATIONS : mapping (address => mapping (string => uint)) with the expirations of the holds
     * @dev _HOLD_STATUS_CODES : mapping (address => mapping (string => uint)) with the status codes of the holds
     * @dev _HOLDING_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to perform holds on behalf of wallets
     */
    bytes32 constant private _HOLD_FROMS =        "_holdFroms";
    bytes32 constant private _HOLD_TOS =          "_holdTos";
    bytes32 constant private _HOLD_NOTARIES =     "_holdNotaries";
    bytes32 constant private _HOLD_AMOUNTS =      "_holdAmounts";
    bytes32 constant private _HOLD_EXPIRES =      "_holdExpires";
    bytes32 constant private _HOLD_EXPIRATIONS =  "_holdExpirations";
    bytes32 constant private _HOLD_STATUS_CODES = "_holdStatusCodes";
    bytes32 constant private _HOLDING_APPROVALS = "_holdingApprovals";

    // Modifiers

    modifier holdExists(address holder, string memory operationId) {
        require (_doesHoldExist(holder, operationId), "Hold does not exist");
        _;
    }

    modifier holdDoesNotExist(address holder, string memory operationId) {
        require (!_doesHoldExist(holder, operationId), "Hold exists");
        _;
    }

    modifier holdActive(address holder, string memory operationId) {
        require (_getHoldStatus(holder, operationId) == HoldStatusCode.Ordered, "Hold not active");
        _;
    }

    // External state-modifying functions

    /**
     * @notice This function allows wallet owners to approve other addresses to perform holds on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param holder The address to be approved as potential issuer of holds
     */
    function approveToHold(address holder) external returns (bool)
    {
        _check(_canApproveToHold, msg.sender, holder);
        return _approveToHold(msg.sender, holder);
    }

    /**
     * @notice This function allows wallet owners to revoke holding privileges from previously approved addresses
     * @param holder The address to be revoked as potential holder of holds
     */
    function revokeApprovalToHold(address holder) external returns (bool)
    {
        return _revokeApprovalToHold(msg.sender, holder);
    }

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the payer, who is the sender of the transaction) in
     * favor of another wallet owner (the payee), and specifying a notary who will be responsable to either execute or
     * release the transfer
     * @param operationId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same operationId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param to The address of the payee, to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     */
    function hold(
        string calldata operationId,
        address to,
        address notary,
        uint256 amount,
        bool expires,
        uint256 timeToExpiration
    )
        external
        returns (bool)
    {
        address holder = msg.sender;
        address from = msg.sender;
        _check(_canHold, from, to, notary, amount);
        return _createHold(holder, operationId, from, to, notary, amount, expires, timeToExpiration);
    }

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the payer, entered in the "from" address) in favor of
     * another wallet owner (the payee, entered in the "to" address), and specifying a notary who will be responsable to either
     * execute or release the transfer
     * @param operationId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same operationId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param from The address of the payer, from which the tokens are to be taken (if the hold is executed)
     * @param to The address of the payee, to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     */
    function holdFrom(
        string calldata operationId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool expires,
        uint256 timeToExpiration
    )
        external
        returns (bool)
    {
        address holder = msg.sender;
        require(from == msg.sender || _isApprovedToHold(from, msg.sender), "Requester is not approved to hold");
        _check(_canHold, from, to, notary, amount);
        return _createHold(holder, operationId, from, to, notary, amount, expires, timeToExpiration);
    }

    /**
     * @notice Function to release a hold (if at all possible)
     * @param holder The address of the original sender of the hold
     * @param operationId The ID of the hold in question
     * @dev holder and operationId are needed to index a hold. This is provided so different holders can use the same operationId,
     * as holding is a competitive resource
     */
    function releaseHold(
        address holder,
        string calldata operationId
    )
        external
        holdActive(holder, operationId)
        returns (bool)
    {
        address from = _getHoldFrom(holder, operationId);
        address to = _getHoldTo(holder, operationId);
        address notary = _getHoldNotary(holder, operationId);
        bool expires = _getHoldExpires(holder, operationId);
        uint256 expiration = _getHoldExpiration(holder, operationId);
        HoldStatusCode finalStatus;
        if(_hasRole(msg.sender, OPERATOR_ROLE)) {
            finalStatus = HoldStatusCode.ReleasedByOperator;
        } else if(notary == msg.sender) {
            finalStatus = HoldStatusCode.ReleasedByNotary;
        } else if(to == msg.sender) {
            finalStatus = HoldStatusCode.ReleasedByPayee;
        } else if(expires && block.timestamp >= expiration && (msg.sender == holder || msg.sender == from)) {
            finalStatus = HoldStatusCode.ReleasedOnExpiration;
        } else {
            require(false, "Hold cannot be released");
        }
        emit HoldReleased(holder, operationId, finalStatus);
        return _finalizeHold(msg.sender, operationId, finalStatus);
    }
    
    /**
     * @notice Function to execute a hold (if at all possible)
     * @param holder The address of the original sender of the hold
     * @param operationId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different holders can use the same operationId,
     * as holding is a competitive resource
     * @dev Holds that are expired can still be executed by the notary or the operator (as well as released by anyone)
     */
    function executeHold(
        address holder,
        string calldata operationId
    )
        external
        holdActive(holder, operationId)
        returns (bool)
    {
        address from = _getHoldFrom(holder, operationId);
        address to = _getHoldTo(holder, operationId);
        address notary = _getHoldNotary(holder, operationId);
        uint256 amount = _getHoldAmount(holder, operationId);
        bool expires = _getHoldExpires(holder, operationId);
        uint256 expiration = _getHoldExpiration(holder, operationId);
        HoldStatusCode finalStatus;
        require(!expires || block.timestamp < expiration, "Hold is expired and cannot be released");
        if(_hasRole(msg.sender, OPERATOR_ROLE)) {
            finalStatus = HoldStatusCode.ExecutedByOperator;
        } else if(notary == msg.sender) {
            finalStatus = HoldStatusCode.ExecutedByNotary;
        } else {
            require(false, "Not authorized to execute");
        }
        _removeFunds(from, amount);
        _addFunds(to, amount);
        emit HoldExecuted(holder, operationId, finalStatus);
        return _finalizeHold(holder, operationId, finalStatus);
    }

    /**
     * @notice Function to renew a hold (added time from now)
     * @param operationId The ID of the hold in question
     * @dev Only the holder can renew a hold
     * @dev Non closed holds can be renewed, including holds that are already expired
     */
    function renewHold(string calldata operationId, uint256 timeToExpirationFromNow) external holdActive(msg.sender, operationId) returns (bool) {
        return _setHoldExpiration(msg.sender, operationId, block.timestamp.add(timeToExpirationFromNow));
    }

    // External view functions

    /**
     * @notice Returns whether an address is approved to submit holds on behalf of other wallets
     * @param wallet The wallet on which the holds would be performed (i.e. the payer)
     * @param holder The address approved to hold on behalf of the wallet owner
     * @return Whether the holder is approved or not to hold on behalf of the wallet owner
     */
    function isApprovedToHold(address wallet, address holder) external view returns (bool) {
        return _isApprovedToHold(wallet, holder);
    }

    /**
     * @notice Returns whether the clearable transfer exists
     * @param holder The holder of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     */
    function doesHoldExist(address holder, string calldata operationId) external view returns (bool) {
        return _doesHoldExist(holder, operationId);
    } 
    /**
     * @notice Function to retrieve all the information available for a particular hold
     * @param holder The address of the original sender of the hold
     * @param operationId The ID of the hold in question
     * @return from: the wallet from which the tokens will be taken if the hold is executed
     * @return to: the wallet to which the tokens will be transferred if the hold is executed
     * @return notary: the address that will be executing or releasing the hold
     * @return amount: the amount that will be transferred
     * @return expires: a flag indicating whether the hold expires or not
     * @return expiration: (only relevant in case expires==true) the absolute time (block.timestamp) by which the hold will
     * expire (after that time the hold can be released by anyone)
     * @return status: the current status of the hold
     * @dev holder and operationId are needed to index a hold. This is provided so different holders can use the same operationId,
     * as holding is a competitive resource
     */
    function retrieveHoldData(address holder, string calldata operationId)
        external view
        returns (
            address from,
            address to,
            address notary,
            uint256 amount,
            bool expires,
            uint256 expiration,
            HoldStatusCode status
        )
    {
        from = _getHoldFrom(holder, operationId);
        to = _getHoldTo(holder, operationId);
        notary = _getHoldNotary(holder, operationId);
        amount = _getHoldAmount(holder, operationId);
        expires = _getHoldExpires(holder, operationId);
        expiration = _getHoldExpiration(holder, operationId);
        status = HoldStatusCode(_getHoldStatus(holder, operationId));
    }

    /**
     * @dev Function to know how much is locked on hold from a particular wallet
     * @param wallet The address of the wallet
     * @return The balance on hold for a particular wallet
     */
    function balanceOnHold(address wallet) external view returns (uint256) {
        return _balanceOnHold(wallet);
    }

    /**
     * @dev Function to know how much is locked on hold for all accounts
     * @return The total amount in balances on hold from all wallets
     */
    function totalSupplyOnHold() external view returns (uint256) {
        return _totalSupplyOnHold();
    }

    // Internal functions

    function _createHold(
        address holder,
        string  memory operationId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 timeToExpiration
    )
        internal
        holdDoesNotExist(holder, operationId)
        returns (bool)
    {
        require(amount >= _availableFunds(from), "Not enough funds to hold");
        uint256 expiration = block.timestamp.add(timeToExpiration);
        _addBalanceOnHold(from, amount);
        emit HoldCreated(holder, operationId, from, to, notary, amount, expires, expiration);
        return
            _setHoldFrom(holder, operationId, from) &&
            _setHoldFrom(holder, operationId, to) &&
            _setHoldNotary(holder, operationId, notary) &&
            _setHoldAmount(holder, operationId, amount) &&
            _setHoldExpires(holder, operationId, expires) &&
            _setHoldExpiration(holder, operationId, expiration);
    }

    function _finalizeHold(
        address holder,
        string memory operationId,
        HoldStatusCode status
    )
        internal
        holdActive(holder, operationId)
        returns (bool)
    {
        address from = _getHoldFrom(holder, operationId);
        uint256 amount = _getHoldAmount(holder, operationId);
        return
            _substractBalanceOnHold(from, amount) &&
            _setHoldStatus(holder, operationId, status);
    }

    function _doesHoldExist(address orderer, string memory operationId) internal view returns (bool) {
        return _getHoldStatus(orderer, operationId) != HoldStatusCode.Nonexistent;
    }

    // Private functions wrapping access to eternal storage

    function _getHoldFrom(address holder, string memory operationId) internal view returns (address from) {
        from = whichEternalStorage().getAddressFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_FROMS, holder, operationId);
    }

    function _setHoldFrom(address holder, string memory operationId, address from) internal returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_FROMS, holder, operationId, from);
    }

    function _getHoldTo(address holder, string memory operationId) internal view returns (address to) {
        to = whichEternalStorage().getAddressFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_TOS, holder, operationId);
    }

    function _setHoldTo(address holder, string memory operationId, address to) internal returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_TOS, holder, operationId, to);
    }

    function _getHoldNotary(address holder, string memory operationId) internal view returns (address notary) {
        notary = whichEternalStorage().getAddressFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_NOTARIES, holder, operationId);
    }

    function _setHoldNotary(address holder, string memory operationId, address notary) internal returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_NOTARIES, holder, operationId, notary);
    }

    function _getHoldAmount(address holder, string memory operationId) internal view returns (uint256 amount) {
        amount = whichEternalStorage().getUintFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_AMOUNTS, holder, operationId);
    }

    function _setHoldAmount(address holder, string memory operationId, uint256 amount) internal returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_AMOUNTS, holder, operationId, amount);
    }

    function _getHoldExpires(address holder, string memory operationId) internal view returns (bool expires) {
        expires = whichEternalStorage().getBoolFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_EXPIRES, holder, operationId);
    }

    function _setHoldExpires(address holder, string memory operationId, bool expires) internal returns (bool) {
        return whichEternalStorage().setBoolInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_EXPIRES, holder, operationId, expires);
    }

    function _getHoldExpiration(address holder, string memory operationId) internal view returns (uint256 expiration) {
        expiration = whichEternalStorage().getUintFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_EXPIRATIONS, holder, operationId);
    }

    function _setHoldExpiration(address holder, string memory operationId, uint256 expiration) internal returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_EXPIRATIONS, holder, operationId, expiration);
    }

    function _getHoldStatus(address holder, string memory operationId) internal view returns (HoldStatusCode status) {
        return HoldStatusCode(whichEternalStorage().getUintFromDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_STATUS_CODES, holder, operationId));
    }

    function _setHoldStatus(address holder, string memory operationId, HoldStatusCode status) internal returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(HOLDABLE_CONTRACT_NAME, _HOLD_STATUS_CODES, holder, operationId, uint256(status));
    }

    function _approveToHold(address wallet, address holder) private returns (bool) {
        emit ApprovalToHold(wallet, holder);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder, true);
    }

    function _revokeApprovalToHold(address wallet, address holder) private returns (bool) {
        emit RevokeApprovalToHold(wallet, holder);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder, false);
    }

    function _isApprovedToHold(address wallet, address holder) private view returns (bool){
        return whichEternalStorage().getBoolFromDoubleAddressAddressMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder);
    }

}

