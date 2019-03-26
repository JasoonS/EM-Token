pragma solidity ^0.5;

interface IClearable {

    enum ClearableTransferStatusCode { Nonexistent, Ordered, InProcess, Executed, Rejected, Cancelled }

    event ClearableTransferOrdered(
        address indexed orderer,
        string indexed operationId,
        address fromWallet,
        address toWallet,
        uint256 amount
    );

    event ClearableTransferInProcess(address indexed orderer, string indexed operationId);
    event ClearableTransferExecuted(address indexed orderer, string indexed operationId);
    event ClearableTransferRejected(address indexed orderer, string indexed operationId, string reason);
    event ClearableTransferCancelled(address indexed orderer, string indexed operationId);
    event ApprovalToOrderClearableTransfer(address indexed wallet, address indexed orderer);
    event RevokeApprovalToOrderClearableTransfer(address indexed wallet, address indexed orderer);


    /**
     * @notice This function allows wallet owners to approve other addresses to order clearable transfers on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential orderer of clearable transfers
     */
    function approveToOrderClearableTransfer(address orderer) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke clearable transfer ordering privileges from previously approved
     * addresses
     * @param orderer The address to be revoked as potential orderer of clearable transfers
     */
    function revokeApprovalToOrderClearableTransfer(address orderer) external returns (bool);

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
        returns (bool);
    
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
        returns (bool);

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only the original orderer can actually cancel an outstanding clerable transfer
     */
    function cancelClearableTransfer(string calldata operationId) external returns (bool);

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
    function processClearableTransfer(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to honor a clearable transfer. This will execute
     * the hold and thus transfer the tokens from the payer to the payee
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function executeClearableTransfer(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to reject a clearable transfer
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     * the clearable transfer (together with the address of the sender)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectClearableTransfer(address orderer, string calldata operationId, string calldata reason) external returns (bool);

    // External view functions
    
    /**
     * @notice View method to read existing allowances to payout
     * @param wallet The address of the wallet from which the funds will be taken
     * @param orderer The address that can order clearable transfer on behalf of the wallet owner
     * @return Whether the address is approved or not to order clearable transfer on behalf of the wallet owner
     */
    function isApprovedToOrderClearableTransfer(address wallet, address orderer) external view returns (bool);

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
        );

}