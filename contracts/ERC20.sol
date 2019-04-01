pragma solidity ^0.5;

import "./Compliant.sol";
import "./interface/IERC20.sol";

/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic functions of the standard token
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
 */
contract ERC20 is IERC20, Compliant {

    using SafeMath for uint256;

    // External state-modifying functions

    /**
    * @notice Transfer token to a specified address
    * @param to The address to transfer to.
    * @param value The amount to be transferred.
    */
    function transfer(address to, uint256 value) external returns (bool) {
        _check(_canTransfer, msg.sender, to, value);
        return _transfer(msg.sender, to, value);
    }

    /**
     * @notice Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function approve(address spender, uint256 value) external returns (bool) {
        _check(_canApprove, msg.sender, spender, value);
        _approve(msg.sender, spender, value);
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another.
     * Note that while this function emits an Approval event, this is not required as per the specification,
     * and other compliant implementations may not emit the event.
     * @param from address The address which you want to send tokens from
     * @param to address The address which you want to transfer to
     * @param value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _check(_canTransfer, from, to, value);
        uint256 newApproval = _allowance(from, msg.sender).sub(value);
        _approve(from, msg.sender, newApproval);
        emit Approval(from, msg.sender, newApproval);
        return _transfer(from, to, value);
    }

    // External functions to be called by operators

    /**
     * @notice Method to directly mint / add tokens to a wallet. This is intended to be used in tokenization
     * processes not initiated through the blockchain (i.e. by calling orderFunding), but through an external
     * channel - e.g. the user directly sending a bank transfer to the omnibus account and the tokenizer
     * consequently minting the funds into the token contract through this mint function
     * @param to The wallet to which the funds are to be added
     * @param referenceId An external reference associated to this mint operation, e.g. the internal tx ID
     * of the transfer to the omnibus account
     * @param value The amount of tokens minted
     * @dev Note that adding funds to the wallet doesn't necessarily imply adding them to the balance, since
     * they can also be used to reduced the drawn amount from the overdraft line
     * @dev Only the operator can call this function
     */
    function mint(address to, string calldata referenceId, uint256 value) external returns (bool) {
        requireRole(OPERATOR_ROLE);
        emit Mint(to, referenceId, value);
        _addFunds(to, value);
        return true;
    }

    /**
     * @notice Method to directly burn / remove tokens from a wallet. This is intended to be used in
     * detokenization processes not initiated through the blockchain (i.e. by calling orderPayout), but
     * through an external channel - e.g. the user directly asking for this in a mobile wallet or banking
     * application of some sort.
     * @param from The wallet from which the funds are to be removed
     * @param referenceId An external reference associated to this burn operation, e.g. the internal tx ID
     * of the transfer from the omnibus account
     * @param value The amount of tokens burned
     * @dev Note that removing funds from the wallet doesn't necessarily imply removing them from the
     * balance, since they can also be drawn from the overdraft line if there is enough available limit
     * @dev Only the operator can call this function
     * @dev Note that even though this is to be called by the operator, the user is required to have enough
     * available funds in order to support the burn operation. If this is not the case, the operator is
     * supposed to increase the overdraft limit before burning (also, direct writes can also be done in
     * emergency situations, as described in the ConsolidatedLedger contract)
     */
    function burn(address from, string calldata referenceId, uint256 value) external returns (bool) {
        requireRole(OPERATOR_ROLE);
        require(_availableFunds(from) >= value, "Not enough available funds to burn");
        emit Burn(from, referenceId, value);
        _removeFunds(from, value);
        return true;
    }


    // Additional (non standard) user functions

    /**
     * @notice Method to increase approval
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function increaseApproval(address spender, uint256 value) external returns (bool) {
        uint256 newApproval = _allowance(msg.sender, spender).add(value);
        _check(_canApprove, msg.sender, spender, newApproval);
        _approve(msg.sender, spender, newApproval);
        emit Approval(msg.sender, spender, newApproval);
        return true;
    }

    /**
     * @notice Method to decrease approval
     * @param spender The address which will spend the funds.
     * @param value The amount of tokens to be spent.
     */
    function decreaseApproval(address spender, uint256 value) external returns (bool) {
        uint256 newApproval = _allowance(msg.sender, spender).sub(value);
        _check(_canApprove, msg.sender, spender, newApproval);
        _approve(msg.sender, spender, newApproval);
        emit Approval(msg.sender, spender, newApproval);
        return true;
    }

    // External view functions

    /**
    * @notice Total number of tokens in existence
    */
    function totalSupply() external view returns (uint256) {
        return _totalSupply();
    }

    /**
    * @notice Gets the balance of the specified address.
    * @param wallet The address to query the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address wallet) external view returns (uint256) {
        return _balanceOf(wallet);
    }

    /**
     * @notice Function to check the amount of tokens that an owner allowed to a spender.
     * @param owner address The address which owns the funds.
     * @param spender address The address which will spend the funds.
     * @return A uint256 specifying the amount of tokens still available for the spender.
     */
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowance(owner, spender);
    }

    // Internal functions

    function _transfer(address from, address to, uint256 value) internal returns (bool) {
        _removeFunds(from, value);
        _addFunds(to, value);
        emit Transfer(from, to, value);
        return true;
    }

}
