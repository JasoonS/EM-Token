pragma solidity ^0.5;

import "./Holdable.sol";
import "./interface/IPayoutable.sol";

/**
 * @title Payoutable
 * @notice Payoutable provides ERC20-like token contracts with a workflow to request and honor payout requests to
 * external bank accounts. Payout requests are issued by wallet owners (or delegated to other orderers with a
 * "requestFrom" type of method), and requests are executed or rejected by the tokenizing entity (i.e. processed by
 * the owner of the overall contract)
 */
contract Payoutable is IPayoutable, Holdable {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private PAYOUTABLE_CONTRACT_NAME = "Payoutable";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _WALLETS_TO_DEBIT : mapping (address => mapping (string => address)) with the addresses from which the
     * funds should be taken
     * @dev _PAYOUT_AMOUNTS : mapping (address => mapping (string => uint256)) with the payout amounts being requested
     * @dev _PAYOUT_INSTRUCTIONS : mapping (address => mapping (string => string)) with the payout instructions (e.g.
     * a reference to the bank account to transfer the money to)
     * @dev _PAYOUT_STATUS_CODES : mapping (address => mapping (string => PayoutStatusCode)) with the status codes for
     * the payout requests
     * @dev _PAYOUT_APPROVALS : mapping (address => mapping (address => bool)) storing the permissions for addresses
     * to request payouts on behalf of wallets
     */
    bytes32 constant private _PAYOUT_WALLETS_TO_DEBIT =    "_payoutWalletsToDebit";
    bytes32 constant private _PAYOUT_AMOUNTS =             "_payoutAmounts";
    bytes32 constant private _PAYOUT_INSTRUCTIONS =        "_payoutInstructions";
    bytes32 constant private _PAYOUT_STATUS_CODES =        "_payoutStatusCodes";
    bytes32 constant private _PAYOUT_APPROVALS =           "_payoutApprovals";

    // Modifiers

    modifier payoutExists(address orderer, string memory operationId) {
        require(_doesPayoutExist(orderer, operationId), "Payout request does not exist");
        _;
    }

    modifier payoutDoesNotExist(address orderer, string memory operationId) {
        require(!_doesPayoutExist(orderer, operationId), "Payout request already exist");
        _;
    }
    
    modifier payoutInStatus(address orderer, string memory operationId, PayoutStatusCode status) {
        require(_getPayoutStatus(orderer, operationId) == status, "Payout in the wrong status");
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
        return _createPayout(orderer, operationId, walletToDebit, amount, instructions);
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
        require(orderer == walletToDebit || _isApprovedToOrderPayout(walletToDebit, orderer), "Not approved to request payout");
        _check(_canOrderPayout, walletToDebit, orderer, amount);
        return _createPayout(orderer, operationId, walletToDebit, amount, instructions);
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
        _finalizeHold(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit HoldReleased(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit PayoutCancelled(orderer, operationId);
        return _setPayoutStatus(orderer, operationId, PayoutStatusCode.Cancelled);
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
        payoutInStatus(orderer, operationId, PayoutStatusCode.Ordered)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        emit PayoutInProcess(orderer, operationId);
        return _setPayoutStatus(orderer, operationId, PayoutStatusCode.InProcess);
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
        PayoutStatusCode status = _getPayoutStatus(orderer, operationId);
        require(status == PayoutStatusCode.Ordered || status == PayoutStatusCode.InProcess, "Hold cannot be executed in payout");
        address walletToDebit = _getWalletToDebit(orderer, operationId);
        uint256 amount = _getPayoutAmount(orderer, operationId);
        _removeFunds(walletToDebit, amount);
        _addFunds(SUSPENSE_WALLET, amount);
        _finalizeHold(orderer, operationId, HoldStatusCode.ExecutedByNotary);
        emit HoldExecuted(orderer, operationId, HoldStatusCode.ExecutedByNotary);
        emit PayoutFundsInSuspense(orderer, operationId);
        return _setPayoutStatus(orderer, operationId, PayoutStatusCode.FundsInSuspense);
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
        payoutInStatus(orderer, operationId, PayoutStatusCode.FundsInSuspense)
        returns (bool)
    {
        requireRole(OPERATOR_ROLE);
        uint256 amount = _getPayoutAmount(orderer, operationId);
        _removeFunds(SUSPENSE_WALLET, amount);
        emit PayoutExecuted(orderer, operationId);
        return _setPayoutStatus(orderer, operationId, PayoutStatusCode.Executed);
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
        PayoutStatusCode status = _getPayoutStatus(orderer, operationId);
        require(status == PayoutStatusCode.Ordered || status == PayoutStatusCode.InProcess, "Payout request cannot be rejected");
        _finalizeHold(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit HoldReleased(orderer, operationId, HoldStatusCode.ReleasedByNotary);
        emit PayoutRejected(orderer, operationId, reason);
        return _setPayoutStatus(orderer, operationId, PayoutStatusCode.Rejected);
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
     * @notice Returns whether the clearable transfer exists
     * @param orderer The orderer of the clearable transfer
     * @param operationId The ID of the clearable transfer, which can then be used to index all the information about
     */
    function doesPayoutExist(address orderer, string calldata operationId) external view returns (bool) {
        return _doesPayoutExist(orderer, operationId);
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
        walletToDebit = _getWalletToDebit(orderer, operationId);
        amount = _getPayoutAmount(orderer, operationId);
        instructions = _getPayoutInstructions(orderer, operationId);
        status = _getPayoutStatus(orderer, operationId);
    }

    // Internal functions

    function _createPayout(address orderer, string memory operationId, address walletToDebit, uint256 amount, string memory instructions)
        internal
        payoutDoesNotExist(orderer, operationId)
        returns (bool)
    {
        require(amount <= _availableFunds(walletToDebit), "Not enough funds to ask for payout");
        _createHold(orderer, operationId, walletToDebit, SUSPENSE_WALLET, address(0), amount, false, 0); // No notary, as this is going to be managed by the methods
        emit PayoutOrdered(orderer, operationId, walletToDebit, amount, instructions);
        return
            _setWalletToDebit(orderer, operationId, walletToDebit) &&
            _setPayoutAmount(orderer, operationId, amount) &&
            _setPayoutInstructions(orderer, operationId, instructions) &&
            _setPayoutStatus(orderer, operationId, PayoutStatusCode.Ordered);
    }

    function _doesPayoutExist(address orderer, string memory operationId) internal view returns (bool) {
        return _getPayoutStatus(orderer, operationId) != PayoutStatusCode.Nonexistent;
    }

    // Private functions wrapping access to eternal storage

    function _getWalletToDebit(address orderer, string memory operationId) private view returns (address walletToDebit) {
        walletToDebit = whichEternalStorage().getAddressFromDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_WALLETS_TO_DEBIT, orderer, operationId);
    }

    function _setWalletToDebit(address orderer, string memory operationId, address walletToDebit) private returns (bool) {
        return whichEternalStorage().setAddressInDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_WALLETS_TO_DEBIT, orderer, operationId, walletToDebit);
    }

    function _getPayoutAmount(address orderer, string memory operationId) private view returns (uint256 amount) {
        amount = whichEternalStorage().getUintFromDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_AMOUNTS, orderer, operationId);
    }

    function _setPayoutAmount(address orderer, string memory operationId, uint256 amount) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_AMOUNTS, orderer, operationId, amount);
    }

    function _getPayoutInstructions(address orderer, string memory operationId) private view returns (string memory instructions) {
        instructions = whichEternalStorage().getStringFromDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_INSTRUCTIONS, orderer, operationId);
    }

    function _setPayoutInstructions(address orderer, string memory operationId, string memory instructions) private returns (bool) {
        return whichEternalStorage().setStringInDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_INSTRUCTIONS, orderer, operationId, instructions);
    }

    function _getPayoutStatus(address orderer, string memory operationId) private view returns (PayoutStatusCode status) {
        status = PayoutStatusCode(whichEternalStorage().getUintFromDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_STATUS_CODES, orderer, operationId));
    }

    function _setPayoutStatus(address orderer, string memory operationId, PayoutStatusCode status) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressStringMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_STATUS_CODES, orderer, operationId, uint256(status));
    }

    function _approveToOrderPayout(address walletToDebit, address orderer) private returns (bool) {
        emit ApprovalToOrderPayout(walletToDebit, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer, true);
    }

    function _revokeApprovalToOrderPayout(address walletToDebit, address orderer) private returns (bool) {
        emit RevokeApprovalToOrderPayout(walletToDebit, orderer);
        return whichEternalStorage().setBoolInDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer, false);
    }

    function _isApprovedToOrderPayout(address walletToDebit, address orderer) private view returns (bool){
        return whichEternalStorage().getBoolFromDoubleAddressAddressMapping(PAYOUTABLE_CONTRACT_NAME, _PAYOUT_APPROVALS, walletToDebit, orderer);
    }

}
