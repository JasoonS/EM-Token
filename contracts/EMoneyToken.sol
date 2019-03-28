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

/**
 * @title EMoneyToken - a token that implements electronic money
 * @notice The Electronic Money Token extends the ERC20 basic functionality with functionality needed to support banking and electronic
 https://emoneystandardtoken.org, https://emoneystandardtoken.netlify.com/ and https://github.com/juliofaura/EM-Token/blob/master/README.md
 * @dev The constructor of this contract takes 5 parameters. The first four (name, symbol, currency and decimals) are purely informational,
 * but the fifth specifies the address of an eternal storage repository where to store the storage data of the contract. This is because the
 * implementation uses the eternal storage construct implemented at https://github.com/juliofaura/EternalStorage, which allows to separate
 * contract logic (in the EMoneyToken contract) from data storage (in a seàrate EternalStorage contract). The address of the eternal storage
 * repository can be specified upon instantiation by passing a parameter to the constructor, in which case the rest of the parameters (name,
 * symbol, currency and decimals) must match the ones stored in the eternal storage (otherwise an exception is thrown upon instantiation of
 * the contract). If the eternal storage is not previously intialized then it will be initialized with the correct paramenters. And if a
 * zero address is passed, then a new eternal storage is instantiated for this EMoneyToken contract.
 */
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
        if(whichEternalStorage().getBool(EMONEYTOKEN_CONTRACT_NAME, _INITIALIZED)) {
            require(whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _NAME).equals(name), "Given name different to the one stored in the eternal storage");
            require(whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL).equals(symbol), "Given symbol different to the one stored in the eternal storage");
            require(whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY).equals(currency), "Given currency different to the one stored in the eternal storage");
            require(whichEternalStorage().getUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS) == decimals, "Given decimals different to the one stored in the eternal storage");
        } else {
            whichEternalStorage().setString(EMONEYTOKEN_CONTRACT_NAME, _NAME, name);
            whichEternalStorage().setString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL, symbol);
            whichEternalStorage().setString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY, currency);
            whichEternalStorage().setUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS, uint256(decimals));
            whichEternalStorage().setBool(EMONEYTOKEN_CONTRACT_NAME, _INITIALIZED, true);
            // _whitelist(SUSPENSE_WALLET); // This is a bad idea, as the suspense wallet should only be for internal use (e.g. we do not want a
            // user to send funds to the suspense wallet)
        }
        emit Created(name, symbol, currency, decimals, _version);
    }

    // External functions

    /**
     * @notice Show the name of the tokenizer entity
     * @return the name of the token.
     */
    function name() external view returns (string memory) {
        return whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _NAME);
    }

    /**
     * @notice Show the symbol of the token
     * @return the symbol of the token.
     */
    function symbol() external view returns (string memory) {
        return whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _SYMBOL);
    }

    /**
     * @notice Show the currency that backs the token
     * @return the currency of the token.
     */
    function currency() external view returns (string memory) {
        return whichEternalStorage().getString(EMONEYTOKEN_CONTRACT_NAME, _CURRENCY);
    }

    /**
     * @notice Show the number of decimals of the token (remember, this is just for information purposes)
     * @return the number of decimals of the token.
     */
    function decimals() external view returns (uint8) {
        return uint8(whichEternalStorage().getUint(EMONEYTOKEN_CONTRACT_NAME, _DECIMALS));
    }

    /**
     * @notice Show the current version
     * @return the version of the smart contract.
     */
    function version() external pure returns (string memory) {
        return _version;
    }

}