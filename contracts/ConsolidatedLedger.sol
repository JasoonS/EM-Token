pragma solidity ^0.5;

import "./interface/ICOnsolidatedLedger.sol";
import "./ERC20Ledger.sol";
import "./HoldsLedger.sol";
import "./OverdraftsLedger.sol";

/**
 * @title ConsolidatedLedger
 * @dev This contract implements methods to operate balances on a consolidated fashion taking info account
 * ERC20 balances, overdrafts and holds
 */
contract ConsolidatedLedger is IConsolidatedLedger, ERC20Ledger, HoldsLedger, OverdraftsLedger {

    using SafeMath for int256;
    
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
        return _balanceOf(wallet).toInt().sub(_drawnAmount(wallet).toInt());
    }
    
    // Internal functions
    
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

}
