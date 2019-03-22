pragma solidity ^0.5;

import "./interface/IEMoneyToken.sol";
import "./ERC20.sol";
import "./Holdable.sol";
import "./Overdraftable.sol";
import "./Clearable.sol";
import "./Fundable.sol";
import "./Payoutable.sol";
import "./libraries/Strings.sol";
import "../../EternalStorage/contracts/EternalStorage.sol";

contract EMoneyToken is IEMoneyToken, ERC20, Holdable, Overdraftable, Clearable, Fundable, Payoutable {

    using Strings for string;

    // Data structures (in eternal storage)

    bytes32 constant private EMONEYTOKEN_CONTRACT_NAME = "EMoneyToken";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _NAME : string with the name of the token (e.g. "Santander Electronic Money Token")
     * @dev _SYMBOL : string with the symbol / ticker of the token (e.g. "SANEMEUR")
     * @dev _CURRENCY : string with the symbol of the currency (e.g. "EUR")
     * @dev _DECIMALS : uint with the number of decimals (e.g. 2 for cents) (this is for information purposes only)
     * @dev _INITIALIZED : bool flag set to true when the eternal storage has been initialized
     */
    bytes32 constant private _NAME = "_name";
    bytes32 constant private _SYMBOL = "_symbol";
    bytes32 constant private _CURRENCY = "_currency";
    bytes32 constant private _DECIMALS = "_decimals";
    bytes32 constant private _INITIALIZED = "_initialized";

    string constant private _version = "0.1.0";

    // Constructor

    constructor (string memory name, string memory symbol, string memory currency, uint8 decimals, address eternalStorage) public {
        // The following commented out to avoid oversized data errors during deployment:

        if(eternalStorage == address(0)) {
            eternalStorage = address(new EternalStorage());
            EternalStorage(eternalStorage).transferOwnership(msg.sender);
        }

        setEternalStorage(eternalStorage);
        if(_eternalStorage.getBool(EMONEYTOKEN_CONTRACT_NAME, _INITIALIZED)) {
            require(_eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _NAME).equals(name), "Given name different to the one stored in the eternal storage");
            require(_eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL).equals(symbol), "Given symbol different to the one stored in the eternal storage");
            require(_eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY).equals(currency), "Given currency different to the one stored in the eternal storage");
            require(_eternalStorage.getUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS) == decimals, "Given decimals different to the one stored in the eternal storage");
        } else {
            _eternalStorage.setString(EMONEYTOKEN_CONTRACT_NAME, _NAME, name);
            _eternalStorage.setString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL, symbol);
            _eternalStorage.setString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY, currency);
            _eternalStorage.setUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS, uint256(decimals));
            _eternalStorage.setBool(EMONEYTOKEN_CONTRACT_NAME, _INITIALIZED, true);
            _whitelist(SUSPENSE_WALLET);
        }
        emit Created(name, symbol, currency, decimals, _version, eternalStorage);
    }

    // External functions

    /**
     * @notice Show the name of the tokenizer entity
     * @return the name of the token.
     */
    function name() external view returns (string memory) {
        return _eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _NAME);
    }

    /**
     * @notice Show the symbol of the token
     * @return the symbol of the token.
     */
    function symbol() external view returns (string memory) {
        return _eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL);
    }

    /**
     * @notice Show the currency that backs the token
     * @return the currency of the token.
     */
    function currency() external view returns (string memory) {
        return _eternalStorage.getString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY);
    }

    /**
     * @notice Show the number of decimals of the token (remember, this is just for information purposes)
     * @return the number of decimals of the token.
     */
    function decimals() external view returns (uint8) {
        return uint8(_eternalStorage.getUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS));
    }

    /**
     * @notice Show the current version
     * @return the version of the smart contract.
     */
    function version() external pure returns (string memory) {
        return _version;
    }

}