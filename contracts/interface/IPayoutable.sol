pragma solidity ^0.5;

interface IPayoutable {

    enum PayoutStatusCode { Nonexistent, Ordered, InProcess, FundsInSuspense, Executed, Rejected, Cancelled }

    event PayoutOrdered(
        address indexed orderer,
        string operationId,
        address indexed walletToDebit,
        uint256 amount,
        string instructions
    );

    event PayoutInProcess(address indexed orderer, string operationId);
    event PayoutFundsInSuspense(address indexed orderer, string operationId);
    event PayoutExecuted(address indexed orderer, string operationId);
    event PayoutRejected(address indexed orderer, string operationId, string reason);
    event PayoutCancelled(address indexed orderer, string operationId);
    event ApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);
    event RevokeApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);


    /**
     * @notice This function allows wallet owners to approve other addresses to request payouts on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential issuer of payouts
     */
    function approveToOrderPayout(address orderer) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke payout request privileges from previously approved addresses
     * @param orderer The address to be revoked as potential issuer of payout requests
     */
    function revokeApprovalToOrderPayout(address orderer) external returns (bool);

    /**
     * @notice Method for a wallet owner to request a payout from the tokenizer on his/her own behalf
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @param amount The amount requested
     * @param instructions The instructions for the payout - e.g. routing information about the bank
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
     * @notice Method to request a payout on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The orderer needs to be previously approved
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @param walletToDebit The address of the wallet from which the funds will be taken
     * @param amount The amount requested
     * @param instructions The debit instructions, as is "orderPayout"
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
     * @notice Function to cancel an outstanding (i.e. not processed) payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @dev Only the original orderer can actually cancel an outstanding payout
     */
    function cancelPayout(string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a payout. First of all
     * it sets the status to "InProcess", which then prevents the orderer from being able to cancel the payout.
     * It also moves the funds to a suspense wallet, so the funds are locked until the payout is
     * resolved. This method is inteded to be called by the operator to "lock" the payout while the internal
     * transfers etc are done by the bank (offchain). It is required to call this method before actually executing
     * the request, since the operator cannot call executePayoutRequest directly. However the operator can reject the
     * request either after it is created or after it has started to be processed. In this last case the funds will be
     * returned from the suspense wallet to the payer
     * @param orderer The orderer of the payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @dev Only operator can do this
     * 
     */
    function processPayout(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to execute the hold and transfer the funds into the
     * suspense wallet. Once this happens, the only way forward is finishing the payout by transfering the money from the
     * omnibus account into the destination (client) account, to then close the payout (this will be acknowledged by
     * calling the executePayout method below).
     * @param orderer The orderer of the payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @dev Only operator can do this
     * @dev The payout needs to be either just created (Ordered) or InProcess in order for funds to be put into the suspense
     * wallet
     * 
     */
    function putFundsInSuspenseInPayout(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to honor a payout request. After crediting the
     * corresponding bank account, the administrator calls this method to close the request (as "Executed") and
     * burn the requested tokens from the relevant wallet
     * @param orderer The orderer of the payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @dev Only operator can do this
     * @dev The payout needs to be in FundsInSuspense in order to be able to be executed
     * 
     */
    function executePayout(address orderer, string calldata operationId) external returns (bool);
 
    /**
     * @notice Function to be called by the tokenizer administrator to reject a payout
     * @param orderer The orderer of the payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * @dev The payout needs to be either just created (Ordered) or InProcess to be able to be rejected (i.e. if funds are
     * already in suspense, then the payout can only be finished)
     * 
     */
    function rejectPayout(address orderer, string calldata operationId, string calldata reason) external returns (bool);
    
    /**
     * @notice View method to read existing allowances to request payouts
     * @param walletToDebit The address of the wallet from which the funds will be taken
     * @param orderer The address that can request payouts on behalf of the wallet owner
     * @return Whether the address is approved or not to request payout on behalf of the wallet owner
     */
    function isApprovedToOrderPayout(address walletToDebit, address orderer) external view returns (bool);

    /**
     * @notice Function to retrieve all the information available for a particular payout
     * @param orderer The orderer of the payout
     * @param operationId The ID of the payout
     * @return walletToDebit: The address of the wallet from which the funds will be taken
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the destination of the funds being requested
     * @return status: the current status of the payout
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