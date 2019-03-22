var Migrations = artifacts.require("Migrations");
var EMoneyToken = artifacts.require("EMoneyToken");

module.exports = function(deployer, network, accounts) {
    deployer.deploy(Migrations, {from: accounts[0], gas: 4700000, gasPrice: 0});
//    deployer.deploy(Migrations, {from: "fe3b557e8fb62b89f4916b721be55ceb828dbd73", gas: 4700000, gasPrice: 0});
    deployer.deploy(EMoneyToken, "Test EMoneyToken", "EMT-EUR", "EUR", 2, "0x76dD02b760968079B4d9Ba9E12C8c42D248A08E8", {from:accounts[0], gas: 50000000, gasPrice:0});
//    deployer.deploy(EMoneyToken, "Test EMoneyToken", "EMT-EUR", "EUR", 2, "0x0000000000000000000000000000000000000000", {from:accounts[0], gas: 50000000, gasPrice:0});
//    deployer.deploy(EMoneyToken, "Test EMoneyToken", "EMT-EUR", "EUR", 2, "0x0000000000000000000000000000000000000000", {from:"0xfe3b557e8fb62b89f4916b721be55ceb828dbd73", gas: 50000000, gasPrice:0});
};
