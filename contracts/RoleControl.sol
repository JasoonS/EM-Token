pragma solidity ^0.5;

import "./libraries/Roles.sol";
import "./libraries/Strings.sol";
import "../../EternalStorage/contracts/EternalStorageConnector.sol";

/**
 * @title RoleControl
 * @dev The RoleControl contract implements a generic role modifier that can be used to control role
 * based access to contract methods. It works in a similar fashion to the *Role contracts in OpenZeppelin
 * in https://github.com/OpenZeppelin/openzeppelin-solidity/tree/master/contracts/access/rolescd (e.g. MinterRole.sol),
 * but all the methods take a string parameter to denote a specific role. This way, OpenZeppelin's MinterRole's
 * OnlyMinter() modifier can be implemented as OnlyRole("minter")
 * @dev This has already been migrated to the EternalStorage construct, so all storage variables are used through
 * the EternalStorageWrapper
 * @dev Since roles data are stored in the EternalStorage, no roles can be assigned in the constructor (because
 * EternalStorage needs to be connected after construction). Required roles need to be assigned for the first time upon
 * connection to EternalStorage
 * @dev RoleControl inherits Ownable through EternalStorageWrapper, which in turn inherits from EternalStorageWrapperBase,
 * which is Ownable. Therefore onlyOwner is still used for technical admin purposes throughout the contract
 */
contract RoleControl is EternalStorageConnector {

    using Roles for Roles.Role;
    using Strings for string;

    // Roles

    /**
     * @notice CRO_ROLE is the predefined role with rights to change credit limits.
     */
    string constant public CRO_ROLE = "cro";

    /**
     * @notice OPERATOR_ROLE is the predefined role with rights to perform ledger-related operations, such as
     * honoring funding and redemption requests or clearing transfers
     */
    string constant public OPERATOR_ROLE = "operator";

    /**
     * @notice COMPLIANCE_ROLE is the predefined role with rights to whitelist address, e.g. after checking
     * KYC status
     */
    string constant public COMPLIANCE_ROLE = "compliance";

    // Data structures (in eternal storage)

    bytes32 constant private ROLECONTROL_CONTRACT_NAME = "RoleControl";

    /**
     * @dev Data structures
     * @dev _ROLES :mapping (string => mapping (address => bool)) storing the repository of roles
     */
    bytes32 constant private _ROLES = "_roles";

    // Events
    
    event RoleAdded(address indexed account, string role);
    event RoleRevoked(address indexed account, string role);

    // Constructor

    // Interface functions

    /**
     * @notice Returns whether an address has a specific role
     * @param account The address being r
     * @param role The role being checked
     */
    function hasRole(address account, string calldata role) external view returns (bool) {
        return _hasRole(account, role);
    }

    /**
     * @notice Gives a role to an address
     * @dev Only an address with the Admin role can add roles
     * @param account The address to which the role is going to be given
     * @param role The role being given
     */
    function addRole(address account, string calldata role) external onlyOwner returns (bool) {
        require(account != address(0), "Cannot add role to address 0");
        return _addRole(account, role);
    }

    /**
     * @notice Revokes a role from a particular address
     * @dev Only an address with the Admin role can revoke roles
     * @param account The address being revoked
     * @param role The role being revoked
     */
    function revokeRole(address account, string calldata role) external onlyOwner returns (bool) {
        require(account != address(0), "Cannot revoke role from address 0");
        return _removeRole(account, role);
    }

    // Internal functions

    function requireRole(string memory role) internal view {
        require(_hasRole(msg.sender, role), string("Sender does not have role ").concat(role));
    } 

    // Private functions

    function _addRole(address _account, string memory _role) private returns (bool) {
        emit RoleAdded(_account, _role);
        return whichEternalStorage().setBoolInDoubleAddressStringMapping(ROLECONTROL_CONTRACT_NAME, _ROLES, _account, _role, true);
    }

    function _removeRole(address _account, string memory _role) private returns (bool) {
        emit RoleRevoked(_account, _role);
        return whichEternalStorage().deleteBoolFromDoubleAddressStringMapping(ROLECONTROL_CONTRACT_NAME, _ROLES, _account, _role);
    }

    function _hasRole(address _account, string memory _role) public view returns (bool) {
        return whichEternalStorage().getBoolFromDoubleAddressStringMapping(ROLECONTROL_CONTRACT_NAME, _ROLES, _account, _role);
    }

}