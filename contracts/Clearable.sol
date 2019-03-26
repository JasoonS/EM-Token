pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IClearable.sol";

/**
 * @title Clearable
 * @notice Clearable provides ERC20-like token contracts with a workflow to submit and process requests to perform transfers
 * that need to be clearable by the token issuing entity. These transfers are therefore processed in three steps: i) the user
 * (or someone delegated through an approval) requests the transfer; ii) the token issuer clears the transfer (offchain); and
 * iii) then the token issuer triggers the execution of the transfer, which moves the tokens from the sender to the receiver.
 */
contract Clearable is IClearable, Compliant {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private CLEARABLE_CONTRACT_NAME = "Clearable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _CLEARABLE_TRANSFER_IDS : string array with clearable transfer IDs
     * @dev _CLEARABLE_TRANSFER_ORDERERS : address array with the addresses of the orderers of the clearable transfers
     * @dev _FROM_WALLETS : address array with the addresses from which the funds will be transferred
     * @dev _TO_WALLETS : address array with the addresses to which the funds will be transferred
     * @dev _CLEARABLE_TRANSFER_AMOUNTS : uint256 array with the clearable transfer amounts being ordered
     * @dev _CLEARABLE_TRANSFER_STATUS_CODES : ClearableTransferStatusCode array with the status code for the clearable
     * transfer
     * @dev _CLEARABLE_TRANSFER_IDS_INDEXES : mapping (address => mapping (string => uint256) storing the indexes for clearable 
     * transfers  data (this is to allow equal IDs to be used by different orderers)
     * @dev _CLEARABLE_TRANSFER_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for
     * addresses to order clearable transfers on behalf of wallets
     */
    bytes32 constant private _CLEARABLE_TRANSFER_IDS =          "_clearableTransferIds";
    bytes32 constant private _CLEARABLE_TRANSFER_ORDERERS =   "_clearableTransferOrderers";
    bytes32 constant private _FROM_WALLETS =                  "_fromWallets";
    bytes32 constant private _TO_WALLETS =                    "_toWallets";
    bytes32 constant private _CLEARABLE_TRANSFER_AMOUNTS =      "_clearableTransferAmounts";
    bytes32 constant private _CLEARABLE_TRANSFER_STATUS_CODES = "_clearableTransferStatusCodes";
    bytes32 constant private _CLEARABLE_TRANSFER_IDS_INDEXES =  "_clearableTransferIdsIndexes";
    bytes32 constant private _CLEARABLE_TRANSFER_APPROVALS =    "_clearableTransferApprovals";

    // Modifiers

    modifier clearableTransferExists(address orderer, string memory operationId) {
        require(_getClearableTransferIndex(orderer, operationId) > 0, "ClearableTransfer does not exist");
        _;
    }

    modifier clearableTransferIndexExists(uint256 index) {
        require(index > 0 && index <= _manyClearableTransfers(), "ClearableTransfer does not exist");
        _;
    }

    modifier clearableTransferDoesNotExist(address orderer, string memory operationId) {
        require(_getClearableTransferIndex(orderer, operationId) == 0, "ClearableTransfer already exists");
        _;
    }
    
    modifier clearableTransferJustCreated(address orderer, string memory operationId) {
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        require(_getClearableTransferStatus(index) == ClearableTransferStatusCode.Ordered, "ClearableTransfer is already closed");
        _;
    }

    modifier clearableTransferNotClosed(address orderer, string memory operationId) {
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        ClearableTransferStatusCode status = _getClearableTransferStatus(index);
        require(
            status == ClearableTransferStatusCode.Ordered || status == ClearableTransferStatusCode.InProcess,
            "ClearableTransfer not in process"
        );
        _;
    }

    // External state-modifying functions

    /**
     * @notice This function allows wallet owners to approve other addresses to order clearable transfers on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential orderer of clearable transfers
     */
    function approveToOrderClearableTransfer(address orderer) external returns (bool) {
        address from = msg.sender;
        _check(_canApproveToOrderClearableTransfer, from, orderer);
        return _approveToRequestClearableTransfer(from, orderer);
    }

    /**
     * @notice This function allows wallet owners to revoke clearable transfer ordering privileges from previously approved
     * addresses
     * @param orderer The address to be revoked as potential orderer of clearable transfers
     */
    function revokeApprovalToOrderClearableTransfer(address orderer) external returns (bool) {
        address from = msg.sender;
        return _revokeApprovalToRequestClearableTransfer(from, orderer);
    }

    /**
     * @notice Method for a wallet owner to order a clearable transfer from the tokenizer on his/her own behalf
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @param to The wallet to which the transfer is directed to
     * @param amount The amount to be transferred
     */
    function orderClearableTransfer(
        string calldata operationId,
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        address orderer = msg.sender;
        address from = msg.sender;
        _check(_canOrderClearableTransfer, from, to, amount);
        _createClearableTransferRequest(orderer, operationId, from, to, amount);
        return true;
    }

    /**
     * @notice Method to order a clearable transfer on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The orderer needs to be previously approved
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @param from The wallet the funds will be transferred from
     * @param to The wallet to which the transfer is directed to
     * @param amount The amount to be transferred
     */
    function orderClearableTransferFrom(
        string calldata operationId,
        address from,
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        address orderer = msg.sender;
        _check(_canOrderClearableTransfer, from, to, amount);
        _createClearableTransferRequest(orderer, operationId, from, to, amount);
        return true;
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only the original orderer can actually cancel an outstanding clerable transfer
     */
    function cancelClearableTransfer(string calldata operationId) external
        clearableTransferNotClosed(msg.sender, operationId)
        returns (bool)
    {
        address orderer = msg.sender;
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        _setClearableTransferStatus(index, ClearableTransferStatusCode.Cancelled);
        _finalizeHold(orderer, operationId, 0);
        emit ClearableTransferCancelled(orderer, operationId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a clearable transfer. It simply
     * sets the status to "InProcess", which then prevents the orderer from being able to cancel the transfer. This method
     * can be called by the operator to "lock" the clearable transfer while the internal transfers etc are done by the bank
     * (offchain). It is not required though to call this method before actually executing or rejecting the request, since
     * the operator can call the executeClearableTransfer or the rejectClearableTransfer directly, if desired.
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only an operator can do this
     * 
     */
    function processClearableTransfer(address orderer, string calldata operationId) external
        clearableTransferJustCreated(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        _setClearableTransferStatus(index, ClearableTransferStatusCode.InProcess);
        emit ClearableTransferInProcess(orderer, operationId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to honor a clearable transfer. This will execute
     * the hold and thus transfer the tokens from the payer to the payee
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function executeClearableTransfer(address orderer, string calldata operationId) external
        clearableTransferNotClosed(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        address from = _getFrom(index);
        address to = _getTo(index);
        uint256 amount = _getClearableTransferAmount(index);
        _decreaseBalance(from, amount);
        _increaseBalance(to, amount);
        _finalizeHold(orderer, operationId, 0);
        _setClearableTransferStatus(index, ClearableTransferStatusCode.Executed);
        emit ClearableTransferExecuted(orderer, operationId);
        return true;
    }

    /**
     * @notice Function to be called by the tokenizer administrator to reject a clearable transfer
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectClearableTransfer(address orderer, string calldata operationId, string calldata reason) external
        clearableTransferNotClosed(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        _finalizeHold(orderer, operationId, 0);
        _setClearableTransferStatus(index, ClearableTransferStatusCode.Rejected);
        emit ClearableTransferRejected(orderer, operationId, reason);
        return _setClearableTransferStatus(index, ClearableTransferStatusCode.Rejected);
    }

    // External view functions
    
    /**
     * @notice View method to read existing allowances to payout
     * @param wallet The address of the wallet from which the funds will be taken
     * @param orderer The address that can order clearable transfer on behalf of the wallet owner
     * @return Whether the address is approved or not to order clearable transfer on behalf of the wallet owner
     */
    function isApprovedToOrderClearableTransfer(address wallet, address orderer) external view returns (bool) {
        return _isApprovedToOrderClearableTransfer(wallet, orderer);
    }

    /**
     * @notice Function to retrieve all the information available for a particular clearable transfer
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer
     * @return from: The address of the wallet from which the funds will be transferred
     * @return to: The address of the wallet that will receive the funds
     * @return amount: the amount of funds requested
     * @return status: the current status of the clearable transfer
     */
    function retrieveClearableTransferData(
        address orderer,
        string calldata operationId
    )
        external view
        returns (
            address from,
            address to,
            uint256 amount,
            ClearableTransferStatusCode status
        )
    {
        uint256 index = _getClearableTransferIndex(orderer, operationId);
        from = _getFrom(index);
        to = _getTo(index);
        amount = _getClearableTransferAmount(index);
        status = _getClearableTransferStatus(index);
    }

    // Utility admin functions

    /**
     * @notice Function to retrieve all the information available for a particular clearable transfer
     * @param index The index of the clearable transfer
     * @return orderer: address that issued the clearable transfer
     * @return operationId: the ID of the clearable transfer (from this orderer)
     * @return toDebit: The address of the wallet from which the funds will be taken
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the destination of the funds being requested
     * @return status: the current status of the clearable transfer
     */
    function retrieveClearableTransferData(uint256 index)
        external view
        returns (
            address orderer,
            string memory operationId,
            address from,
            address to,
            uint256 amount,
            ClearableTransferStatusCode status
        )
    {
        orderer = _getClearableTransferOrderer(index);
        operationId = _getOperationId(index);
        from = _getFrom(index);
        to = _getTo(index);
        amount = _getClearableTransferAmount(index);
        status = _getClearableTransferStatus(index);
    }

    /**
     * @notice This function returns the amount of clearable transfers outstanding and closed, since they are stored in an
     * array and the position in the array constitutes the ID of each clearable transfer
     * @return The number of clearable transfers (both open and already closed)
     */
    function manyClearableTransfers() external view returns (uint256 many) {
        return _manyClearableTransfers();
    }

    // Private functions

    function _approveToRequestClearableTransfer(address wallet, address orderer) private returns (bool) {
        emit ApprovalToOrderClearableTransfer(wallet, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer, true);
    }

    function _revokeApprovalToRequestClearableTransfer(address wallet, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderClearableTransfer(wallet, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer, false);
    }

    function _isApprovedToOrderClearableTransfer(address wallet, address orderer) public view returns (bool){
        return _eternalStorage.getBoolFromDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer);
    }

    function _manyClearableTransfers() private view returns (uint256 many) {
        return _eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_IDS, 0);
    }

    function _getClearableTransferOrderer(uint256 index) private view clearableTransferIndexExists(index) returns (address orderer) {
        orderer = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_ORDERERS, index);
    }

    function _getClearableTransferIndex(
        address orderer,
        string memory operationId
    )
        private view
        clearableTransferExists(orderer, operationId)
        returns (uint256 index)
    {
        index = _eternalStorage.getUintFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_IDS_INDEXES, orderer, operationId);
    }

    function _getOperationId(uint256 index) private view clearableTransferIndexExists(index) returns (string memory operationId) {
        operationId = _eternalStorage.getStringFromArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_IDS_INDEXES, index);
    }

    function _getFrom(uint256 index) private view clearableTransferIndexExists(index) returns (address from) {
        from = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _FROM_WALLETS, index);
    }

    function _getTo(uint256 index) private view clearableTransferIndexExists(index) returns (address to) {
        to = _eternalStorage.getAddressFromArray(CLEARABLE_CONTRACT_NAME, _TO_WALLETS, index);
    }

    function _getClearableTransferAmount(uint256 index) private view clearableTransferIndexExists(index) returns (uint256 amount) {
        amount = _eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_AMOUNTS, index);
    }

    function _getClearableTransferStatus(uint256 index) private view clearableTransferIndexExists(index) returns (ClearableTransferStatusCode status) {
        status = ClearableTransferStatusCode(_eternalStorage.getUintFromArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_STATUS_CODES, index));
    }

    function _setClearableTransferStatus(uint256 index, ClearableTransferStatusCode status) private clearableTransferIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_STATUS_CODES, index, uint256(status));
    }

    function _createClearableTransferRequest(
        address orderer,
        string memory operationId,
        address from,
        address to,
        uint256 amount
    )
        private
        clearableTransferDoesNotExist(orderer, operationId)
        returns (uint256 index)
    {
        require(orderer == from || _isApprovedToOrderClearableTransfer(from, orderer), "Not approved to order clearable transfers");
        require(amount >= _availableFunds(from), "Not enough funds to request clearable transfer");
        _createHold(orderer, operationId, from, to, address(0), amount, false, 0, 0); // No notary or status, as this is going to be managed by the methods
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_ORDERERS, orderer);
        _eternalStorage.pushStringToArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_IDS, operationId);
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _FROM_WALLETS, from);
        _eternalStorage.pushAddressToArray(CLEARABLE_CONTRACT_NAME, _TO_WALLETS, to);
        _eternalStorage.pushUintToArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_AMOUNTS, amount);
        _eternalStorage.pushUintToArray(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_STATUS_CODES, uint256(ClearableTransferStatusCode.Ordered));
        index = _manyClearableTransfers();
        _eternalStorage.setUintInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_IDS_INDEXES, orderer, operationId, index);
        emit ClearableTransferOrdered(orderer, operationId, from, to, amount);
        return index;
    }

}
