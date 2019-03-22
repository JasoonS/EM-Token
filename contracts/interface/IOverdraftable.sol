pragma solidity ^0.5;

interface IOverdraftable {

    event UnsecuredOverdraftLimitSet(address indexed wallet, uint256 oldLimit, uint256 newLimit);
    event InterestEngineSet(address indexed wallet, address indexed previousEngine, address indexed newEngine);
    event interestCharged(address indexed wallet, address indexed engine, uint256 amount);

    /**
     * @notice setUnsecuredOverdraftLimit changes the overdraft limit for an wallet
     * @param wallet the address of the wallet
     * @param newLimit the new limit of the overdraft line
     * @dev Only the CRO is allowed to do this
     */
    function setUnsecuredOverdraftLimit(address wallet, uint256 newLimit) external returns (bool);

    /**
     * @notice setInterestEngine changes the interest engine for an wallet
     * @param wallet the address of the wallet
     * @param newEngine the new interest engine to attach to the overdraft line
     * @dev Only the CRO is allowed to do this
     */
    function setInterestEngine(address wallet, address newEngine) external returns(bool);

    /**
     * @notice chargeInterest should be called by the interest engine contract to charge interest on the overdraft line
     * @param wallet the address of the wallet
     * @param amount the interest amount being charged
     * @dev Only the interestEngine for this wallet can call this function. Implementation shoud start with some like:
     * require(msg.sender == _interestEngine, "Only the interest engine can charge interest");
     */
    function chargeInterest(address wallet, uint256 amount) external returns (bool);

    // External view functions
    
    /**
     * @notice unsecuredOverdraftLimit returns the unsecured overdraft limit for an wallet
     * @param wallet the address of the wallet
     * @return The limit of the overdraft line
     */
    function unsecuredOverdraftLimit(address wallet) external view returns (uint256);

    /**
     * @notice drawnAmount returns the amount drawn from the overdraft line
     * @param wallet the address of the wallet
     * @return The amount already drawn from the overdraft line
     */
    function drawnAmount(address wallet) external view returns (uint256);

    /**
     * @notice totalDrawnAmount returns the addition of all the amounts drawn from overdraft lines in all wallets
     * @return The total amount drawn from all overdraft lines
     */
    function totalDrawnAmount() external view returns (uint256);

    /**
     * @notice interestEngine returns the address of the interest engine for a particular wallet, where interest rates and conditions are established
     * @param wallet the address of the wallet
     * @return The address of the interest engine contract
     */
    function interestEngine(address wallet) external view returns (address);

}