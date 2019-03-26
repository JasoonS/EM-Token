pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IPayoutable.sol";

/**
 * @title Payoutable
 * @notice Payoutable provides ERC20-like token contracts with a workflow to request and honor payout requests to
 * external bank accounts. Payout requests are issued by wallet owners (or delegated to other orderers with a
 * "requestFrom" type of method), and requests are executed or rejected by the tokenizing entity (i.e. processed by
 * the owner of the overall contract)
 */
contract Payoutable is IPayoutable, Compliant {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private PAYOUTABLE_CONTRACT_NAME = "Payoutable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _PAYOUT_ORDERERS : address array with the addresses of the orderers of the payouts
     * @dev _PAYOUT_IDS : string array with payout IDs
     * @dev _WALLETS_TO_DEBIT : address array with the addresses from which the funds should be taken
     * @dev _PAYOUT_AMOUNTS : uint256 array with the payout amounts being requested
     * @dev _PAYOUT_INSTRUCTIONS : string array with the payout instructions (e.g. a reference to the bank account
     * to transfer the money to)
     * @dev _PAYOUT_STATUS_CODES : PayoutStatusCode array with the status code for the payout request
     * @dev _PAYOUT_IDS_INDEXES : mapping (address => mapping (string => uint256) storing the indexes for payout requests data
     * (this is to allow equal IDs to be used by different orderers)
     * @dev _PAYOUT_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to request payouts on behalf of wallets
     */
    bytes32 constant private _PAYOUT_ORDERERS =   "_payoutOrderers";
    bytes32 constant private _PAYOUT_IDS =          "_payoutIds";
    bytes32 constant private _WALLETS_TO_DEBIT =    "_walletsToDebit";
    bytes32 constant private _PAYOUT_AMOUNTS =      "_payoutAmounts";
    bytes32 constant private _PAYOUT_INSTRUCTIONS = "_payoutInstructions";
    bytes32 constant private _PAYOUT_STATUS_CODES = "_payoutStatusCodes";
    bytes32 constant private _PAYOUT_IDS_INDEXES =  "_payoutIdsIndexes";
    bytes32 constant private _PAYOUT_APPROVALS =    "_payoutApprovals";

    // Modifiers

    modifier payoutExists(address orderer, string memory operationId) {
        require(_getPayoutIndex(orderer, operationId) > 0, "Payout request does not exist");
        _;
    }

    modifier payoutIndexExists(uint256 index) {
        require(index > 0 && index <= _manyPayouts(), "Payout request does not exist");
        _;
    }

    modifier payoutDoesNotExist(address orderer, string memory operationId) {
        require(_getPayoutIndex(orderer, operationId) == 0, "Payout request already exists");
        _;
    }
    
    modifier payoutInStatus(address orderer, string memory operationId, PayoutStatusCode status) {
        uint256 index = _getPayoutIndex(orderer, operationId);
        require(_getPayoutStatus(index) == status, "Payout in the wrong status");
        _;
    }

    // External state-modifying functions

    /**
     * @notice This function allows wallet owners to approve other addresses to request payouts on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param orderer The address to be approved as potential issuer of payouts
     */
    function approveToOrderPayout(address orderer) external returns (bool) {
        address walletToDebit = msg.sender;
        _check(_canApproveToOrderPayout, walletToDebit, orderer);
        return _approveToOrderPayout(walletToDebit, orderer);
    }

    /**
     * @notice This function allows wallet owners to revoke payout request privileges from previously approved addresses
     * @param orderer The address to be revoked as potential issuer of payout requests
     */
    function revokeApprovalToOrderPayout(address orderer) external returns (bool) {
        address walletToDebit = msg.sender;
        return _revokeApprovalToOrderPayout(walletToDebit, orderer);
    }

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
        returns (bool)
    {
        address orderer = msg.sender;
        address walletToDebit = msg.sender;
        _check(_canOrderPayout, walletToDebit, orderer, amount);
        _createPayout(orderer, operationId, walletToDebit, amount, instructions);
        return true;
    }

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
        returns (bool)
    {
        address orderer = msg.sender;
        _check(_canOrderPayout, walletToDebit, orderer, amount);
        _createPayout(orderer, operationId, walletToDebit, amount, instructions);
        return true;
    }

    /**
     * @notice Function to cancel an outstanding (i.e. not processed) payout
     * @param operationId The ID of the payout, which can then be used to index all the information about
     * the payout (together with the address of the orderer)
     * @dev Only the original orderer can actually cancel an outstanding payout
     */
    function cancelPayout(string calldata operationId) external
        payoutInStatus(msg.sender, operationId, PayoutStatusCode.Ordered)
        returns (bool)
    {
        address orderer = msg.sender;
        uint256 index = _getPayoutIndex(orderer, operationId);
        _setPayoutStatus(index, PayoutStatusCode.Cancelled);
        _finalizeHold(orderer, operationId, 0);
        emit PayoutCancelled(orderer, operationId);
        return true;
    }

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
    function processPayout(address orderer, string calldata operationId) external
        payoutInStatus(msg.sender, operationId, PayoutStatusCode.Ordered)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getPayoutIndex(orderer, operationId);
        _setPayoutStatus(index, PayoutStatusCode.InProcess);
        emit PayoutInProcess(orderer, operationId);
        return true;
    }

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
    function putFundsInSuspenseInPayout(address orderer, string calldata operationId) external
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getPayoutIndex(orderer, operationId);
        PayoutStatusCode status = _getPayoutStatus(index);
        require(status == PayoutStatusCode.Ordered || status == PayoutStatusCode.InProcess, "Hold cannot be executed in payout");
        address walletToDebit = _getWalletToDebit(index);
        uint256 amount = _getPayoutAmount(index);
        _removeFunds(walletToDebit, amount);
        _increaseBalance(SUSPENSE_WALLET, amount);
        _finalizeHold(orderer, operationId, 0);
        _setPayoutStatus(index, PayoutStatusCode.FundsInSuspense);
        emit PayoutFundsInSuspense(orderer, operationId);
        return true;
    }

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
    function executePayout(address orderer, string calldata operationId) external
        payoutInStatus(msg.sender, operationId, PayoutStatusCode.FundsInSuspense)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getPayoutIndex(orderer, operationId);
        uint256 amount = _getPayoutAmount(index);
        _decreaseBalance(SUSPENSE_WALLET, amount);
        _setPayoutStatus(index, PayoutStatusCode.Executed);
        emit PayoutExecuted(orderer, operationId);
        return true;
    }

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
    function rejectPayout(address orderer, string calldata operationId, string calldata reason) external
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 index = _getPayoutIndex(orderer, operationId);
        PayoutStatusCode status = _getPayoutStatus(index);
        if(status == PayoutStatusCode.InProcess || status == PayoutStatusCode.Ordered) {
            _finalizeHold(orderer, operationId, 0);
        } else {
            require(false, "Payout request cannot be rejected");
        }
        emit PayoutRejected(orderer, operationId, reason);
        return _setPayoutStatus(index, PayoutStatusCode.Rejected);
    }

    // External view functions
    
    /**
     * @notice View method to read existing allowances to request payouts
     * @param walletToDebit The address of the wallet from which the funds will be taken
     * @param orderer The address that can request payouts on behalf of the wallet owner
     * @return Whether the address is approved or not to request payout on behalf of the wallet owner
     */
    function isApprovedToOrderPayout(address walletToDebit, address orderer) external view returns (bool) {
        return _isApprovedToOrderPayout(walletToDebit, orderer);
    }

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
        )
    {
        uint256 index = _getPayoutIndex(orderer, operationId);
        walletToDebit = _getWalletToDebit(index);
        amount = _getPayoutAmount(index);
        instructions = _getPayoutInstructions(index);
        status = _getPayoutStatus(index);
    }

    // Utility admin functions

    /**
     * @notice Function to retrieve all the information available for a particular payout request
     * @param index The index of the payout request
     * @return orderer: address that issued the payout request
     * @return operationId: the ID of the payout request (from this orderer)
     * @return walletToDebit: The address of the wallet from which the funds will be taken
     * @return amount: the amount of funds requested
     * @return instructions: the routing instructions to determine the destination of the funds being requested
     * @return status: the current status of the payout request
     */
    function retrievePayoutData(uint256 index)
        external view
        returns (address orderer, string memory operationId, address walletToDebit, uint256 amount, string memory instructions, PayoutStatusCode status)
    {
        orderer = _getPayoutOrder(index);
        operationId = _getPayoutTransactionId(index);
        walletToDebit = _getWalletToDebit(index);
        amount = _getPayoutAmount(index);
        instructions = _getPayoutInstructions(index);
        status = _getPayoutStatus(index);
    }

    /**
     * @notice This function returns the amount of payout requests outstanding and closed, since they are stored in an
     * array and the position in the array constitutes the ID of each payout request
     * @return The number of payout requests (both open and already closed)
     */
    function manyPayouts() external view returns (uint256 many) {
        return _manyPayouts();
    }

    // Private functions

    function _manyPayouts() private view returns (uint256 many) {
        return _eternalStorage.getUintFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_IDS, 0);
    }

    function _getPayoutOrder(uint256 index) private view payoutIndexExists(index) returns (address orderer) {
        orderer = _eternalStorage.getAddressFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_ORDERERS, index);
    }

    function _getPayoutIndex(
        address orderer,
        string memory operationId
    )
        private view
        payoutExists(orderer, operationId)
        returns (uint256 index)
    {
        index = _eternalStorage.getUintFromDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_IDS_INDEXES, orderer, operationId);
    }

    function _getPayoutTransactionId(uint256 index) private view payoutIndexExists(index) returns (string memory operationId) {
        operationId = _eternalStorage.getStringFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_IDS_INDEXES, index);
    }

    function _getWalletToDebit(uint256 index) private view payoutIndexExists(index) returns (address walletToDebit) {
        walletToDebit = _eternalStorage.getAddressFromArray(PAYOUTABLE_CONTRACT_NAME, _WALLETS_TO_DEBIT, index);
    }

    function _getPayoutAmount(uint256 index) private view payoutIndexExists(index) returns (uint256 amount) {
        amount = _eternalStorage.getUintFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_AMOUNTS, index);
    }

    function _getPayoutInstructions(uint256 index) private view payoutIndexExists(index) returns (string memory instructions) {
        instructions = _eternalStorage.getStringFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_INSTRUCTIONS, index);
    }

    function _getPayoutStatus(uint256 index) private view payoutIndexExists(index) returns (PayoutStatusCode status) {
        status = PayoutStatusCode(_eternalStorage.getUintFromArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_STATUS_CODES, index));
    }

    function _setPayoutStatus(uint256 index, PayoutStatusCode status) private payoutIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_STATUS_CODES, index, uint256(status));
    }

    function _approveToOrderPayout(address walletToDebit, address orderer) private returns (bool) {
        emit ApprovalToOrderPayout(walletToDebit, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer, true);
    }

    function _revokeApprovalToOrderPayout(address walletToDebit, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderPayout(walletToDebit, orderer);
        return _eternalStorage.setBoolInDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer, false);
    }

    function _isApprovedToOrderPayout(address walletToDebit, address orderer) public view returns (bool){
        return _eternalStorage.getBoolFromDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer);
    }

    function _createPayout(address orderer, string memory operationId, address walletToDebit, uint256 amount, string memory instructions)
        private
        payoutDoesNotExist(orderer, operationId)
        returns (uint256 index)
    {
        require(orderer == walletToDebit || _isApprovedToOrderPayout(walletToDebit, orderer), "Not approved to request payout");
        require(amount >= _availableFunds(walletToDebit), "Not enough funds to ask for payout");
        _createHold(orderer, operationId, walletToDebit, SUSPENSE_WALLET, address(0), amount, false, 0, 0); // No notary or status, as this is going to be managed by the methods
       _eternalStorage. pushAddressToArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_ORDERERS, orderer);
        _eternalStorage.pushStringToArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_IDS, operationId);
        _eternalStorage.pushAddressToArray(PAYOUTABLE_CONTRACT_NAME, _WALLETS_TO_DEBIT, walletToDebit);
        _eternalStorage.pushUintToArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_AMOUNTS, amount);
        _eternalStorage.pushStringToArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_INSTRUCTIONS, instructions);
        _eternalStorage.pushUintToArray(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_STATUS_CODES, uint256(PayoutStatusCode.Ordered));
        index = _manyPayouts();
        _eternalStorage.setUintInDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_IDS_INDEXES, orderer, operationId, index);
        emit PayoutOrdered(orderer, operationId, walletToDebit, amount, instructions);
        return index;
    }

}
