pragma solidity ^0.5;

import "./Holdable.sol";
import "./interface/IClearable.sol";

/**
 * @title Clearable
 * @notice Clearable provides ERC20-like token contracts with a workflow to submit and process requests to perform transfers
 * that need to be clearable by the token issuing entity. These transfers are therefore processed in three steps: i) the user
 * (or someone delegated through an approval) requests the transfer; ii) the token issuer clears the transfer (offchain); and
 * iii) then the token issuer triggers the execution of the transfer, which moves the tokens from the sender to the receiver.
 */
contract Clearable is IClearable, Holdable {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private CLEARABLE_CONTRACT_NAME = "Clearable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _FROM_WALLETS : mapping (address => mapping (string => address)) with the addresses from which the funds will be
     * transferred
     * @dev _TO_WALLETS : mapping (address => mapping (string => address)) with the addresses to which the funds will be
     * transferred
     * @dev _CLEARABLE_TRANSFER_AMOUNTS : mapping (address => mapping (string => uint256)) with the clearable transfer amounts
     * being ordered
     * @dev _CLEARABLE_TRANSFER_STATUS_CODES : mapping (address => mapping (string => ClearableTransferStatusCode)) with the
     * status code for the clearable transfer
     * @dev _CLEARABLE_TRANSFER_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for
     * addresses to order clearable transfers on behalf of wallets
     */
    bytes32 constant private _CLEARABLE_TRANSFER_FROM_WALLETS = "_clearableTransferFromWallets";
    bytes32 constant private _CLEARABLE_TRANSFER_TO_WALLETS =   "_clearableTransferToWallets";
    bytes32 constant private _CLEARABLE_TRANSFER_AMOUNTS =      "_clearableTransferAmounts";
    bytes32 constant private _CLEARABLE_TRANSFER_STATUS_CODES = "_clearableTransferStatusCodes";
    bytes32 constant private _CLEARABLE_TRANSFER_APPROVALS =    "_clearableTransferApprovals";

    // Modifiers

    modifier clearableTransferExists(address orderer, string memory operationId) {
        require(_doesClearableTransferExist(orderer, operationId), "ClearableTransfer does not exist");
        _;
    }

    modifier clearableTransferDoesNotExist(address orderer, string memory operationId) {
        require(!_doesClearableTransferExist(orderer, operationId), "ClearableTransfer already exists");
        _;
    }
    
    modifier clearableTransferJustCreated(address orderer, string memory operationId) {
        require(_getClearableTransferStatus(orderer, operationId) == ClearableTransferStatusCode.Ordered, "ClearableTransfer is already closed");
        _;
    }

    modifier clearableTransferNotClosed(address orderer, string memory operationId) {
        ClearableTransferStatusCode status = _getClearableTransferStatus(orderer, operationId);
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
        return _createClearableTransfer(orderer, operationId, from, to, amount);
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
        require(orderer == from || _isApprovedToOrderClearableTransfer(from, orderer), "Not approved to order clearable transfers");
        _check(_canOrderClearableTransfer, from, to, amount);
        return _createClearableTransfer(orderer, operationId, from, to, amount);
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only the original orderer can actually cancel an outstanding clerable transfer
     */
    function cancelClearableTransfer(string calldata operationId) external
        clearableTransferJustCreated(msg.sender, operationId)
        returns (bool)
    {
        address orderer = msg.sender;
        _finalizeHold(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit HoldReleased(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit ClearableTransferCancelled(orderer, operationId);
        return _setClearableTransferStatus(orderer, operationId, ClearableTransferStatusCode.Cancelled);
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
        emit ClearableTransferInProcess(orderer, operationId);
        return _setClearableTransferStatus(orderer, operationId, ClearableTransferStatusCode.InProcess);
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
        address from = _getClearableTransferFrom(orderer, operationId);
        address to = _getClearableTransferTo(orderer, operationId);
        uint256 amount = _getClearableTransferAmount(orderer, operationId);
        _removeFunds(from, amount);
        _addFunds(to, amount);
        _finalizeHold(orderer, operationId, HoldStatusCode.ExecutedByNotary);
        emit HoldExecuted(orderer, operationId, HoldStatusCode.ExecutedByNotary);
        emit ClearableTransferExecuted(orderer, operationId);
        return _setClearableTransferStatus(orderer, operationId, ClearableTransferStatusCode.Executed);
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
        _finalizeHold(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit HoldReleased(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit ClearableTransferRejected(orderer, operationId, reason);
        return _setClearableTransferStatus(orderer, operationId, ClearableTransferStatusCode.Rejected);
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
     * @notice Returns whether the clearable transfer exists
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     */
    function doesClearableTransferExist(address orderer, string calldata operationId) external view returns (bool) {
        return _doesClearableTransferExist(orderer, operationId);
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
        from = _getClearableTransferFrom(orderer, operationId);
        to = _getClearableTransferTo(orderer, operationId);
        amount = _getClearableTransferAmount(orderer, operationId);
        status = _getClearableTransferStatus(orderer, operationId);
    }

    // Internal functions

    function _createClearableTransfer(
        address orderer,
        string memory operationId,
        address from,
        address to,
        uint256 amount
    )
        internal
        clearableTransferDoesNotExist(orderer, operationId)
        returns (bool)
    {
        require(amount <= _availableFunds(from), "Not enough funds to request clearable transfer");
        _createHold(orderer, operationId, from, to, address(0), amount, false, 0); // No notary or status, as this is going to be managed by the methods
        emit ClearableTransferOrdered(orderer, operationId, from, to, amount);
        return
            _setClearableTransferFrom(orderer, operationId, from) &&
            _setClearableTransferTo(orderer, operationId, to) &&
            _setClearableTransferAmount(orderer, operationId, amount) &&
            _setClearableTransferStatus(orderer, operationId, ClearableTransferStatusCode.Ordered);
    }

    function _doesClearableTransferExist(address orderer, string memory operationId) internal view returns (bool) {
        return _getClearableTransferStatus(orderer, operationId) != ClearableTransferStatusCode.Nonexistent;
    }

    // Private functions wrapping access to eternal storage
    
    function _getClearableTransferFrom(address orderer, string memory operationId) private view returns (address from) {
        from = whichEternalStorage().getAddressFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_FROM_WALLETS, orderer, operationId);
    }

    function _setClearableTransferFrom(address orderer, string memory operationId, address from) private returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_FROM_WALLETS, orderer, operationId, from);
    }

    function _getClearableTransferTo(address orderer, string memory operationId) private view returns (address to) {
        to = whichEternalStorage().getAddressFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_TO_WALLETS, orderer, operationId);
    }

    function _setClearableTransferTo(address orderer, string memory operationId, address to) private returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_TO_WALLETS, orderer, operationId, to);
    }

    function _getClearableTransferAmount(address orderer, string memory operationId) private view returns (uint256 amount) {
        amount = whichEternalStorage().getUintFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_AMOUNTS, orderer, operationId);
    }

    function _setClearableTransferAmount(address orderer, string memory operationId, uint256 amount) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_AMOUNTS, orderer, operationId, amount);
    }

    function _getClearableTransferStatus(address orderer, string memory operationId) private view returns (ClearableTransferStatusCode status) {
        status = ClearableTransferStatusCode(whichEternalStorage().getUintFromDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_STATUS_CODES, orderer, operationId));
    }

    function _setClearableTransferStatus(address orderer, string memory operationId, ClearableTransferStatusCode status) private  returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_STATUS_CODES, orderer, operationId, uint256(status));
    }

    function _approveToRequestClearableTransfer(address wallet, address orderer) private returns (bool) {
        emit ApprovalToOrderClearableTransfer(wallet, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer, true);
    }

    function _revokeApprovalToRequestClearableTransfer(address wallet, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderClearableTransfer(wallet, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer, false);
    }

    function _isApprovedToOrderClearableTransfer(address wallet, address orderer) private view returns (bool){
        return whichEternalStorage().getBoolFromDoubleAddressAddressMapping(CLEARABLE_CONTRACT_NAME, _CLEARABLE_TRANSFER_APPROVALS, wallet, orderer);
    }

}
