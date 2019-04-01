pragma solidity ^0.5;

import "./interface/ICOnsolidatedLedger.sol";
import "../../EternalStorage/contracts/EternalStorageConnector.sol";

/**
 * @title ConsolidatedLedger
 * @dev This contract implements methods to operate balances on a consolidated fashion taking info account
 * ERC20 balances, overdrafts and holds
 * @notice This contract implements the core data elements to support ERC20 balances and approvals, holds and
 * overdraft limits, drawn amounts and interest payments. It provides:
 * - Private data (all core data is private, not internal)
 * - Internal functions that annotate this data
 * - Public view functions (callable by users for consultation purposes)
 * - Admin functions to manipulate these data by the owner in emergency situations
 * @dev This contract is intended to be used from upstream contracts through inheritance
 */
contract ConsolidatedLedger is IConsolidatedLedger, EternalStorageConnector {

    using SafeMath for int256;
    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private LEDGER_CONTRACT_NAME = "Ledger";

    /**
     * @dev Data structures
     * @dev ERC20:
     * @dev * _BALANCES : address to uint mapping to store balances
     * @dev * _ALLOWED : address to address to uint mapping to store allowances 
     * @dev * _TOTALSUPPLY : uint storing total supply
     * @dev Overdraft lines:
     * @dev * _UNSECURED_OVERDRAFT_LIMITS : mapping (address => uint256) storing the overdraft limits (unsecured)
     * @dev * _OVERDRAFTS_DRAWN : mapping (address => uint256) storing the drawn overdraft limits
     * @dev * _TOTAL_OVERDRAFT_DRAWN : uint256 with the total amounts drawn in overdraft (analogous to totalSupply in ERC20)
     * @dev Holds:
     * @dev * _BALANCES_ON_HOLD : mapping (address => uint256) with the total amounts on hold for each wallet
     * @dev * _TOTAL_SUPPLY_ON_HOLD : Uint with the total amount on hold in the system
     */
    bytes32 constant private _BALANCES =                   "_balances";
    bytes32 constant private _ALLOWED =                    "_allowed";
    bytes32 constant private _TOTALSUPPLY =                "_totalSupply";
    bytes32 constant private _BALANCES_ON_HOLD =           "_balancesOnHold";
    bytes32 constant private _TOTAL_SUPPLY_ON_HOLD =       "_totalSupplyOnHold";
    bytes32 constant private _UNSECURED_OVERDRAFT_LIMITS = "_unsecuredOverdraftsLimits";
    bytes32 constant private _OVERDRAFTS_DRAWN =           "_overdraftsDrawn";
    bytes32 constant private _TOTAL_OVERDRAFT_DRAWN =      "_totalOverdraftDrawn";

    // Events

    event Mint(address indexed to, string referenceId, uint256 value);
    event Burn(address indexed from, string referenceId, uint256 value);

    event BalanceIncrease(address indexed wallet, uint256 value);
    event BalanceDecrease(address indexed wallet, uint256 value);

    event OverdraftDrawn(address indexed wallet, uint256 amount);
    event OverdraftRestored(address indexed wallet, uint256 amount);

    event BalanceDirectlyWritten(address indexed wallet, uint256 oldBalance, uint256 newBalance);
    event DrawnAmountDirectlyWritten(address indexed wallet, uint256 oldDrawnAmount, uint256 newDrawnAmount);
    event FundsDirectlyAdded(address wallet, uint256 value);
    event FundsDirectlyRemoved(address wallet, uint256 value);

    // External functions

    /**
     * @dev Returns the total net funds available in a wallet, taking into account the outright balance, the
     * drawn overdrafts, the available overdraft limit, and the holds taken
     */
    function availableFunds(address wallet) external view returns (uint256) {
        return _availableFunds(wallet);
    }

    /**
     * @dev Returns the net balance in a wallet, calculated as balance minus overdraft drawn amount
     * @dev (note that this could have been calculated as balance > 0 ? balance : - drawn amount)
     */
    function netBalanceOf(address wallet) external view returns (int256) {
        int256 balance = _balanceOf(wallet).toInt();
        int256 drawnAmount = _drawnAmount(wallet).toInt();
        return balance.sub(drawnAmount);
    }

    // Emergency admin functions (onlyOwner)

    function directWriteBalance(address wallet, uint256 newBalance) external onlyOwner returns (bool) {
        uint256 oldBalance = _balanceOf(wallet);
        emit BalanceDirectlyWritten(wallet, oldBalance, newBalance);
        return
            _setBalance(wallet, newBalance) &&
            _setTotalSupply(_getTotalSupply().sub(oldBalance).add(newBalance));
    }

    function directWriteDrawnAmount(address wallet, uint256 newDrawnAmount) external onlyOwner returns (bool) {
        uint256 oldDrawnAmount = _drawnAmount(wallet);
        emit DrawnAmountDirectlyWritten(wallet, oldDrawnAmount, newDrawnAmount);
        return
            _setDrawnAmount(wallet, newDrawnAmount) &&
            _setTotalDrawnAmount(_getTotalDrawnAmount().sub(oldDrawnAmount).add(newDrawnAmount));
    }

    /**
     * @dev Add funds to wallets (by owner)
     */
    function directAddFunds(address wallet, uint256 amount) external onlyOwner returns (bool) {
        _addFunds(wallet, amount);
        emit FundsDirectlyAdded(wallet, amount);
        return true;
    }
    
    /**
     * @dev Remove funds from wallets (by owner)
     */
    function directRemoveFunds(address wallet, uint256 amount) external onlyOwner returns (bool) {
        _removeFunds(wallet, amount);
        emit FundsDirectlyRemoved(wallet, amount);
        return true;
    }

    // Internal functions
    
    // ERC20
    function _approve(address allower, address spender, uint256 value) internal returns (bool) {
        return _setAllowance(allower, spender, value);
    }

    function _allowance(address owner, address spender) internal view returns (uint256) {
        return _getAllowance(owner, spender);
    }

    function _balanceOf(address owner) internal view returns (uint256) {
        return _getBalance(owner);
    }

    function _totalSupply() internal view returns (uint256) {
        return _getTotalSupply();
    }

    // Overdrafts
    function _setUnsecuredOverdraftLimit(address wallet, uint256 newLimit) internal returns (bool) {
        return _writeUnsecuredOverdraftLimit(wallet, newLimit);
    }

    function _unsecuredOverdraftLimit(address wallet) internal view returns (uint256) {
        return _getUnsecuredOverdraftLimit(wallet);
    }

    function _drawnAmount(address wallet) internal view returns (uint256) {
        return _getDrawnAmount(wallet);
    }

    function _totalDrawnAmount() internal view returns (uint256) {
        return _getTotalDrawnAmount();
    }

    // Holds
    function _addBalanceOnHold(address wallet, uint256 amount) internal returns (bool) {
        return
            _setBalanceOnHold(wallet, _getBalanceOnHold(wallet).add(amount)) &&
            _setTotalSupplyOnHold(_getTotalSupplyOnHold().add(amount));
    }

    function _substractBalanceOnHold(address wallet, uint256 amount) internal returns (bool) {
        return
            _setBalanceOnHold(wallet, _getBalanceOnHold(wallet).sub(amount)) &&
            _setTotalSupplyOnHold(_getTotalSupplyOnHold().sub(amount));
    }

    function _balanceOnHold(address wallet) internal view returns (uint256) {
        return _getBalanceOnHold(wallet);
    }

    function _totalSupplyOnHold() internal view returns (uint256) {
        return _getTotalSupplyOnHold();
    }

    // Consolidated ledger
    function _addFunds(address wallet, uint256 amount) internal {
        uint256 currentDrawnAmount = _drawnAmount(wallet);
        if(currentDrawnAmount >= amount) {
            _restoreOverdraft(wallet, amount);
        } else {
            if(currentDrawnAmount > 0) {
                _restoreOverdraft(wallet, currentDrawnAmount);
            }
            _increaseBalance(wallet, amount.sub(currentDrawnAmount));
        }
    }

    function _removeFunds(address wallet, uint256 amount) internal {
        uint256 currentBalance = _balanceOf(wallet);
        if (amount <= currentBalance) {
            _decreaseBalance(wallet, amount);
        } else {
            if(currentBalance > 0) {
                _decreaseBalance(wallet, currentBalance);
            }
            _drawFromOverdraft(wallet, amount.sub(currentBalance));
        }
    }

    function _availableFunds(address wallet) internal view returns (uint256) {
        return
            _balanceOf(wallet)
            .add(_unsecuredOverdraftLimit(wallet))
            .sub(_drawnAmount(wallet))
            .sub(_balanceOnHold(wallet));
    }

    // Private functions (the ones that write on the ledger)

    function _increaseBalance(address wallet, uint256 value) private returns (bool) {
        uint256 newBalance = _getBalance(wallet).add(value);
        uint256 newTotalSupply = _getTotalSupply().add(value);
        emit BalanceIncrease(wallet, value);
        return _setBalance(wallet, newBalance) && _setTotalSupply(newTotalSupply);
    }

    function _decreaseBalance(address wallet, uint256 value) private returns (bool) {
        uint256 newBalance = _getBalance(wallet).sub(value);
        uint256 newTotalSupply = _getTotalSupply().sub(value);
        emit BalanceDecrease(wallet, value);
        return _setBalance(wallet, newBalance) && _setTotalSupply(newTotalSupply);
    }

    function _drawFromOverdraft(address wallet, uint256 amount) private returns (bool) {
        uint256 newAmount = _getDrawnAmount(wallet).add(amount);
        uint256 newTotalAmount = _getTotalDrawnAmount().add(amount);
        emit OverdraftDrawn(wallet, amount);
        return _setDrawnAmount(wallet, newAmount) && _setTotalDrawnAmount(newTotalAmount);
    }

    function _restoreOverdraft(address wallet, uint256 amount) private returns (bool) {
        uint256 newAmount = _getDrawnAmount(wallet).sub(amount);
        uint256 newTotalAmount = _getTotalDrawnAmount().sub(amount);
        emit OverdraftRestored(wallet, amount);
        return _setDrawnAmount(wallet, newAmount) && _setTotalDrawnAmount(newTotalAmount);
    }

    // Private functions (the ones that interact with the eternal storage)
    
    // ERC20
    
    function _getBalance(address owner) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(LEDGER_CONTRACT_NAME, _BALANCES, owner);
    }

    function _setBalance(address owner, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(LEDGER_CONTRACT_NAME, _BALANCES, owner, value);
    }

    function _getAllowance(address owner, address spender) private view returns (uint256) {
        return whichEternalStorage().getUintFromDoubleAddressAddressMapping(LEDGER_CONTRACT_NAME, _ALLOWED, owner, spender);
    }

    function _setAllowance(address owner, address spender, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInDoubleAddressAddressMapping(LEDGER_CONTRACT_NAME, _ALLOWED, owner, spender, value);
    }

    function _getTotalSupply() private view returns (uint256) {
        return whichEternalStorage().getUint(LEDGER_CONTRACT_NAME, _TOTALSUPPLY);
    }

    function _setTotalSupply(uint256 value) private returns (bool) {
        return whichEternalStorage().setUint(LEDGER_CONTRACT_NAME, _TOTALSUPPLY, value);
    }

    // Holds

    function _getBalanceOnHold(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(LEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet);
    }

    function _setBalanceOnHold(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(LEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet, value);
    }

    function _getTotalSupplyOnHold() private view returns (uint256) {
        return whichEternalStorage().getUint(LEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD);
    }

    function _setTotalSupplyOnHold(uint256 value) private returns (bool) {
        return whichEternalStorage().setUint(LEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD, value);
    }

    // Overdrafts

    function _getUnsecuredOverdraftLimit(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(LEDGER_CONTRACT_NAME, _UNSECURED_OVERDRAFT_LIMITS, wallet);
    }

    function _writeUnsecuredOverdraftLimit(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(LEDGER_CONTRACT_NAME, _UNSECURED_OVERDRAFT_LIMITS, wallet, value);
    }

    function _getDrawnAmount(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(LEDGER_CONTRACT_NAME, _OVERDRAFTS_DRAWN, wallet);
    }

    function _setDrawnAmount(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(LEDGER_CONTRACT_NAME, _OVERDRAFTS_DRAWN, wallet, value);
    }

    function _getTotalDrawnAmount() private view returns (uint256) {
        return whichEternalStorage().getUint(LEDGER_CONTRACT_NAME, _TOTAL_OVERDRAFT_DRAWN);
    }

    function _setTotalDrawnAmount(uint256 value) private returns (bool) {
        return whichEternalStorage().setUint(LEDGER_CONTRACT_NAME, _TOTAL_OVERDRAFT_DRAWN, value);
    }

}
