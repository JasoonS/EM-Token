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

    // External functions

    // ERC20
    
    function checkTransfer(address from, address to, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkTransfer(from, to, value);
    }

    function checkApprove(address owner, address spender, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkApprove(owner, spender, value);
    }

    // Holdable

    function checkHold(address from, address to, address notary, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkHold(from, to, notary, value);
    }

    function checkApproveToHold(address payer, address holder) external view
        returns (bool canDo, string memory reason)
    {
        return _checkApproveToHold(payer, holder);
    }

    // Clearable
    
    function checkApproveToOrderClearedTransfer(address fromWallet, address requester) external view
        returns (bool canDo, string memory reason)
    {
        return _checkApproveToOrderClearedTransfer(fromWallet, requester);
    }

    function checkOrderClearedTransfer(address from, address to, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkOrderClearedTransfer(from, to, value);
    }

    // Fundable
    
    function checkApproveToRequestFunding(address walletToFund, address requester) external view
        returns (bool canDo, string memory reason)
    {
        return _checkApproveToRequestFunding(walletToFund, requester);
    }

    function checkRequestFunding(address walletToFund, address requester, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkRequestFunding(walletToFund, requester, value);
    }

    // Payoutable
    
    function checkApproveToRequestPayout(address walletToDebit, address requester) external view
        returns (bool canDo, string memory reason)
    {
        return _checkApproveToRequestPayout(walletToDebit, requester);
    }

    function checkRequestPayout(address walletToDebit, address requester, uint256 value) external view
        returns (bool canDo, string memory reason)
    {
        return _checkRequestPayout(walletToDebit, requester, value);
    }


    // Internal functions

    // ERC20
    
    function _checkTransfer(address from, address to, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(from)) {
            reason = "Sender is not whitelisted";
        } else if(!_isWhitelisted(to)) {
            reason = "Receiver is not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    function _checkApprove(address allower, address spender, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(allower)) {
            reason = "Allower is not whitelisted";
        } else if(!_isWhitelisted(spender)) {
            reason = "Spender is not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    // Holdable

    function _checkHold(address payer, address payee, address notary, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(payer)) {
            reason = "Payer is not whitelisted";
        } else if(!_isWhitelisted(payee)) {
            reason = "Payee is not whitelisted";
        } else if(notary != address(0) && !_isWhitelisted(notary)) {
            reason = "Notary is not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    function _checkApproveToHold(address payer, address holder) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(payer)) {
            reason = "Payer is not whitelisted";
        } else if(!_isWhitelisted(holder)) {
            reason = "Holder is not whitelisted";
        } else {
            canDo = true;
        }
    }

    // Clearable
    
    function _checkApproveToOrderClearedTransfer(address fromWallet, address requester) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(fromWallet)) {
            reason = "Wallet to debit not whitelisted";
        } else if(!_isWhitelisted(requester)) {
            reason = "Requester not whitelisted";
        } else {
            canDo = true;
        }
    }

    function _checkOrderClearedTransfer(address fromWallet, address toWallet, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(fromWallet)) {
            reason = "Wallet to debit not whitelisted";
        } else if(!_isWhitelisted(toWallet)) {
            reason = "Requester not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    // Fundable
    
    function _checkApproveToRequestFunding(address walletToFund, address requester) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(walletToFund)) {
            reason = "Wallet to fund not whitelisted";
        } else if(!_isWhitelisted(requester)) {
            reason = "Requester not whitelisted";
        } else {
            canDo = true;
        }
    }

    function _checkRequestFunding(address walletToFund, address requester, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(walletToFund)) {
            reason = "Wallet to fund not whitelisted";
        } else if(!_isWhitelisted(requester)) {
            reason = "Requester not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    // Payoutable
    
    function _checkApproveToRequestPayout(address walletToDebit, address requester) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(walletToDebit)) {
            reason = "Wallet to debit not whitelisted";
        } else if(!_isWhitelisted(requester)) {
            reason = "Requester not whitelisted";
        } else {
            canDo = true;
        }
    }

    function _checkRequestPayout(address walletToDebit, address requester, uint256 value) internal view
        returns (bool canDo, string memory reason)
    {
        if(!_isWhitelisted(walletToDebit)) {
            reason = "Wallet to debit not whitelisted";
        } else if(!_isWhitelisted(requester)) {
            reason = "Requester not whitelisted";
        } else if(value > MAX_VALUE) {
            reason = "Amount too big";
        } else {
            canDo = true;
        }
    }

    // Generic functions to check

    function _check(bool test) internal pure {
        require(test, "Check failed");
    }

    function _check(
        function(address, address, address, uint256) returns (bool, string memory) checkFunction,
        address a,
        address b,
        address c,
        uint256 d
    )
        internal
    {
        bool test;
        string memory reason;
        (test, reason) = checkFunction(a, b, c, d);
        require(test, reason);
    }

    function _check(
        function(address, address, uint256) returns (bool, string memory) checkFunction,
        address a,
        address b,
        uint256 c
    )
        internal
    {
        bool test;
        string memory reason;
        (test, reason) = checkFunction(a, b, c);
        require(test, reason);
    }

    function _check(function(address, address) returns (bool, string memory) checkFunction, address a, address b) internal {
        bool test;
        string memory reason;
        (test, reason) = checkFunction(a, b);
        require(test, reason);
    }

    function _check(function(address) returns (bool, string memory) checkFunction, address a) internal {
        bool test;
        string memory reason;
        (test, reason) = checkFunction(a);
        require(test, reason);
    }

}
