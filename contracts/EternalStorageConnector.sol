pragma solidity ^0.5;

import "../../EternalStorage/contracts/EternalStorage.sol";
import "../../EternalStorage/contracts/Ownable.sol";

/**
 * @title EternalStorageConnectort
 * @dev The EternalStorageConnector can be inherited by contracts that want to use the EternalStorage construct
 * @dev Elements in the storage should be referenced using a "module" and a "variable" names, plus one or several
 * indices in the case of complex types such as arrays or mappings. This way different components (e.g. different
 * contracts inherited by the same contract) can use variables with identical names. Note that only one contract
 * instance can connect to an Eternal Storage instance
 * @dev The wrapper needs to be connected to the EternalStorage instance to start operating normally. The correct
 * sequence is:
 * 1. Instantiate EternalStorage and the contract inheriting the EternalStorageWrapper
 * 2. Call the connectContract() method in EternalStorage to whitelist the wrapper
 * 3. Call the setEternalStorage() method in EternalStorageWrapper to connect to the storage. Note that this will
 *    fail if the wrapper is not previously whitelisted
 */
contract EternalStorageConnector is Ownable {

    EternalStorage internal _eternalStorage;

    event EternalStorageSet(address oldEternalStorage, address newEternalStorage);

    modifier externalStorageSet() {
        require(isEternalStorageSet(), "Eternal Storage not set");
        _;
    }

    function isEternalStorageSet() public view returns(bool) {
        return _eternalStorage.isContractConnected(address(this));
    }

    function whichEternalStorage() public view returns(EternalStorage) {
        return _eternalStorage;
    }

    function setEternalStorage(address newEternalStorage) public onlyOwner returns (bool) {
        require(newEternalStorage != address(0), "Storage address cannot be zero");
        emit EternalStorageSet(address(_eternalStorage), newEternalStorage);
        _eternalStorage = EternalStorage(newEternalStorage);
        _eternalStorage.connectContract();
        return true;
    }

}