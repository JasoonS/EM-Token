pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IOverdraftable.sol";
import "./libraries/SafeMath.sol";

/**
 * @title Overdraftable - simple implementation of an overdraft line
 * @dev Overdraft lines can only be drawn or restored through internal methods, which are implemented in HoldsLedger.
 * This contract is only valid to set limits and read drawn amounts
 */
contract Overdraftable is IOverdraftable, Compliant {

    using SafeMath for uint256;

    bytes32 constant private OVERDRAFTABLE_CONTRACT_NAME = "Overdraftable";

    /**
     * @dev Data structures:
     * @dev _INTEREST_ENGINES : mapping address => address with the applicable interest engine to each wallet
     */
    bytes32 constant private _INTEREST_ENGINES = "_interestEngines";

    // External functions

    /**
     * @notice setUnsecuredOverdraftLimit changes the overdraft limit for a wallet
     * @param wallet the address of the wallet
     * @param newLimit the new limit of the overdraft line
     * @dev Only the CRO is allowed to do this
     */
    function setUnsecuredOverdraftLimit(address wallet, uint256 newLimit) external returns (bool) {
        requireRole(CRO_ROLE);
        uint256 oldLimit = _unsecuredOverdraftLimit(wallet);
        emit UnsecuredOverdraftLimitSet(wallet, oldLimit, newLimit);
        return _setUnsecuredOverdraftLimit(wallet, newLimit);
    }

    /**
     * @notice setInterestEngine changes the interest engine for an wallet
     * @param wallet the address of the wallet
     * @param newEngine the new interest engine to attach to the overdraft line
     * @dev Only the CRO is allowed to do this
     */
    function setInterestEngine(address wallet, address newEngine) external returns(bool) {
        requireRole(CRO_ROLE);
        address previousEngine = _getInterestEngine(wallet);
        emit InterestEngineSet(wallet, previousEngine, newEngine);
        return _setInterestEngine(wallet, newEngine);
    }

    /**
     * @notice chargeInterest should be called by the interest engine contract to charge interest on the overdraft line
     * @param wallet the address of the wallet
     * @param amount the interest amount being charged
     * @dev Only the interestEngine for this wallet can call this function. Implementation shoud start with some like:
     * require(msg.sender == _interestEngine, "Only the interest engine can charge interest");
     */
    function chargeInterest(address wallet, uint256 amount) external returns (bool) {
        address engine = _getInterestEngine(wallet);
        require(msg.sender == engine, "Only the interest engine can charge interest");
        _removeFunds(wallet, amount);
        emit interestCharged(wallet, engine, amount);
        return true;
    }

    // External view functions
    
    /**
     * @notice unsecuredOverdraftLimit returns the unsecured overdraft limit for an wallet
     * @param wallet the address of the wallet
     * @return The limit of the overdraft line
     */
    function unsecuredOverdraftLimit(address wallet) external view returns (uint256) {
        return _unsecuredOverdraftLimit(wallet);
    }

    /**
     * @notice drawnAmount returns the amount drawn from the overdraft line
     * @param wallet the address of the wallet
     * @return The amount already drawn from the overdraft line
     */
    function drawnAmount(address wallet) external view returns (uint256) {
        return _drawnAmount(wallet);
    }

    /**
     * @notice totalDrawnAmount returns the addition of all the amounts drawn from overdraft lines in all wallets
     * @return The total amount drawn from all overdraft lines
     */
    function totalDrawnAmount() external view returns (uint256) {
        return _totalDrawnAmount();
    }

    /**
     * @notice interestEngine returns the address of the interest engine for a particular wallet, where interest rates and conditions are established
     * @param wallet the address of the wallet
     * @return The address of the interest engine contract
     */
    function interestEngine(address wallet) external view returns (address) {
        return _getInterestEngine(wallet);
    }

    // Private functions

    function _setInterestEngine(address wallet, address engine) private returns (bool) {
        return _eternalStorage.setAddressInMapping(OVERDRAFTABLE_CONTRACT_NAME, _INTEREST_ENGINES, wallet, engine);
    }

    function _getInterestEngine(address wallet) private view returns (address) {
        return _eternalStorage.getAddressFromMapping(OVERDRAFTABLE_CONTRACT_NAME, _INTEREST_ENGINES, wallet);
    }
}