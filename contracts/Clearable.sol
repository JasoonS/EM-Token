pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IClearable.sol";

/**
 * @title Clearable
 * @notice Clearable provides ERC20-like token contracts with a workflow to submit and process requests to perform transfers
 * that need to be cleared by the token issuing entity. These transfers are therefore processed in three steps: i) the user
 * (or someone delegated through an approval) requests the transfer; ii) the token issuer clears the transfer (offchain); and
 * iii) then the token issuer triggers the execution of the transfer, which moves the tokens from the sender to the receiver.
 */
contract Clearable is IClearable, Compliant {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private CLEARABLE_CONTRACT_NAME = "Clearable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _CLEARED_TRANSFER_IDS : string array with cleared transfer IDs
     * @dev _CLEARED_TRANSFER_REQUESTERS : address array with the addresses of the requesters of the cleared transfers
     * @dev _FROM_WALLETS : address array with the addresses from which the funds will be transferred
     * @dev _TO_WALLETS : address array with the addresses to which the funds will be transferred
     * @dev _CLEARED_TRANSFER_AMOUNTS : uint256 array with the cleared transfer amounts being requested
     * @dev _CLEARED_TRANSFER_STATUS_CODES : ClearedTransferRequestStatusCode array with the status code for the cleared
     * transfer requests
     * @dev _CLEARED_TRANSFER_IDS_INDEXES : mapping (address => mapping (string => uint256) storing the indexes for cleared 
     * transfer requests data (this is to allow equal IDs to be used by different requesters)
     * @dev _CLEARED_TRANSFER_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for
     * addresses to request payouts on behalf of wallets
     */
    bytes32 constant private _CLEARED_TRANSFER_IDS =          "_clearedTransferIds";
    bytes32 constant private _CLEARED_TRANSFER_REQUESTERS =   "_clearedTransferRequesters";
    bytes32 constant private _FROM_WALLETS =                  "_fromWallets";
    bytes32 constant private _TO_WALLETS =                    "_toWallets";
    bytes32 constant private _CLEARED_TRANSFER_AMOUNTS =      "_clearedTransferAmounts";
    bytes32 constant private _CLEARED_TRANSFER_STATUS_CODES = "_clearedTransferStatusCodes";
    bytes32 constant private _CLEARED_TRANSFER_IDS_INDEXES =  "_clearedTransferIdsIndexes";
    bytes32 constant private _CLEARED_TRANSFER_APPROVALS =    "_clearedTransferApprovals";

    // Modifiers

    modifier clearedTransferRequestExists(address requester, string memory transactionId) {
        require(_getClearedTransferIndex(requester, transactionId) > 0, "ClearedTransfer request does not exist");
        _;
    }

    modifier clearedTransferRequestIndexExists(uint256 index) {
        require(index > 0 && index <= _manyClearedTransferRequests(), "ClearedTransfer request does not exist");
        _;
    }

    modifier clearedTransferRequestDoesNotExist(address requester, string memory transactionId) {
        require(_getClearedTransferIndex(requester, transactionId) == 0, "ClearedTransfer request already exists");
        _;
    }
    
    modifier clearedTransferRequestJustCreated(address requester, string memory transactionId) {
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        require(_getClearedTransferStatus(index) == ClearedTransferRequestStatusCode.Requested, "ClearedTransfer request is already closed");
        _;
    }

    modifier clearedTransferRequestNotClosed(address requester, string memory transactionId) {
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        ClearedTransferRequestStatusCode status = _getClearedTransferStatus(index);
        require(
            status == ClearedTransferRequestStatusCode.Requested || status == ClearedTransferRequestStatusCode.InProcess,
            "ClearedTransfer request not in process"
        );
        _;
    }

    // External state-modifying functions

    /**
     * @notice This function allows wallet owners to approve other addresses to request cleared transfers on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param requester The address to be approved as potential issuer of cleared transfer requests
     */
    function approveToRequestClearedTransfer(address requester) external returns (bool) {
        address from = msg.sender;
        _check(_checkApproveToOrderClearedTransfer, from, requester);
        return _approveToRequestClearedTransfer(from, requester);
    }

    /**
     * @notice This function allows wallet owners to revoke cleared transfer request privileges from previously approved
     * addresses
     * @param requester The address to be revoked as potential issuer of cleared transfer requests
     */
    function revokeApprovalToRequestClearedTransfer(address requester) external returns (bool) {
        address from = msg.sender;
        return _revokeApprovalToRequestClearedTransfer(from, requester);
    }

    /**
     * @notice Method for a wallet owner to request cleared transfer from the tokenizer on his/her own behalf
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @param to The wallet to which the transfer is directed to
     * @param amount The amount to be transferred
     */
    function orderClearedTransfer(string calldata transactionId, address to, uint256 amount)
        external
        returns (bool)
    {
        address requester = msg.sender;
        address from = msg.sender;
        _check(_checkOrderClearedTransfer, from, to, amount);
        _createClearedTransferRequest(requester, transactionId, from, to, amount);
        return true;
    }

    /**
     * @notice Method to request cleared transfer on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The requester needs to be previously approved
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @param from The wallet the funds will be transferred from
     * @param to The wallet to which the transfer is directed to
     * @param amount The amount to be transferred
     */
    function orderClearedTransferFrom(
        string calldata transactionId,
        address from,
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        address requester = msg.sender;
        _check(_checkOrderClearedTransfer, from, to, amount);
        _createClearedTransferRequest(requester, transactionId, from, to, amount);
        return true;
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) cleared transfer request
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @dev Only the original requester can actually cancel an outstanding request
     */
    function cancelClearedTransferRequest(string calldata transactionId) external
        clearedTransferRequestNotClosed(msg.sender, transactionId)
        returns (bool)
    {
        address requester = msg.sender;
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        _setClearedTransferStatus(index, ClearedTransferRequestStatusCode.Cancelled);
        _finalizeHold(requester, transactionId, 0);
        emit ClearedTransferRequestCancelled(requester, transactionId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a cleared transfer request. It simply
     * sets the status to "InProcess", which then prevents the requester from being able to cancel the payout
     * request. This method can be called by the operator to "lock" the cleared transfer request while the internal
     * transfers etc are done by the bank (offchain). It is not required though to call this method before
     * actually executing or rejecting the request, since the operator can call the executeClearedTransferRequest or the
     * rejectClearedTransferRequest directly, if desired.
     * @param requester The requester of the cleared transfer request
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @dev Only an operator can do this
     * 
     */
    function processClearedTransferRequest(address requester, string calldata transactionId) external
        clearedTransferRequestJustCreated(requester, transactionId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        _setClearedTransferStatus(index, ClearedTransferRequestStatusCode.InProcess);
        emit ClearedTransferRequestInProcess(requester, transactionId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to honor a cleared transfer request. This will execute
     * the hold and thus transfer the tokens from from to to
     * @param requester The requester of the cleared transfer request
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function executeClearedTransferRequest(address requester, string calldata transactionId) external
        clearedTransferRequestNotClosed(requester, transactionId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        address from = _getFrom(index);
        address to = _getTo(index);
        uint256 amount = _getClearedTransferAmount(index);
        _decreaseBalance(from, amount);
        _increaseBalance(to, amount);
        _finalizeHold(requester, transactionId, 0);
        _setClearedTransferStatus(index, ClearedTransferRequestStatusCode.Executed);
        emit ClearedTransferRequestExecuted(requester, transactionId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to reject a cleared transfer request
     * @param requester The requester of the cleared transfer request
     * @param transactionId The ID of the cleared transfer request, which can then be used to index all the information about
     * the cleared transfer request (together with the address of the sender)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectClearedTransferRequest(address requester, string calldata transactionId, string calldata reason) external
        clearedTransferRequestNotClosed(requester, transactionId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        _finalizeHold(requester, transactionId, 0);
        _setClearedTransferStatus(index, ClearedTransferRequestStatusCode.Rejected);
        emit ClearedTransferRequestRejected(requester, transactionId, reason);
        return _setClearedTransferStatus(index, ClearedTransferRequestStatusCode.Rejected);
    }

    // External view functions
    
    /**
     * @notice View method to read existing allowances to request payout
     * @param toDebit The address of the wallet from which the funds will be taken
     * @param requester The address that can request cleared transfer on behalf of the wallet owner
     * @return Whether the address is approved or not to request cleared transfer on behalf of the wallet owner
     */
    function isApprovedToRequestClearedTransfer(address toDebit, address requester) external view returns (bool) {
        return _isApprovedToRequestClearedTransfer(toDebit, requester);
    }

    /**
     * @notice Function to retrieve all the information available for a particular cleared transfer request
     * @param requester The requester of the cleared transfer request
     * @param transactionId The ID of the cleared transfer request
     * @return from: The address of the wallet from which the funds will be transferred
     * @return to: The address of the wallet that will receive the funds
     * @return amount: the amount of funds requested
     * @return status: the current status of the cleared transfer request
     */
    function retrieveClearedTransferData(
        address requester,
        string calldata transactionId
    )
        external view
        returns (
            address from,
            address to,
            uint256 amount,
            ClearedTransferRequestStatusCode status
        )
    {
        uint256 index = _getClearedTransferIndex(requester, transactionId);
        from = _getFrom(index);
        to = _getTo(index);
        amount = _getClearedTransferAmount(index);
        status = _getClearedTransferStatus(index);
    }

    // Utility admin functions

    /**
     * @notice Function to retrieve all the information available for a particular cleared transfer request
     * @param index The index of the cleared transfer request
     * @return requester: address that issued the cleared transfer request
     * @return transactionId: the ID of the cleared transfer request (from this requester)
     * @return toDebit: The address of the wallet from which the funds will be taken
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the destination of the funds being requested
     * @return status: the current status of the cleared transfer request
     */
    function retrieveClearedTransferData(uint256 index)
        external view
        returns (
            address requester,
            string memory transactionId,
            address from,
            address to,
            uint256 amount,
            ClearedTransferRequestStatusCode status
        )
    {
        requester = _getClearedTransferRequester(index);
        transactionId = _gettransactionId(index);
        from = _getFrom(index);
        to = _getTo(index);
        amount = _getClearedTransferAmount(index);
        status = _getClearedTransferStatus(index);
    }

    /**
     * @notice This function returns the amount of cleared transfer requests outstanding and closed, since they are stored in an
     * array and the position in the array constitutes the ID of each cleared transfer request
     * @return The number of cleared transfer requests (both open and already closed)
     */
    function manyClearedTransferRequests() external view returns (uint256 many) {
        return _manyClearedTransferRequests();
    }

    // Private functions

    function _approveToRequestClearedTransfer(address wallet, address requester) private returns (bool) {
        emit ApprovalToRequestClearedTransfer(wallet, requester);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_APPROVALS, wallet, requester, true);
    }

    function _revokeApprovalToRequestClearedTransfer(address wallet, address requester) private returns (bool) {
        emit RevokeApprovalToRequestClearedTransfer(wallet, requester);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_APPROVALS, wallet, requester, false);
    }

    function _isApprovedToRequestClearedTransfer(address wallet, address requester) public view returns (bool){
        return _eternalStorage.getBoolFromDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_APPROVALS, wallet, requester);
    }

    function _manyClearedTransferRequests() private view returns (uint256 many) {
        return _eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_IDS, 0);
    }

    function _getClearedTransferRequester(uint256 index) private view clearedTransferRequestIndexExists(index) returns (address requester) {
        requester = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_REQUESTERS, index);
    }

    function _getClearedTransferIndex(
        address requester,
        string memory transactionId
    )
        private view
        clearedTransferRequestExists(requester, transactionId)
        returns (uint256 index)
    {
        index = _eternalStorage.getUintFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_IDS_INDEXES, requester, transactionId);
    }

    function _gettransactionId(uint256 index) private view clearedTransferRequestIndexExists(index) returns (string memory transactionId) {
        transactionId = _eternalStorage.getStringFromArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_IDS_INDEXES, index);
    }

    function _getFrom(uint256 index) private view clearedTransferRequestIndexExists(index) returns (address from) {
        from = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _FROM_WALLETS, index);
    }

    function _getTo(uint256 index) private view clearedTransferRequestIndexExists(index) returns (address to) {
        to = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _TO_WALLETS, index);
    }

    function _getClearedTransferAmount(uint256 index) private view clearedTransferRequestIndexExists(index) returns (uint256 amount) {
        amount = _eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_AMOUNTS, index);
    }

    function _getClearedTransferStatus(uint256 index) private view clearedTransferRequestIndexExists(index) returns (ClearedTransferRequestStatusCode status) {
        status = ClearedTransferRequestStatusCode(_eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_STATUS_CODES, index));
    }

    function _setClearedTransferStatus(uint256 index, ClearedTransferRequestStatusCode status) private clearedTransferRequestIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_STATUS_CODES, index, uint256(status));
    }

    function _createClearedTransferRequest(
        address requester,
        string memory transactionId,
        address from,
        address to,
        uint256 amount
    )
        private
        clearedTransferRequestDoesNotExist(requester, transactionId)
        returns (uint256 index)
    {
        require(requester == from || _isApprovedToRequestClearedTransfer(from, requester), "Not approved to order cleared transfers");
        require(amount >= _availableFunds(from), "Not enough funds to request cleared transfer");
        _createHold(requester, transactionId, from, to, address(0), amount, false, 0, 0); // No notary or status, as this is going to be managed by the methods
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_REQUESTERS, requester);
        _eternalStorage.pushStringToArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_IDS, transactionId);
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _FROM_WALLETS, from);
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _TO_WALLETS, to);
        _eternalStorage.pushUintToArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_AMOUNTS, amount);
        _eternalStorage.pushUintToArray(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_STATUS_CODES, uint256(ClearedTransferRequestStatusCode.Requested));
        index = _manyClearedTransferRequests();
        _eternalStorage.setUintInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARED_TRANSFER_IDS_INDEXES, requester, transactionId, index);
        emit ClearedTransferRequested(requester, transactionId, from, to, amount);
        return index;
    }

}
