pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IFundable.sol";

/**
 * @title Fundable
 * @notice Fundable provides ERC20-like token contracts with a workflow to request and honor funding requests from
 * external bank accounts. Funding requests are issued by wallet owners (or delegated to other requesters with a
 * "requestFrom" type of method), and requests are executed or rejected by the tokenizing entity (i.e. processed by
 * the owner of the overall contract)
 */
contract Fundable is IFundable, Compliant {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private FUNDABLE_CONTRACT_NAME = "Fundable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _WALLETS_TO_FUND : mapping (address => mapping (string => address)) storing the wallets to fund for each funding request
     * @dev _FUNDING_AMOUNTS : mapping (address => mapping (string => uint256)) storing the funding amouns for each funding request
     * @dev _FUNDING_INSTRUCTIONS : mapping (address => mapping (string => string)) storing the funding instructions for each funding request
     * @dev _FUNDING_STATUS_CODES : mapping (address => mapping (string => FundingStatusCode)) storing the status codes of each funding request
     * @dev _FUNDING_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to request funding on behalf of wallets
     */
    bytes32 constant private _WALLETS_TO_FUND =      "_walletsToFund";
    bytes32 constant private _FUNDING_AMOUNTS =      "_fundingAmounts";
    bytes32 constant private _FUNDING_INSTRUCTIONS = "_fundingInstructions";
    bytes32 constant private _FUNDING_STATUS_CODES = "_fundingStatusCodes";
    bytes32 constant private _FUNDING_APPROVALS =    "_fundingApprovals";

    // Modifiers

    modifier fundingExists(address orderer, string memory operationId) {
        require(_doesFundingExist(orderer, operationId), "Funding request does not exist");
        _;
    }

    modifier fundingDoesNotExist(address orderer, string memory operationId) {
        require(!_doesFundingExist(orderer, operationId), "Funding request already exists");
        _;
    }
    
    modifier fundingJustOrdered(address orderer, string memory operationId) {
        require(_getFundingStatus(orderer, operationId) == FundingStatusCode.Ordered, "Funding request is already closed");
        _;
    }

    modifier fundingNotClosed(address orderer, string memory operationId) {
        require(
            _getFundingStatus(orderer, operationId) == FundingStatusCode.Ordered ||
            _getFundingStatus(orderer, operationId) == FundingStatusCode.InProcess,
            "Funding request not in process"
        );
        _;
    }

    // External state-modifying functions

    /**
     * @notice This function allows wallet owners to approve other addresses to request funding on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential issuer of funding requests
     */
    function approveToOrderFunding(address orderer) external returns (bool) {
        address walletToFund = msg.sender;
        _check(_canApproveToOrderFunding, walletToFund, orderer);
        return _approveToOrderFunding(walletToFund, orderer);
    }

    /**
     * @notice This function allows wallet owners to revoke funding request privileges from previously approved addresses
     * @param orderer The address to be revoked as potential issuer of funding requests
     */
    function revokeApprovalToOrderFunding(address orderer) external returns (bool) {
        address walletToFund = msg.sender;
        return _revokeApprovalToOrderFunding(walletToFund, orderer);
    }

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
        returns (bool)
    {
        address orderer = msg.sender;
        address walletToFund = msg.sender;
        _check(_canOrderFunding, walletToFund, orderer, amount);
        return _createFunding(orderer, operationId, walletToFund, amount, instructions);
    }

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
        returns (bool)
    {
        address orderer = msg.sender;
        require(orderer == walletToFund || _isApprovedToOrderFunding(walletToFund, orderer), "Not approved to request funding");
        _check(_canOrderFunding, walletToFund, orderer, amount);
        return _createFunding(orderer, operationId, walletToFund, amount, instructions);
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) funding
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @dev Only the original orderer can actually cancel an outstanding request
     */
    function cancelFunding(string calldata operationId) external
        fundingJustOrdered(msg.sender, operationId)
        returns (bool)
    {
        address orderer = msg.sender;
        emit FundingCancelled(orderer, operationId);
        return _setFundingStatus(orderer, operationId, FundingStatusCode.Cancelled);
    }

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
    function processFunding(address orderer, string calldata operationId) external
        fundingJustOrdered(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        emit FundingInProcess(orderer, operationId);
        return _setFundingStatus(orderer, operationId, FundingStatusCode.InProcess);
    }

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
    function executeFunding(address orderer, string calldata operationId) external
        fundingNotClosed(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        address walletToFund = _getWalletToFund(orderer, operationId);
        uint256 amount = _getFundingAmount(orderer, operationId);
        _addFunds(walletToFund, amount);
        emit FundingExecuted(orderer, operationId);
        return _setFundingStatus(orderer, operationId, FundingStatusCode.Executed);
    }

    /**
     * @notice Function to be called by the tokenizer administrator to reject a funding request
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @param reason A string field to provide a reason for the rejection, should this be necessary
     * @dev Only operator can do this
     * 
     */
    function rejectFunding(address orderer, string calldata operationId, string calldata reason) external
        fundingNotClosed(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        emit FundingRejected(orderer, operationId, reason);
        return _setFundingStatus(orderer, operationId, FundingStatusCode.Rejected);
    }

    // External view functions
    
    /**
     * @notice View method to read existing allowances to request funding
     * @param walletToFund The owner of the wallet that would receive the funding
     * @param orderer The address that can request funding on behalf of the wallet owner
     * @return Whether the address is approved or not to request funding on behalf of the wallet owner
     */
    function isApprovedToOrderFunding(address walletToFund, address orderer) external view returns (bool) {
        return _isApprovedToOrderFunding(walletToFund, orderer);
    }

    /**
     * @notice Returns whether the funding request exists
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding, which can then be used to index all the information about
     */
    function doesFundingExist(address orderer, string calldata operationId) external view returns (bool) {
        return _doesFundingExist(orderer, operationId);
    } 

    /**
     * @notice Function to retrieve all the information available for a particular funding request
     * @param orderer The orderer of the funding request
     * @param operationId The ID of the funding request
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
        )
    {
        walletToFund = _getWalletToFund(orderer, operationId);
        amount = _getFundingAmount(orderer, operationId);
        instructions = _getFundingInstructions(orderer, operationId);
        status = _getFundingStatus(orderer, operationId);
    }

    // Internal functions

    function _createFunding(address orderer, string memory operationId, address walletToFund, uint256 amount, string memory instructions)
        private
        fundingDoesNotExist(orderer, operationId)
        returns (bool)
    {
        emit FundingOrdered(orderer, operationId, walletToFund, amount, instructions);
        return
            _setWalletToFund(orderer, operationId, walletToFund) &&
            _setFundingAmount(orderer, operationId, amount) &&
            _setFundingInstructions(orderer, operationId, instructions) &&
            _setFundingStatus(orderer, operationId, FundingStatusCode.Ordered);
    }

    function _doesFundingExist(address orderer, string memory operationId) internal view returns (bool) {
        return whichEternalStorage().getUintFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, orderer, operationId) != uint256(FundingStatusCode.Nonexistent);
    }

    // Private functions wrapping access to eternal storage

    function _getWalletToFund(address orderer, string memory operationId) private view returns (address walletToFund) {
        walletToFund = whichEternalStorage().getAddressFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _WALLETS_TO_FUND, orderer, operationId);
    }

    function _setWalletToFund(address orderer, string memory operationId, address walletToFund) private returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _WALLETS_TO_FUND, orderer, operationId, walletToFund);
    }

    function _getFundingAmount(address orderer, string memory operationId) private view returns (uint256 amount) {
        amount = whichEternalStorage().getUintFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_AMOUNTS, orderer, operationId);
    }

    function _setFundingAmount(address orderer, string memory operationId, uint256 amount) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_AMOUNTS, orderer, operationId, amount);
    }

    function _getFundingInstructions(address orderer, string memory operationId) private view returns (string memory instructions) {
        instructions = whichEternalStorage().getStringFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_INSTRUCTIONS, orderer, operationId);
    }

    function _setFundingInstructions(address orderer, string memory operationId, string memory instructions) private returns (bool) {
        return whichEternalStorage().setStringInDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_INSTRUCTIONS, orderer, operationId, instructions);
    }

    function _getFundingStatus(address orderer, string memory operationId) private view returns (FundingStatusCode status) {
        status = FundingStatusCode(FundingStatusCode(whichEternalStorage().getUintFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, orderer, operationId)));
    }

    function _setFundingStatus(address orderer, string memory operationId, FundingStatusCode status) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, orderer, operationId, uint256(status));
    }

    function _approveToOrderFunding(address walletToFund, address orderer) private returns (bool) {
        emit ApprovalToOrderFunding(walletToFund, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer, true);
    }

    function _revokeApprovalToOrderFunding(address walletToFund, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderFunding(walletToFund, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer, false);
    }

    function _isApprovedToOrderFunding(address walletToFund, address orderer) private view returns (bool){
        return whichEternalStorage().getBoolFromDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer);
    }

}