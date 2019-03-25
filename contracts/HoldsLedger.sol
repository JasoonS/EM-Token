pragma solidity ^0.5;

import "./EternalStorageConnector.sol";

contract HoldsLedger is EternalStorageConnector {

    using SafeMath for uint256;

    // Data structures (in eternal storage)

    bytes32 constant private HOLDSLEDGER_CONTRACT_NAME = "HoldsLedger";

    /**
     * @dev Data structures (implemented in the eternal storage):
     * @dev _HOLD_IDS : string array with hold IDs
     * @dev _HOLD_ISSUERS : address array with the issuers of the holds ("holders")
     * @dev _HOLD_FROMS : address array with the payers of the holds
     * @dev _HOLD_TOS : address array with the payees of the holds
     * @dev _HOLD_NOTARIES : address array with the notaries of the holds
     * @dev _HOLD_AMOUNTS : uint256 array with the amounts of the holds
     * @dev _HOLD_EXPIRES : bool array with the flags that mark whether holds expire or not
     * @dev _HOLD_EXPIRATIONS : uint256 array with the expirations of the holds
     * @dev _HOLD_STATUS_CODES : uint256 array with the status codes of the holds
     * @dev _HOLD_IDS_INDEXES : mapping (address => string => uint256) with the indexes for hold data
     * (this is to allow equal IDs to be used by different requesters)
     * @dev _BALANCES_ON_HOLD : mapping (address => uint256) with the total amounts on hold for each wallet
     * @dev _TOTAL_SUPPLY_ON_HOLD : Uint with the total amount on hold in the system
     */
    bytes32 constant private _HOLD_IDS =             "_holdIds";
    bytes32 constant private _HOLD_ISSUERS =         "_holdIssuers";
    bytes32 constant private _HOLD_FROMS =           "_holdFroms";
    bytes32 constant private _HOLD_TOS =             "_holdTos";
    bytes32 constant private _HOLD_NOTARIES =        "_holdNotaries";
    bytes32 constant private _HOLD_AMOUNTS =         "_holdAmounts";
    bytes32 constant private _HOLD_EXPIRES =         "_holdExpires";
    bytes32 constant private _HOLD_EXPIRATIONS =     "_holdExpirations";
    bytes32 constant private _HOLD_STATUS_CODES =    "_holdStatusCodes";
    bytes32 constant private _HOLD_IDS_INDEXES =     "_holdIdsIndexes";
    bytes32 constant private _BALANCES_ON_HOLD =     "_balancesOnHold";
    bytes32 constant private _TOTAL_SUPPLY_ON_HOLD = "_totalSupplyOnHold";

    // Modifiers

    modifier holdIndexExists(uint256 index) {
        require (index > 0 && index <= _manyHolds(), "Hold does not exist");
        _;
    }

    modifier holdExists(address issuer, string memory transactionId) {
        require (_getHoldIndex(issuer, transactionId) > 0, "Hold does not exist");
        _;
    }

    modifier holdDoesNotExist(address issuer, string memory transactionId) {
        require (_getHoldIndex(issuer, transactionId) == 0, "Hold exists");
        _;
    }

    modifier holdWithStatus(address issuer, string memory transactionId, uint256 status) {
        require (_getHoldStatus(_getHoldIndex(issuer, transactionId)) == status, "Hold with the wrong status");
        _;
    }

    // Internal functions

    function _createHold(
        address issuer,
        string  memory transactionId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 expiration,
        uint256 status
    )
        internal
        returns (uint256 index)
    {
        index = _pushNewHold(issuer, transactionId, from, to, notary, amount, expires, expiration, status);
        _addBalanceOnHold(from, amount);
    }

    function _finalizeHold(address issuer, string memory transactionId, uint256 status) internal returns (bool) {
        uint256 index = _getHoldIndex(issuer, transactionId);
        address from = _getHoldFrom(index);
        uint256 amount = _getHoldAmount(index);
        bool r1 = _substractBalanceOnHold(from, amount);
        bool r2 = _setHoldStatus(index, status);
        return r1 && r2;
    }
    
    function _holdIndex(address issuer, string memory transactionId) internal view returns(uint index) {
        return _getHoldIndex(issuer, transactionId);
    }

    function _holdFrom(address issuer, string memory transactionId) internal view returns(address from) {
        return _getHoldFrom(_getHoldIndex(issuer, transactionId));
    }

    function _holdTo(address issuer, string memory transactionId) internal view returns(address to) {
        return _getHoldTo(_getHoldIndex(issuer, transactionId));
    }

    function _holdNotary(address issuer, string memory transactionId) internal view returns(address notary) {
        return _getHoldNotary(_getHoldIndex(issuer, transactionId));
    }

    function _holdAmount(address issuer, string memory transactionId) internal view returns(uint256 amount) {
        return _getHoldAmount(_getHoldIndex(issuer, transactionId));
    }

    function _holdExpires(address issuer, string memory transactionId) internal view returns(bool expires) {
        return _getHoldExpires(_getHoldIndex(issuer, transactionId));
    }

    function _holdExpiration(address issuer, string memory transactionId) internal view returns(uint256 expiration) {
        return _getHoldExpiration(_getHoldIndex(issuer, transactionId));
    }

    function _holdStatus(address issuer, string memory transactionId) internal view returns (uint256 status) {
        return _getHoldStatus(_getHoldIndex(issuer, transactionId));
    }

    function _manyHolds() internal view returns (uint256 many) {
        return _getManyHolds();
    }

    function _balanceOnHold(address wallet) internal view returns (uint256) {
        return _getBalanceOnHold(wallet);
    }

    function _totalSupplyOnHold() internal view returns (uint256) {
        return _getTotalSupplyOnHold();
    }

    function _getHoldId(uint256 index) internal view returns (address issuer, string memory transactionId) {
        return (_getHoldIssuer(index), _getHoldTransactionId(index));
    }

    function _changeTimeToHold(address issuer, string memory transactionId, uint256 timeToExpirationFromNow) internal returns (bool) {
        return _setHoldExpiration(_getHoldIndex(issuer, transactionId), block.timestamp.add(timeToExpirationFromNow));
    }

    // Private functions

    function _getManyHolds() private view returns (uint256 many) {
        return _eternalStorage.getUintFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_IDS, 0);
    }

    function _getHoldIndex(address issuer, string memory transactionId) private view holdExists(issuer, transactionId) returns (uint256) {
        return _eternalStorage.getUintFromStringMapping(HOLDSLEDGER_CONTRACT_NAME, _HOLD_IDS_INDEXES, transactionId);
    }

    function _getHoldTransactionId(uint256 index) private view holdIndexExists(index) returns (string memory) {
        return _eternalStorage.getStringFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_IDS, index);
    }

    function _getHoldIssuer(uint256 index) private view holdIndexExists(index) returns (address) {
        return _eternalStorage.getAddressFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_ISSUERS, index);
    }

    function _getHoldFrom(uint256 index) private view holdIndexExists(index) returns (address) {
        return _eternalStorage.getAddressFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_FROMS, index);
    }

    function _getHoldTo(uint256 index) private view holdIndexExists(index) returns (address) {
        return _eternalStorage.getAddressFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_TOS, index);
    }

    function _getHoldNotary(uint256 index) private view holdIndexExists(index) returns (address) {
        return _eternalStorage.getAddressFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_NOTARIES, index);
    }

    function _getHoldAmount(uint256 index) private view holdIndexExists(index) returns (uint256) {
        return _eternalStorage.getUintFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_AMOUNTS, index);
    }

    function _getHoldExpires(uint256 index) private view holdIndexExists(index) returns (bool) {
        return _eternalStorage.getBoolFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_EXPIRES, index);
    }

    function _getHoldExpiration(uint256 index) private view holdIndexExists(index) returns (uint256) {
        return _eternalStorage.getUintFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_EXPIRATIONS, index);
    }

    function _setHoldExpiration(uint256 index, uint256 expiration) private holdIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_EXPIRATIONS, index, expiration);
    }

    function _getHoldStatus(uint256 index) private view holdIndexExists(index) returns (uint256) {
        return _eternalStorage.getUintFromArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_STATUS_CODES, index);
    }

    function _setHoldStatus(uint256 index, uint256 status) private holdIndexExists(index) returns (bool) {
        return _eternalStorage.setUintInArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_STATUS_CODES, index, status);
    }

    function _getBalanceOnHold(address wallet) private view returns (uint256) {
        return _eternalStorage.getUintFromAddressMapping(HOLDSLEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet);
    }

    function _getTotalSupplyOnHold() private view returns (uint256) {
        return _eternalStorage.getUint(HOLDSLEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD);
    }

    function _addBalanceOnHold(address wallet, uint256 amount) private returns (bool) {
        bool r1 = _eternalStorage.setUintInAddressMapping(HOLDSLEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet, _getBalanceOnHold(wallet).add(amount));
        bool r2 = _eternalStorage.setUint(HOLDSLEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD, _getTotalSupplyOnHold().add(amount));
        return r1 && r2;
    }

    function _substractBalanceOnHold(address wallet, uint256 amount) private returns (bool) {
        bool r1 = _eternalStorage.setUintInAddressMapping(HOLDSLEDGER_CONTRACT_NAME, _BALANCES_ON_HOLD, wallet, _getBalanceOnHold(wallet).sub(amount));
        bool r2 = _eternalStorage.setUint(HOLDSLEDGER_CONTRACT_NAME, _TOTAL_SUPPLY_ON_HOLD, _getTotalSupplyOnHold().sub(amount));
        return r1 && r2;
    }

    function _pushNewHold(
        address issuer,
        string  memory transactionId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool    expires,
        uint256 expiration,
        uint256 status
    )
        internal
        holdDoesNotExist(issuer, transactionId)
        returns (uint256)
    {
        _eternalStorage.pushStringToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_IDS, transactionId);
        _eternalStorage.pushAddressToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_ISSUERS, issuer);
        _eternalStorage.pushAddressToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_FROMS, from);
        _eternalStorage.pushAddressToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_TOS, to);
        _eternalStorage.pushAddressToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_NOTARIES, notary);
        _eternalStorage.pushUintToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_AMOUNTS, amount);
        _eternalStorage.pushUintToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_EXPIRATIONS, expiration);
        _eternalStorage.pushBoolToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_EXPIRES, expires);
        _eternalStorage.pushUintToArray(HOLDSLEDGER_CONTRACT_NAME, _HOLD_STATUS_CODES, status);
        return _recordIndexInMapping(issuer, transactionId, _getManyHolds());
    }

    function _recordIndexInMapping(address issuer, string memory transactionId, uint256 index) private returns (uint256){
        _eternalStorage.setUintInDoubleAddressStringMapping(HOLDSLEDGER_CONTRACT_NAME, _HOLD_IDS_INDEXES, issuer, transactionId, index);
        return index;
    }

}
