pragma solidity ^0.5;

import "../../EternalStorage/contracts/EternalStorageConnector.sol";

/**
 * @title OverdraftsLedger
 *
 * @notice This contract implements the core data elements to support overdraft limits, drawn amounts, and interest
 * payments
 * @dev This contract implements the core elements of the ledger to support overdraft lines
 * - Private data (all core data is private, not internal)
 * - Internal functions that annotate this data
 * - Public view functions (callable by users for consultation purposes)
 * @dev This contract is intended to be used from a higher order ERC20 token implementation (i.e.
 * inherting from this one)
 */
contract OverdraftsLedger is EternalStorageConnector {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private OVERDRAFTSLEDGER_CONTRACT_NAME = "OverdraftsLedger";

    /**
     * @dev Data structures for limits and drawn amounts, to be implemented in the eternal storage:
     * @dev _UNSECURED_OVERDRAFT_LIMITS : mapping (address => uint256) storing the overdraft limits (unsecured)
     * @dev _OVERDRAFTS_DRAWN : mapping (address => uint256) storing the drawn overdraft limits
     * @dev _TOTAL_OVERDRAFT_DRAWN : uint256 with the total amounts drawn in overdraft (analogous to totalSupply in ERC20)
     * @dev 
     */
    bytes32 constant private _UNSECURED_OVERDRAFT_LIMITS = "_unsecuredOverdraftsLimits";
    bytes32 constant private _DRAWN_AMOUNTS = "_drawnAmounts";
    bytes32 constant private _TOTAL_DRAWN_AMOUNTS = "_totalDrawnAmounts";

    // Events

    event OverdraftDrawn(address indexed wallet, uint256 amount);
    event OverdraftRestored(address indexed wallet, uint256 amount);

    // Internal functions

    function _unsecuredOverdraftLimit(address wallet) internal view returns (uint256) {
        return _getUnsecuredOverdraftLimit(wallet);
    }

    function _drawnAmount(address wallet) internal view returns (uint256) {
        return _getDrawnAmount(wallet);
    }

    function _setUnsecuredOverdraftLimit(address wallet, uint256 newLimit) internal returns (bool) {
        return _writeUnsecuredOverdraftLimit(wallet, newLimit);
    }

    function _drawFromOverdraft(address wallet, uint256 amount) internal returns (bool) {
        uint256 newAmount = _getDrawnAmount(wallet).add(amount);
        uint256 newTotalAmount = _getTotalDrawnAmount().add(amount);
        emit OverdraftDrawn(wallet, amount);
        return _setDrawnAmounts(wallet, newAmount) && _setTotalDrawnAmount(newTotalAmount);
    }

    function _restoreOverdraft(address wallet, uint256 amount) internal returns (bool) {
        uint256 newAmount = _getDrawnAmount(wallet).sub(amount);
        uint256 newTotalAmount = _getTotalDrawnAmount().sub(amount);
        emit OverdraftRestored(wallet, amount);
        return _setDrawnAmounts(wallet, newAmount) && _setTotalDrawnAmount(newTotalAmount);
    }

    function _totalDrawnAmount() internal view returns (uint256) {
        return _getTotalDrawnAmount();
    }

    // Private functions

    function _getUnsecuredOverdraftLimit(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(OVERDRAFTSLEDGER_CONTRACT_NAME, _UNSECURED_OVERDRAFT_LIMITS, wallet);
    }

    function _writeUnsecuredOverdraftLimit(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(OVERDRAFTSLEDGER_CONTRACT_NAME, _UNSECURED_OVERDRAFT_LIMITS, wallet, value);
    }

    function _getDrawnAmount(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(OVERDRAFTSLEDGER_CONTRACT_NAME, _DRAWN_AMOUNTS, wallet);
    }

    function _setDrawnAmounts(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(OVERDRAFTSLEDGER_CONTRACT_NAME, _DRAWN_AMOUNTS, wallet, value);
    }

    function _getTotalDrawnAmount() private view returns (uint256) {
        return whichEternalStorage().getUint(OVERDRAFTSLEDGER_CONTRACT_NAME, _DRAWN_AMOUNTS);
    }

    function _setTotalDrawnAmount(uint256 value) private returns (bool) {
        return whichEternalStorage().setUint(OVERDRAFTSLEDGER_CONTRACT_NAME, _DRAWN_AMOUNTS, value);
    }

}
