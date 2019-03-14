pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IHoldable.sol";

contract Holdable is IHoldable, Compliant {

    // Data structures (in eternal storage)

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
     *
     * (ToDo: consider allowing the payee to also be able to release the hold, as a way to reject it)
     */
    bytes32 constant private HOLDABLE_CONTRACT_NAME = "Holdable";

    /**
     * @dev Data structures:
     * @dev _HOLDING_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to perform holds on behalf of wallets
     */
    bytes32 constant private _HOLDING_APPROVALS = "_holdingApprovals";

    // Modifiers

    modifier holdActive(address issuer, string memory transactionId) {
        require (_holdStatus(issuer, transactionId) == uint256(HoldStatusCode.Created), "Hold not active");
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
        _check(_checkApproveToHold, msg.sender, holder);
        return _setHoldingApproval(msg.sender, holder, true);
    }

    /**
     * @notice This function allows wallet owners to revoke holding privileges from previously approved addresses
     * @param holder The address to be revoked as potential issuer of holds
     */
    function revokeApprovalToHold(address holder) external returns (bool)
    {
        return _setHoldingApproval(msg.sender, holder, false);
    }

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the sender) in favor of another wallet owner (the
     * "payee"), and specifying a notary who will be responsable to either execute or release the transfer
     * @param transactionId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same transactionId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param payee The address to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     * @return The index in the array where the hold is actually created and stored (this is an unique identifier
     * throughout the whole contract)
     */
    function hold(
        string  calldata transactionId,
        address payee,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 timeToExpiration
    )
        external
        returns (uint256 index)
    {
        address requester = msg.sender;
        address payer = msg.sender;
        _check(_checkHold, payer, payee, notary, amount);
        return _hold(requester, transactionId, payer, payee, notary, amount, expires, timeToExpiration);
    }

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the "payer") in favor of another wallet owner (the
     * "payee"), and specifying a notary who will be responsable to either execute or release the transfer
     * @param transactionId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same transactionId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param payer The address from which the tokens are to be taken (if the hold is executed)
     * @param payee The address to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     * @return The index in the array where the hold is actually created and stored (this is an unique identifier
     * throughout the whole contract)
     */
    function holdFrom(
        string  calldata transactionId,
        address payer,
        address payee,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 timeToExpiration
    )
        external
        returns (uint256 index)
    {
        address requester = msg.sender;
        _check(_checkHold, payer, payee, notary, amount);
        return  _hold(requester, transactionId, payer, payee, notary, amount, expires, timeToExpiration);
    }

    /**
     * @notice Function to release a hold (if at all possible)
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     */
    function releaseHold(address issuer, string calldata transactionId)
        external
        holdActive(issuer, transactionId)
        returns (bool)
    {
        address notary = _holdNotary(issuer, transactionId);
        bool expires = _holdExpires(issuer, transactionId);
        uint256 expiration = _holdExpiration(issuer, transactionId);
        HoldStatusCode finalStatus;
        if(hasRole(msg.sender, OPERATOR_ROLE)) {
            finalStatus = HoldStatusCode.ReleasedByOperator;
        } else if(notary == msg.sender) {
            finalStatus = HoldStatusCode.ReleasedByNotary;
        } else if(expires && block.timestamp >= expiration) {
            finalStatus = HoldStatusCode.ReleasedDueToExpiration;
        } else {
            require(false, "Hold cannot be released");
        }
        emit HoldReleased(issuer, transactionId, finalStatus);
        return _finalizeHold(msg.sender, transactionId, uint256(finalStatus));
    }
    
    /**
     * @notice Function to execute a hold (if at all possible)
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     * @dev Holds that are expired can still be executed by the notary or the operator (as well as released by anyone)
     */
    function executeHold(address issuer, string calldata transactionId)
        external
        holdActive(issuer, transactionId)
        returns (bool)
    {
        address payer = _holdPayer(issuer, transactionId);
        address payee = _holdPayee(issuer, transactionId);
        address notary = _holdNotary(issuer, transactionId);
        uint256 amount = _holdAmount(issuer, transactionId);
        HoldStatusCode finalStatus;
        if(hasRole(msg.sender, OPERATOR_ROLE)) {
            finalStatus = HoldStatusCode.ExecutedByOperator;
        } else if(notary == msg.sender) {
            finalStatus = HoldStatusCode.ExecutedByNotary;
        } else {
            require(false, "Not authorized to execute");
        }
        _removeFunds(payer, amount);
        _addFunds(payee, amount);
        emit HoldExecuted(issuer, transactionId, finalStatus);
        return _finalizeHold(issuer, transactionId, uint256(finalStatus));
    }
     /**
     * @notice Function to renew a hold (added time from now)
     * @param transactionId The ID of the hold in question
     * @dev Only the issuer can renew a hold
     * @dev Non closed holds can be renewed, including holds that are already expired
     */
    function renewHold(string calldata transactionId, uint256 timeToExpirationFromNow) external holdActive(msg.sender, transactionId) returns (bool) {
        _changeTimeToHold(msg.sender, transactionId, timeToExpirationFromNow);
    }


    // External view functions

    /**
     * @notice Returns whether an address is approved to submit holds on behalf of other wallets
     * @param wallet The wallet on which the holds would be performed (i.e. the "payer")
     * @param holder The address approved to hold on behalf of the wallet owner
     * @return Whether the holder is approved or not to hold on behalf of the wallet owner
     */
    function isApprovedToHold(address wallet, address holder) external view returns (bool) {
        return _getHoldingApproval(wallet, holder);
    }

    /**
     * @notice Function to retrieve all the information available for a particular hold
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @return index: the index of the hold (an unique identifier)
     * @return payer: the wallet from which the tokens will be taken if the hold is executed
     * @return payee: the wallet to which the tokens will be transferred if the hold is executed
     * @return notary: the address that will be executing or releasing the hold
     * @return amount: the amount that will be transferred
     * @return expires: a flag indicating whether the hold expires or not
     * @return expiration: (only relevant in case expires==true) the absolute time (block.timestamp) by which the hold will
     * expire (after that time the hold can be released by anyone)
     * @return status: the current status of the hold
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     */
    function retrieveHoldData(address issuer, string calldata transactionId)
        external view
        returns (
            uint256 index,
            address payer,
            address payee,
            address notary,
            uint256 amount,
            bool expires,
            uint256 expiration,
            HoldStatusCode status
        )
    {
        index = _holdIndex(issuer, transactionId);
        payer = _holdPayer(issuer, transactionId);
        payee = _holdPayee(issuer, transactionId);
        notary = _holdNotary(issuer, transactionId);
        amount = _holdAmount(issuer, transactionId);
        expires = _holdExpires(issuer, transactionId);
        expiration = _holdExpiration(issuer, transactionId);
        status = HoldStatusCode(_holdStatus(issuer, transactionId));
    }

    /**
     * @dev Function to know how much is locked on hold from a particular wallet
     * @param account The address of the account
     * @return The balance on hold for a particular account
     */
    function balanceOnHold(address account) external view returns (uint256) {
        return _balanceOnHold(account);
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
    function holdsCount() external view returns (uint256) {
        return _manyHolds();
    }

    /**
     * @notice Function to retrieve the ID information of a hold from the index
     * @dev This is mainly used to be able to iterate the list of existing holds
     * @param index the index of the hold (an unique identifier)
     * @return issuer: The address of the original sender of the hold
     * @return transactionId: The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     */
    function holdID(uint256 index) external view returns (address issuer, string memory transactionId) {
        return _getHoldId(index);
    }

    // Private functions

    function _getHoldingApproval(address wallet, address holder) private view returns (bool) {
        return getBoolFromDoubleMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder);
    }

    function _setHoldingApproval(address wallet, address holder, bool value) private returns (bool) {
        return setBoolInDoubleMapping(HOLDABLE_CONTRACT_NAME, _HOLDING_APPROVALS, wallet, holder, value);
    }

    function _hold(
        address requester,
        string  memory transactionId,
        address payer,
        address payee,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 timeToExpiration
    )
        private
        returns (uint256 index)
    {
        require(payer == msg.sender || _getHoldingApproval(payer, msg.sender), "Requester is not approved to hold");
        require(amount >= _availableFunds(payer), "Not enough funds to hold");
        uint256 expiration = block.timestamp.add(timeToExpiration);
        emit HoldCreated(requester, transactionId, payer, payee, notary, amount, expires, expiration, index);
        return _createHold(requester, transactionId, payer, payee, notary, amount, expires, expiration, uint256(HoldStatusCode.Created));
    }

}

