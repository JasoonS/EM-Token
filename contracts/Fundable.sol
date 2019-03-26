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
     * @dev _FUNDING_ORDERERS : address array with the addresses of the requesters of the funds
     * @dev _FUNDING_IDS : string array with funding IDs
     * @dev _WALLETS_TO_FUND : address array with the addresses that should receive the funds requested
     * @dev _FUNDING_AMOUNTS : uint256 array with the funding amounts being requested
     * @dev _FUNDING_INSTRUCTIONS : string array with the funding instructions (e.g. a reference to the bank account
     * to debit)
     * @dev _FUNDING_STATUS_CODES : FundingStatusCode array with the status code for the funding request
     * @dev _FUNDING_IDS_INDEXES : mapping (address => mapping (string => uint256) storing the indexes for funding requests data
     * (this is to allow equal IDs to be used by different requesters)
     * @dev _FUNDING_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to request funding on behalf of wallets
     */
    bytes32 constant private _FUNDING_ORDERERS =     "_fundingOrderers";
    bytes32 constant private _FUNDING_IDS =          "_fundingIds";
    bytes32 constant private _WALLETS_TO_FUND =      "_walletsToFund";
    bytes32 constant private _FUNDING_AMOUNTS =      "_fundingAmounts";
    bytes32 constant private _FUNDING_INSTRUCTIONS = "_fundingInstructions";
    bytes32 constant private _FUNDING_STATUS_CODES = "_fundingStatusCodes";
    bytes32 constant private _FUNDING_IDS_INDEXES =  "_fundingIdsIndexes";
    bytes32 constant private _FUNDING_APPROVALS =    "_fundingApprovals";

    // Modifiers

    modifier fundingExists(address orderer, string memory operationId) {
        require(_getFundingIndex(orderer, operationId) > 0, "Funding request does not exist");
        _;
    }

    modifier fundingIndexExists(uint256 index) {
        require(index > 0 && index <= _manyFundings(), "Funding request does not exist");
        _;
    }

    modifier fundingDoesNotExist(address orderer, string memory operationId) {
        require(_getFundingIndex(orderer, operationId) == 0, "Funding request already exists");
        _;
    }
    
    modifier fundingJustCreated(address orderer, string memory operationId) {
        uint256 index = _getFundingIndex(orderer, operationId);
        require(_getFundingStatus(index) == FundingStatusCode.Ordered, "Funding request is already closed");
        _;
    }

    modifier fundingNotClosed(address orderer, string memory operationId) {
        uint256 index = _getFundingIndex(orderer, operationId);
        FundingStatusCode status = _getFundingStatus(index);
        require(
            status == FundingStatusCode.Ordered || status == FundingStatusCode.InProcess,
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
        _createFunding(orderer, operationId, walletToFund, amount, instructions);
        return true;
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
        _check(_canOrderFunding, walletToFund, orderer, amount);
        _createFunding(orderer, operationId, walletToFund, amount, instructions);
        return true;
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) funding
     * @param operationId The ID of the funding, which can then be used to index all the information about
     * the funding (together with the address of the orderer)
     * @dev Only the original orderer can actually cancel an outstanding request
     */
    function cancelFunding(string calldata operationId) external
        fundingNotClosed(msg.sender, operationId)
        returns (bool)
    {
        address orderer = msg.sender;
        uint256 index = _getFundingIndex(orderer, operationId);
        _setFundingStatus(index, FundingStatusCode.Cancelled);
        emit FundingCancelled(orderer, operationId);
        return true;
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
        fundingJustCreated(orderer, operationId)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getFundingIndex(orderer, operationId);
        _setFundingStatus(index, FundingStatusCode.InProcess);
        emit FundingInProcess(orderer, operationId);
        return true;
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
        uint256 index = _getFundingIndex(orderer, operationId);
        address walletToFund = _getWalletToFund(index);
        uint256 amount = _getFundingAmount(index);
        _addFunds(walletToFund, amount);
        _setFundingStatus(index, FundingStatusCode.Executed);
        emit FundingExecuted(orderer, operationId);
        return true;
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
        uint256 index = _getFundingIndex(orderer, operationId);
        emit FundingRejected(orderer, operationId, reason);
        return _setFundingStatus(index, FundingStatusCode.Rejected);
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
        uint256 index = _getFundingIndex(orderer, operationId);
        walletToFund = _getWalletToFund(index);
        amount = _getFundingAmount(index);
        instructions = _getFundingInstructions(index);
        status = _getFundingStatus(index);
    }

    // Utility admin functions

    /**
     * @notice Function to retrieve all the information available for a particular funding request
     * @param index The index of the funding request
     * @return orderer: address that issued the funding request
     * @return operationId: the ID of the funding request (from this orderer)
     * @return walletToFund: the wallet to which the requested funds are directed to
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the source of the funds being requested
     * @return status: the current status of the funding request
     */
    function retrieveFundingData(uint256 index)
        external view
        returns (address orderer, string memory operationId, address walletToFund, uint256 amount, string memory instructions, FundingStatusCode status)
    {
        orderer = _getFundingOrderer(index);
        operationId = _getOperationId(index);
        walletToFund = _getWalletToFund(index);
        amount = _getFundingAmount(index);
        instructions = _getFundingInstructions(index);
        status = _getFundingStatus(index);
    }

    /**
     * @notice This function returns the amount of funding requests outstanding and closed, since they are stored in an
     * array and the position in the array constitutes the ID of each funding request
     * @return The number of funding requests (both open and already closed)
     */
    function manyFundings() external view returns (uint256 many) {
        return _manyFundings();
    }

    // Private functions

    function _manyFundings() private view returns (uint256 many) {
        return _eternalStorage.getUintFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_IDS, 0);
    }

    function _getFundingOrderer(uint256 index) private view fundingIndexExists(index) returns (address orderer) {
        orderer = _eternalStorage.getAddressFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_ORDERERS, index);
    }

    function _getFundingIndex(
        address orderer,
        string memory operationId
    )
        private view
        fundingExists(orderer, operationId)
        returns (uint256 index)
    {
        index = _eternalStorage.getUintFromDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_IDS_INDEXES, orderer, operationId);
    }

    function _getOperationId(uint256 index) private view fundingIndexExists(index) returns (string memory operationId) {
        operationId = _eternalStorage.getStringFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_IDS_INDEXES, index);
    }

    function _getWalletToFund(uint256 index) private view fundingIndexExists(index) returns (address walletToFund) {
        walletToFund = _eternalStorage.getAddressFromArray(FUNDABLE_CONTRACT_NAME, _WALLETS_TO_FUND, index);
    }

    function _getFundingAmount(uint256 index) private view fundingIndexExists(index) returns (uint256 amount) {
        amount = _eternalStorage.getUintFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_AMOUNTS, index);
    }

    function _getFundingInstructions(uint256 index) private view fundingIndexExists(index) returns (string memory instructions) {
        instructions = _eternalStorage.getStringFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_INSTRUCTIONS, index);
    }

    function _getFundingStatus(uint256 index) private view fundingIndexExists(index) returns (FundingStatusCode status) {
        status = FundingStatusCode(_eternalStorage.getUintFromArray(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, index));
    }

    function _setFundingStatus(uint256 index, FundingStatusCode status) private fundingIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, index, uint256(status));
    }

    function _approveToOrderFunding(address walletToFund, address orderer) private returns (bool) {
        emit ApprovalToOrderFunding(walletToFund, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer, true);
    }

    function _revokeApprovalToOrderFunding(address walletToFund, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderFunding(walletToFund, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer, false);
    }

    function _isApprovedToOrderFunding(address walletToFund, address orderer) public view returns (bool){
        return _eternalStorage.getBoolFromDoubleAddressAddressMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_APPROVALS, walletToFund, orderer);
    }

    function _createFunding(address orderer, string memory operationId, address walletToFund, uint256 amount, string memory instructions)
        private
        fundingDoesNotExist(orderer, operationId)
        returns (uint256 index)
    {
        require(orderer == walletToFund || _isApprovedToOrderFunding(walletToFund, orderer), "Not approved to request funding");
        _eternalStorage.pushAddressToArray(FUNDABLE_CONTRACT_NAME, _FUNDING_ORDERERS, orderer);
        _eternalStorage.pushStringToArray(FUNDABLE_CONTRACT_NAME, _FUNDING_IDS, operationId);
        _eternalStorage.pushAddressToArray(FUNDABLE_CONTRACT_NAME, _WALLETS_TO_FUND, walletToFund);
        _eternalStorage.pushUintToArray(FUNDABLE_CONTRACT_NAME, _FUNDING_AMOUNTS, amount);
        _eternalStorage.pushStringToArray(FUNDABLE_CONTRACT_NAME, _FUNDING_INSTRUCTIONS, instructions);
        _eternalStorage.pushUintToArray(FUNDABLE_CONTRACT_NAME, _FUNDING_STATUS_CODES, uint256(FundingStatusCode.Ordered));
        index = _manyFundings();
        _eternalStorage.setUintInDoubleAddressStringMapping(FUNDABLE_CONTRACT_NAME, _FUNDING_IDS_INDEXES, orderer, operationId, index);
        emit FundingOrdered(orderer, operationId, walletToFund, amount, instructions);
        return index;
    }

}