pragma solidity ^0.5;

interface IPayoutable {

    enum PayoutStatusCode { Nonexistent, Ordered, InProcess, FundsInSuspense, Executed, Rejected, Cancelled }

    event PayoutOrdered(
        address indexed orderer,
        string indexed operationId,
        address indexed walletToDebit,
        uint256 amount,
        string instructions
    );

    event PayoutInProcess(address indexed orderer, string indexed operationId);

    event PayoutExecuted(address indexed orderer, string indexed operationId);

    event PayoutRejected(address indexed orderer, string indexed operationId, string reason);

    event PayoutCancelled(address indexed orderer, string indexed operationId);

    event ApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);

    event RevokeApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);


    /**
     * @notice This function allows wallet owners to approve other addresses to request payouts on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param requester The address to be approved as potential issuer of payout requests
     */
    function approveToOrderPayout(address orderer) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke payout request privileges from previously approved addresses
     * @param requester The address to be revoked as potential issuer of payout requests
     */
    function revokeApprovalToOrderPayout(address orderer) external returns (bool);

    /**
     * @notice Method for a wallet owner to request payout from the tokenizer on his/her own behalf
     * @param amount The amount requested
     * @param instructions The instructions for the payout request - e.g. routing information about the bank
     * account to which the funds should be directed (normally a hash / reference to the actual information
     * in an external repository), or a code to indicate that the tokenization entity should use the default
     * bank account associated with the wallet
     */
    function orderPayout(
        string calldata operationId,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Method to request payout on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The requester needs to be previously approved
     * @param walletToDebit The address of the wallet from which the funds will be taken
     * @param amount The amount requested
     * @param instructions The debit instructions, as is "requestPayout"
     */
    function orderPayoutFrom(
        string calldata operationId,
        address walletToDebit,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) payout request
     * @param transactionId The ID of the payout request, which can then be used to index all the information about
     * the payout request (together with the address of the sender)
     * @dev Only the original requester can actually cancel an outstanding request
     */
    function cancelPayout(string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a payout request. First of all
     * it sets the status to "InProcess", which then prevents the requester from being able to cancel the payout
     * request. It also moves the funds to a suspense wallet, so the funds are locked until the payout request is
     * resolved. This method is inteded to be called by the operator to "lock" the payout request while the internal
     * transfers etc are done by the bank (offchain). It is required to call this method before actually executing
     * the request, since the operator cannot call executePayoutRequest directly. However the operator can reject the
     * request either after it is created or after it has started to be processed. In this last case the funds will be
     * returned from the suspense wallet to the payer
     * @param requester The requester of the payout request
     * @param transactionId The ID of the payout request, which can then be used to index all the information about
     * the payout request (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function processPayout(address orderer, string calldata operationId) external returns (bool);

    function executeHoldInPayout(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to honor a payout request. After crediting the
     * corresponding bank account, the administrator calls this method to close the request (as "Executed") and
     * burn the requested tokens from the relevant wallet
     * @param requester The requester of the payout request
     * @param transactionId The ID of the payout request, which can then be used to index all the information about
     * the payout request (together with the address of the sender)
     * @dev Only operator can do this
     * @dev The payout request needs to be InProcess in order to be able to be executed
     * 
     */
    function executePayout(address orderer, string calldata operationId) external returns (bool);
 
    /**
     * @notice Function to be called by the tokenizer administrator to reject a payout request
     * @param requester The requester of the payout request
     * @param transactionId The ID of the payout request, which can then be used to index all the information about
     * the payout request (together with the address of the sender)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectPayout(address orderer, string calldata operationId, string calldata reason) external returns (bool);
    
    /**
     * @notice View method to read existing allowances to request payout
     * @param walletToDebit The address of the wallet from which the funds will be taken
     * @param requester The address that can request payout on behalf of the wallet owner
     * @return Whether the address is approved or not to request payout on behalf of the wallet owner
     */
    function isApprovedToOrderPayout(address walletToDebit, address orderer) external view returns (bool);

    /**
     * @notice Function to retrieve all the information available for a particular payout request
     * @param requester The requester of the payout request
     * @param transactionId The ID of the payout request
     * @return walletToDebit: The address of the wallet from which the funds will be taken
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the destination of the funds being requested
     * @return status: the current status of the payout request
     */
    function retrievePayoutData(
        address orderer,
        string calldata operationId
    )
        external view
        returns (
            address walletToDebit,
            uint256 amount,
            string memory instructions,
            PayoutStatusCode status
        );

}