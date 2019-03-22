pragma solidity ^0.5;

interface IFundable {

    enum FundingRequestStatusCode { Nonexistent, Requested, InProcess, Executed, Rejected, Cancelled }

    event FundingRequested(
        address indexed requester,
        string indexed transactionId,
        address indexed walletToFund,
        uint256 amount,
        string instructions
    );

    event FundingRequestInProcess(address indexed requester, string indexed transactionId);

    event FundingRequestExecuted(address indexed requester, string indexed transactionId);

    event FundingRequestRejected(address indexed requester, string indexed transactionId, string reason);

    event FundingRequestCancelled(address indexed requester, string indexed transactionId);

    event ApprovalToRequestFunding(address indexed walletToFund, address indexed requester);

    event RevokeApprovalToRequestFunding(address indexed walletToFund, address indexed requester);

    /**
     * @notice This function allows wallet owners to approve other addresses to request funding on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param requester The address to be approved as potential issuer of funding requests
     */
    function approveToRequestFunding(address requester) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke funding request privileges from previously approved addresses
     * @param requester The address to be revoked as potential issuer of funding requests
     */
    function revokeApprovalToRequestFunding(address requester) external returns (bool) ;

    /**
     * @notice Method for a wallet owner to request funding from the tokenizer on his/her own behalf
     * @param amount The amount requested
     * @param instructions The instructions for the funding request - e.g. routing information about the bank
     * account to be debited (normally a hash / reference to the actual information in an external repository),
     * or a code to indicate that the tokenization entity should use the default bank account associated with
     * the wallet
     */
    function requestFunding(
        string calldata transactionId,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Method to request funding on behalf of a (different) wallet owner (analogous to "transferFrom" in
     * classical ERC20). The requester needs to be previously approved
     * @param walletToFund The address of the wallet which will receive the funding
     * @param amount The amount requested
     * @param instructions The debit instructions, as is "requestFunding"
     */
    function requestFundingFrom(
        string calldata transactionId,
        address walletToFund,
        uint256 amount,
        string calldata instructions
    )
        external
        returns (bool);

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) funding request
     * @param transactionId The ID of the funding request, which can then be used to index all the information about
     * the funding request (together with the address of the sender)
     * @dev Only the original requester can actually cancel an outstanding request
     */
    function cancelFundingRequest(string calldata transactionId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to start processing a funding request. It simply
     * sets the status to "InProcess", which then prevents the requester from being able to cancel the funding
     * request. This method can be called by the operator to "lock" the funding request while the internal
     * transfers etc are done by the bank (offchain). It is not required though to call this method before
     * actually executing or rejecting the request, since the operator can call the executeFundingRequest or the
     * rejectFundingRequest directly, if desired.
     * @param requester The requester of the funding request
     * @param transactionId The ID of the funding request, which can then be used to index all the information about
     * the funding request (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function processFundingRequest(address requester, string calldata transactionId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to honor a funding request. After debiting the
     * corresponding bank account, the administrator calls this method to close the request (as "Executed") and
     * mint the requested tokens into the relevant wallet
     * @param requester The requester of the funding request
     * @param transactionId The ID of the funding request, which can then be used to index all the information about
     * the funding request (together with the address of the sender)
     * @dev Only operator can do this
     * 
     */
    function executeFundingRequest(address requester, string calldata transactionId) external returns (bool);

    /**
     * @notice Function to be called by the tokenizer administrator to reject a funding request
     * @param requester The requester of the funding request
     * @param transactionId The ID of the funding request, which can then be used to index all the information about
     * the funding request (together with the address of the sender)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectFundingRequest(address requester, string calldata transactionId, string calldata reason) external returns (bool);

    /**
     * @notice View method to read existing allowances to request funding
     * @param walletToFund The owner of the wallet that would receive the funding
     * @param requester The address that can request funding on behalf of the wallet owner
     * @return Whether the address is approved or not to request funding on behalf of the wallet owner
     */
    function isApprovedToRequestFunding(address walletToFund, address requester) external view returns (bool);

    /**
     * @notice Function to retrieve all the information available for a particular funding request
     * @param requester The requester of the funding request
     * @param transactionId The ID of the funding request
     * @return walletToFund: the wallet to which the requested funds are directed to
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the source of the funds being requested
     * @return status: the current status of the funding request
     */
    function retrieveFundingData(address requester, string calldata transactionId)
        external view
        returns (
            address walletToFund,
            uint256 amount,
            string memory instructions,
            FundingRequestStatusCode status
        );
        
}