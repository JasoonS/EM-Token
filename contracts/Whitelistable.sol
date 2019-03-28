pragma solidity ^0.5;

import "./RoleControl.sol";


/**
 * @title Whitelistable
 * @dev The Whitelistable contract implements a simple whitelisting mechanism that can be used upstream to
 * ensure that only whitelisted wallets are allowed to transact
 */
contract Whitelistable is RoleControl {

    address constant SUSPENSE_WALLET = address(0);

// Data structures (in eternal storage)

    bytes32 constant private WHITELISTABLE_CONTRACT_NAME = "Whitelistable";

    /**
     * @dev Data structures
     * @dev _WHITELIST_REGISTRY : mapping (address => bool) with the flags that say whether addresses are registered or not
     * @dev _WHITELIST_FLAGS : mapping (address => bool) with the flags that say whether addresses are whitelisted or not
     * @dev _WHITELIST_ARRAY : address array with the addresses of the whitelisted wallets
     * @dev _WHITELIST_MAPPING : mapping (address => uint) with the indices of the whitelisted wallets
     */
    bytes32 constant private _WHITELIST_REGISTRY = "_whitelistRegistry";
    bytes32 constant private _WHITELIST_FLAGS = "_whitelistFlags";
    bytes32 constant private _WHITELIST_ARRAY = "_whitelistArray";
    bytes32 constant private _WHITELIST_MAPPING = "_whitelistMapping";

// Event

    event Whitelisted(address who, uint256 index);
    event UnWhitelisted(address who);

// External state-modifying functions

    /**
     * @dev Whitelist an individual address
     * @param who The address to be whitelisted
     */
    function whitelist(address who) external returns (uint256 index) {
        requireRole(COMPLIANCE_ROLE);
        if(_getRegisteredFlagInWhitelist(who)) {
            _setWhitelistedFlag(who, true);
            index = _getIndexInWhitelist(who);
        } else {
            index = _pushAddressToWhitelist(who);
        } 
        emit Whitelisted(who, index);
    }

    /**
     * @dev Unwhitelist an individual address
     * @param who The address to be unwhitelisted
     * @dev This does not remove the entry from the array, so it is recorded that this address was actually whitelisted at some point
     */
    function unWhitelist(address who) external returns (bool) {
        requireRole(COMPLIANCE_ROLE);
        require(_isWhitelisted(who), "Address is not whitelisted");
        emit UnWhitelisted(who);
        return _setWhitelistedFlag(who, false);
    }

// External view functions

    /**
     * @dev Number of whitelisted wallets
     */
    function manyRegisteredAddresses() external view returns (uint256) {
        return _getNumberOfRegisteredAddresses();
    }

    /**
     * @dev Array position of a wallet for an address
     * @dev (0 is for address(0), otherwise the wallet is not declared)
     * @param who address The address to obtain the corresponding wallet
     */
    function indexInWhitelist(address who) external view returns (uint256 index) {
        index = _getIndexInWhitelist(who);
    }

    /**
     * @dev Returns the address for a wallet in the array
     * @param index The position in the array
     */
    function addressInWhitelist(uint256 index) external view returns (address) {
        return _getAddressInWhitelist(index);
    } 

    /**
     * @dev Returns whether an address is whitelisted
     * @param who The address in question
     */
    function isWhitelisted(address who) external view returns (bool) {
        return _isWhitelisted(who);
    }

    /**
     * @dev Returns whether an address is whitelisted
     * @param who The address in question
     */
    function isRegisteredInWhitelist(address who) external view returns (bool) {
        return _getRegisteredFlagInWhitelist(who);
    }

    // Internal functions

    function _isWhitelisted(address who) internal view returns (bool) {
        return _getWhitelistedFlag(who);
    }

    function requireWhitelisted(address who) internal view {
        require(_isWhitelisted(who), "Address not whitelisted");
    }

    // Private functions

    function _pushAddressToWhitelist(address who) private returns (uint256 index) {
        require(!_isWhitelisted(who), "Address is already whitelisted");
        index = whichEternalStorage().pushAddressToArray(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_ARRAY, who);
        whichEternalStorage().setUintInAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_MAPPING, who, index);
        _setRegisteredFlagInWhitelist(who, true);
        _setWhitelistedFlag(who, true);
    }

/*
    function _deleteAddressFromWhitelist(address who) private returns (bool) {
        uint256 index = _getWhitelistedIndex(who);
        require(_isWhitelisted(who), "Address is not whitelisted");
        emit UnWhitelisted(who);
        return
            whichEternalStorage().deleteAddressFromArray(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_ARRAY, index) &&
            whichEternalStorage().deleteAddressFromAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_MAPPING, who) &&
            _setWhitelistFlag(who, false);
    }
*/

    function _getAddressInWhitelist(uint256 index) private view returns (address) {
        return whichEternalStorage().getAddressFromArray(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_ARRAY, index);
    }

    function _getIndexInWhitelist(address who) private view returns (uint256 index) {
        index = whichEternalStorage().getUintFromAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_MAPPING, who);
    }

    function _getNumberOfRegisteredAddresses() private view returns (uint256) {
        return whichEternalStorage().getNumberOfElementsInArray(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_ARRAY);
    }

    function _setWhitelistedFlag(address who, bool value) private returns (bool) {
        return whichEternalStorage().setBoolInAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_FLAGS, who, value);
    }

    function _getWhitelistedFlag(address who) private view returns (bool) {
        return whichEternalStorage().getBoolFromAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_FLAGS, who);
    }

    function _setRegisteredFlagInWhitelist(address who, bool value) private returns (bool) {
        return whichEternalStorage().setBoolInAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_REGISTRY, who, value);
    }

    function _getRegisteredFlagInWhitelist(address who) private view returns (bool) {
        return whichEternalStorage().getBoolFromAddressMapping(WHITELISTABLE_CONTRACT_NAME, _WHITELIST_REGISTRY, who);
    }

}