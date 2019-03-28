pragma solidity ^0.5;

interface IFundable {

    enum FundingStatusCode { Nonexistent, Ordered, InProcess, Executed, Rejected, Cancelled }

    event FundingOrdered(
        address indexed orderer,
        string operationId,
        address indexed walletToFund,
        uint256 amount,
        string instructions
    );

    event FundingInProcess(address indexed orderer, string operationId);
    event FundingExecuted(address indexed orderer, string operationId);
    event FundingRejected(address indexed orderer, string operationId, string reason);
    event FundingCancelled(address indexed orderer, string operationId);
    event ApprovalToOrderFunding(address indexed walletToFund, address indexed orderer);
    event RevokeApprovalToOrderFunding(address indexed walletToFund, address indexed orderer);

    /**
     * @notice This function allows wallet owners to approve other addresses to request funding on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential issuer of funding requests
     */
    function approveToOrderFunding(address orderer) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke funding request privileges from previously approved addresses
     * @param orderer The address to be revoked as potential issuer of funding requests
     */
    function revokeApprovalToOrderFunding(address orderer) external returns (bool);

    /**
     * @notice Method for a wallet owner to request funding from the tokenizer on his/her own behalf
     * @param operationId The ID of the funding request, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @param amount The amount requested
     * @param instructions The instructions for the funding - e.g. routing information about the bank
     * account to be debited (normally a hash / reference to the actual information in an external repository),
     * or a code to indicate that the tokenization entity should use the default bank account associated with
     * the wallet
     */
    function orderFunding(
        string calldata operationId,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Method to request funding on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The orderer needs to be previously approved
     * @param operationId The ID of the funding request, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @param walletToFund The address of the wallet which will receive the funding
     * @param amount The amount requested
     * @param instructions The debit instructions, as in "orderFunding"
     */
    function orderFundingFrom(
        string calldata operationId,
        address walletToFund,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) funding
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @dev Only the original orderer can actually cancel an outstanding request
     */
    function cancelFunding(string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a funding request. It simply
     * sets the status to "InProcess", which then prevents the orderer from being able to cancel the funding.
     * This method can be called by the operator to "lock" the funding request while the internal
     * transfers etc are done by the bank (offchain). It is not required though to call this method before
     * actually executing or rejecting the request, since the operator can call the executeFunding or the
     * rejectFunding directly, if desired.
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @dev Only operator can do this
     * 
     */
    function processFunding(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to honor a funding request. After debiting the
     * corresponding bank account, the administrator calls this method to close the request (as "Executed") and
     * mint the requested tokens into the relevant wallet
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @dev Only operator can do this
     * 
     */
    function executeFunding(address orderer, string calldata operationId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to reject a funding request
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectFunding(address orderer, string calldata operationId, string calldata reason) external returns (bool);

    /**
     * @notice View method to read existing allowances to request funding
     * @param walletToFund The owner of the wallet that would receive the funding
     * @param orderer The address that can request funding on behalf of the wallet owner
     * @return Whether the address is approved or not to request funding on behalf of the wallet owner
     */
    function isApprovedToOrderFunding(address walletToFund, address orderer) external view returns (bool);

    /**
     * @notice Function to retrieve all the information available for a particular funding request
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding
     * @return walletToFund: the wallet to which the requested funds are directed to
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the source of the funds being requested
     * @return status: the current status of the funding request
     */
    function retrieveFundingData(
        address orderer,
        string calldata operationId
    )
        external view
        returns (
            address walletToFund,
            uint256 amount,
            string memory instructions,
            FundingStatusCode status
        );
        
}