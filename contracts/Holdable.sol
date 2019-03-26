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
     * @dev _HOLDING_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to perform holds on behalf of wallets
     */
    bytes32 constant private _HOLDING_APPROVALS = "_holdingApprovals";

    // Modifiers

    modifier holdActive(address holder, string memory operationId) {
        require (_holdStatus(holder, operationId) == uint256(HoldStatusCode.Ordered), "Hold not active");
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
        return _setHoldingApproval(msg.sender, holder, true);
    }

    /**
     * @notice This function allows wallet owners to revoke holding privileges from previously approved addresses
     * @param holder The address to be revoked as potential holder of holds
     */
    function revokeApprovalToHold(address holder) external returns (bool)
    {
        return _setHoldingApproval(msg.sender, holder, false);
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
        _hold(holder, operationId, from, to, notary, amount, expires, timeToExpiration);
        return true;
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
        _check(_canHold, from, to, notary, amount);
        _hold(holder, operationId, from, to, notary, amount, expires, timeToExpiration);
        return true;
    }

    /**
     * @notice Function to release a hold (if at all possible)
     * @param holder The address of the original sender of the hold
     * @param operationId The ID of the hold in question
     * @dev holder and operationId are needed to index a hold. This is provided so different holders can use the same operationId,
     * as holding is a competitive resource
     */
    function releaseHold(address holder, string calldata operationId) external holdActive(holder, operationId) returns (bool)
    {
        address from = _holdFrom(holder, operationId);
        address to = _holdTo(holder, operationId);
        address notary = _holdNotary(holder, operationId);
        bool expires = _holdExpires(holder, operationId);
        uint256 expiration = _holdExpiration(holder, operationId);
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
        return _finalizeHold(msg.sender, operationId, uint256(finalStatus));
    }
    
    /**
     * @notice Function to execute a hold (if at all possible)
     * @param holder The address of the original sender of the hold
     * @param operationId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different holders can use the same operationId,
     * as holding is a competitive resource
     * @dev Holds that are expired can still be executed by the notary or the operator (as well as released by anyone)
     */
    function executeHold(address holder, string calldata operationId) external holdActive(holder, operationId) returns (bool)
    {
        address from = _holdFrom(holder, operationId);
        address to = _holdTo(holder, operationId);
        address notary = _holdNotary(holder, operationId);
        uint256 amount = _holdAmount(holder, operationId);
        bool expires = _holdExpires(holder, operationId);
        uint256 expiration = _holdExpiration(holder, operationId);
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
        return _finalizeHold(holder, operationId, uint256(finalStatus));
    }

    /**
     * @notice Function to renew a hold (added time from now)
     * @param operationId The ID of the hold in question
     * @dev Only the holder can renew a hold
     * @dev Non closed holds can be renewed, including holds that are already expired
     */
    function renewHold(string calldata operationId, uint256 timeToExpirationFromNow) external holdActive(msg.sender, operationId) returns (bool) {
        _changeTimeToHold(msg.sender, operationId, timeToExpirationFromNow);
    }


    // External view functions

    /**
     * @notice Returns whether an address is approved to submit holds on behalf of other wallets
     * @param wallet The wallet on which the holds would be performed (i.e. the payer)
     * @param holder The address approved to hold on behalf of the wallet owner
     * @return Whether the holder is approved or not to hold on behalf of the wallet owner
     */
    function isApprovedToHold(address wallet, address holder) external view returns (bool) {
        return _getHoldingApproval(wallet, holder);
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
        from = _holdFrom(holder, operationId);
        to = _holdTo(holder, operationId);
        notary = _holdNotary(holder, operationId);
        amount = _holdAmount(holder, operationId);
        expires = _holdExpires(holder, operationId);
        expiration = _holdExpiration(holder, operationId);
        status = HoldStatusCode(_holdStatus(holder, operationId));
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

    // Utility admin functions

    /**
     * @dev Function to know how many holds are there (open and closed)
     * @return The total holds count
     */
    function manyHolds() external view returns (uint256) {
        return _manyHolds();
    }

    /**
     * @notice Function to retrieve all the information available for a particular hold
     * @param  index The position in the holds array
     * @return holder: The address of the original sender of the hold
     * @return operationId: The ID of the hold in question
     * @return from: The address of the payer, from which the tokens are to be taken (if the hold is executed)
     * @return to: The address of the payee, to which the tokens are to be paid (if the hold is executed)
     * @return notary: the address that will be executing or releasing the hold
     * @return amount: the amount that will be transferred
     * @return expires: a flag indicating whether the hold expires or not
     * @return expiration: (only relevant in case expires==true) the absolute time (block.timestamp) by which the hold will
     * expire (after that time the hold can be released by anyone)
     * @return status: the current status of the hold
     * @dev holder and operationId are needed to index a hold. This is provided so different issuers can use the same operationId,
     * as holding is a competitive resource
     */
    function retrieveHoldData(uint256 index)
        external view
        returns (
            address holder,
            string memory operationId,
            address from,
            address to,
            address notary,
            uint256 amount,
            bool expires,
            uint256 expiration,
            HoldStatusCode status
        )
    {
        (holder, operationId) = _getHoldId(index);
        from = _holdFrom(holder, operationId);
        to = _holdTo(holder, operationId);
        notary = _holdNotary(holder, operationId);
        amount = _holdAmount(holder, operationId);
        expires = _holdExpires(holder, operationId);
        expiration = _holdExpiration(holder, operationId);
        status = HoldStatusCode(_holdStatus(holder, operationId));
    }

    // Private functions

    function _getHoldingApproval(address wallet, address holder) private view returns (bool) {
        return _eternalStorage.getBoolFromDoubleAddressAddressMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder);
    }

    function _setHoldingApproval(address wallet, address holder, bool value) private returns (bool) {
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder, value);
    }

    function _hold(
        address requester,
        string  memory operationId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 timeToExpiration
    )
        private
        returns (uint256 index)
    {
        require(from == msg.sender || _getHoldingApproval(from, msg.sender), "Requester is not approved to hold");
        require(amount >= _availableFunds(from), "Not enough funds to hold");
        uint256 expiration = block.timestamp.add(timeToExpiration);
        emit HoldCreated(requester, operationId, from, to, notary, amount, expires, expiration);
        index = _createHold(requester, operationId, from, to, notary, amount, expires, expiration, uint256(HoldStatusCode.Ordered));
    }

}

