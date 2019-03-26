pragma solidity ^0.5;

import "./interface/ICompliant.sol";
import "./ConsolidatedLedger.sol";
import "./Whitelistable.sol";

/**
 * @title Compliant
 * @dev This contract implements check methods that can be called upstream or from outside. By doing a "require"
 * on this methods one can check whether user-initiated methods (e.g. transfer) can actually be executed due to
 * compliance restrictions (e.g. only whitelisted users should be able to send or receive in transfer methods)
 * @dev Intermediate data is used in this contract as well (implemented over the EternalStorage construct) in
 * order to implement permissioning logic (e.g. whitelisting flags, or cumulative cashins or cashouts to check
 * cumulative limits)
 */
contract Compliant is ICompliant, ConsolidatedLedger, Whitelistable {

    uint256 constant MAX_VALUE = 2**256 - 1;
    byte constant FAILURE = 0x00;
    byte constant SUCCESS = 0x01;

    // External functions

    // ERC20
    
    function canTransfer(address from, address to, uint256 value) external view
        returns (byte status)
    {
        return _canTransfer(from, to, value);
    }

    function canApprove(address owner, address spender, uint256 value) external view
        returns (byte status)
    {
        return _canApprove(owner, spender, value);
    }

    // Holdable

    function canHold(address from, address to, address notary, uint256 value) external view
        returns (byte status)
    {
        return _canHold(from, to, notary, value);
    }

    function canApproveToHold(address payer, address holder) external view
        returns (byte status)
    {
        return _canApproveToHold(payer, holder);
    }

    // Clearable
    
    function canApproveToOrderClearableTransfer(address fromWallet, address requester) external view
        returns (byte status)
    {
        return _canApproveToOrderClearableTransfer(fromWallet, requester);
    }

    function canOrderClearableTransfer(address from, address to, uint256 value) external view
        returns (byte status)
    {
        return _canOrderClearableTransfer(from, to, value);
    }

    // Fundable
    
    function canApproveToOrderFunding(address walletToFund, address requester) external view
        returns (byte status)
    {
        return _canApproveToOrderFunding(walletToFund, requester);
    }

    function canOrderFunding(address walletToFund, address requester, uint256 value) external view
        returns (byte status)
    {
        return _canOrderFunding(walletToFund, requester, value);
    }

    // Payoutable
    
    function canApproveToOrderPayout(address walletToDebit, address requester) external view
        returns (byte status)
    {
        return _canApproveToOrderPayout(walletToDebit, requester);
    }

    function canOrderPayout(address walletToDebit, address requester, uint256 value) external view
        returns (byte status)
    {
        return _canOrderPayout(walletToDebit, requester, value);
    }


    // Internal functions

    // ERC20
    
    function _canTransfer(address from, address to, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(from) || !_isWhitelisted(to) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    function _canApprove(address allower, address spender, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(allower) || !_isWhitelisted(spender) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    // Holdable

    function _canHold(address payer, address payee, address notary, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(payer) || !_isWhitelisted(payee) || (notary != address(0) && !_isWhitelisted(notary)) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    function _canApproveToHold(address payer, address holder) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(payer) || !_isWhitelisted(holder)) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    // Clearable
    
    function _canApproveToOrderClearableTransfer(address fromWallet, address requester) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(fromWallet) || !_isWhitelisted(requester)) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    function _canOrderClearableTransfer(address fromWallet, address toWallet, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(fromWallet) || !_isWhitelisted(toWallet) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    // Fundable
    
    function _canApproveToOrderFunding(address walletToFund, address requester) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(walletToFund) || !_isWhitelisted(requester)) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    function _canOrderFunding(address walletToFund, address requester, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(walletToFund) || !_isWhitelisted(requester) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    // Payoutable
    
    function _canApproveToOrderPayout(address walletToDebit, address requester) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(walletToDebit) || !_isWhitelisted(requester)) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    function _canOrderPayout(address walletToDebit, address requester, uint256 value) internal view
        returns (byte status)
    {
        if(!_isWhitelisted(walletToDebit) || !_isWhitelisted(requester) || value > MAX_VALUE) {
            return FAILURE;
        } else {
            return SUCCESS;
        }
    }

    // Generic functions to check

    function _check(bool test) internal pure {
        require(test, "Check failed");
    }

    function _check(
        function(address, address, address, uint256) returns (byte) checkFunction,
        address a,
        address b,
        address c,
        uint256 d
    )
        internal
    {
        byte status = checkFunction(a, b, c, d);
        require(status == SUCCESS, "Compliance check failed");
    }

    function _check(
        function(address, address, uint256) returns (byte) checkFunction,
        address a,
        address b,
        uint256 c
    )
        internal
    {
        byte status = checkFunction(a, b, c);
        require(status == SUCCESS, "Compliance check failed");
    }

    function _check(function(address, address) returns (byte) checkFunction, address a, address b) internal {
        byte status = checkFunction(a, b);
        require(status == SUCCESS, "Compliance check failed");
    }

    function _check(function(address) returns (byte) checkFunction, address a) internal {
        byte status = checkFunction(a);
        require(status == SUCCESS, "Compliance check failed");
    }

}
