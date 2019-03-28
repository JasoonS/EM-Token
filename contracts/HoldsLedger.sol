pragma solidity ^0.5;

import "../../EternalStorage/contracts/EternalStorageConnector.sol";

contract HoldsLedger is EternalStorageConnector {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private HOLDSLEDGER_CONTRACT_NAME = "HoldsLedger";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _BALANCES_ON_HOLD : mapping (address => uint256) with the total amounts on hold for each wallet
     * @dev _TOTAL_SUPPLY_ON_HOLD : Uint with the total amount on hold in the system
     */
    bytes32 constant private _BALANCES_ON_HOLD =     "_balancesOnHold";
    bytes32 constant private _TOTAL_SUPPLY_ON_HOLD = "_totalSupplyOnHold";

    // Internal functions

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

    // Private functions

    function _getBalanceOnHold(address wallet) private view returns (uint256) {
        return whichEternalStorage().getUintFromAddressMapping(HOLDSLEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet);
    }

    function _setBalanceOnHold(address wallet, uint256 value) private returns (bool) {
        return whichEternalStorage().setUintInAddressMapping(HOLDSLEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet, value);
    }

    function _getTotalSupplyOnHold() private view returns (uint256) {
        return whichEternalStorage().getUint(HOLDSLEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD);
    }

    function _setTotalSupplyOnHold(uint256 value) private returns (bool) {
        return whichEternalStorage().setUint(HOLDSLEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD, value);
    }

}    
