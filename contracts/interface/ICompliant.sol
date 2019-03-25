pragma solidity ^0.5;

interface ICompliant {
    
    // Basic ERC20
    
    function canTransfer(address from, address to, uint256 value) external view returns (bytes32 status);
    function canApprove(address allower, address spender, uint256 value) external view returns (bytes32 status);

    // Hold

    function canHold(address from, address to, address notary, uint256 value) external view returns (bytes32 status);
    function canApproveToHold(address from, address holder) external view returns (bytes32 status);

    // Clearable

    function canApproveToOrderClearableTransfer(address fromWallet, address orderer) external view returns (bytes32 status);
    function canOrderClearableTransfer(address fromWallet, address toWallet, uint256 value) external view returns (bytes32 status);

    // Fundable

    function canApproveToOrderFunding(address walletToFund, address orderer) external view returns (bytes32 status);
    function canOrderFunding(address walletToFund, address orderer, uint256 value) external view returns (bytes32 status);
        
    // Payoutable

    function canApproveToOrderPayout(address walletToDebit, address orderer) external view returns (bytes32 status);
    function canOrderPayout(address walletToDebit, address orderer, uint256 value) external view returns (bytes32 status);

}