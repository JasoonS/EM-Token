pragma solidity ^0.5;

interface ICompliant {
    
    // Basic ERC20
    
    function checkTransfer(address from, address to, uint256 value) external view
        returns (bool canDo, string memory reason);

    function checkApprove(address owner, address spender, uint256 value) external view
        returns (bool canDo, string memory reason);

    // Hold
    
    function checkHold(address from, address to, address notary, uint256 value) external view
        returns (bool canDo, string memory reason);

    function checkApproveToHold(address payer, address holder) external view
        returns (bool canDo, string memory reason);

    // Clearable
    
    function checkApproveToOrderClearedTransfer(address fromWallet, address requester) external view
        returns (bool canDo, string memory reason);

    function checkOrderClearedTransfer(address from, address to, uint256 value) external view
        returns (bool canDo, string memory reason);

    // Fundable
    
    function checkApproveToRequestFunding(address walletToFund, address requester) external view
        returns (bool canDo, string memory reason);

    function checkRequestFunding(address walletToFund, address requester, uint256 value) external view
        returns (bool canDo, string memory reason);

    // Payoutable
    
    function checkApproveToRequestPayout(address walletToDebit, address requester) external view
        returns (bool canDo, string memory reason);

    function checkRequestPayout(address walletToDebit, address requester, uint256 value) external view
        returns (bool canDo, string memory reason);

}