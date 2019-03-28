const EMoneyToken = artifacts.require("EMoneyToken");
const truffleAssert = require('truffle-assertions'); // install with: npm install truffle-assertions

var FundingStatusCode = Object.freeze({"Nonexistent":0, "Ordered":1, "InProcess":2, "Executed":3, "Rejected":4, "Cancelled":5});

contract("EMoneyToken", accounts => {
    var instance
    var owner = accounts[9]
    var cro = accounts[8]
    var operator = accounts[7]
    var compliance = accounts[6]
    var userAccount1 = accounts[5]
    var userAccount2 = accounts[4]
    var userAccount3 = accounts[3]
    var notary1 = accounts[2]
    var notWhilisted1 = accounts[1]
    var notWhilisted2 = accounts[0]
  
    var Name = 'Test EMoneyToken'
    var Symbol = 'EMT-EUR'
    var Currency = 'EUR'
    var Decimals = 2
    var Version = "0.1.0"

    const FAILURE = 0x00;
    const SUCCESS = 0x01;

    var EternalStorageAddr = "0x76dD02b760968079B4d9Ba9E12C8c42D248A08E8"
    var ZeroAddr = "0x0000000000000000000000000000000000000000"
  
    const CRO_ROLE = "cro";
    const OPERATOR_ROLE = "operator";
    const COMPLIANCE_ROLE = "compliance";

    const FUNDING_ID1 = "FundingID1";
    const FUNDING_ID2 = "FundingID2";
    const FUNDING_ID3 = "FundingID3";
    const FUNDING_ID4 = "FundingID4";
    const FUNDING_ID5 = "FundingID5";

    // runs before all tests
    before(done => {
        EMoneyToken.new(Name,Symbol, Currency, Decimals, ZeroAddr, {from: owner, gas: 500000000})
        .then(_instance => {
            instance = _instance;
        })
        .then(done).catch(done);
    });

    //Now testing EM Token informational parameters (set at instantiation)

    it("Should start with the correct name", done => {
        instance.name.call().then(_name => {
            assert.equal(_name, Name, "Name not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct symbol", done => {
        instance.symbol.call().then(_symbol => {
            assert.equal(_symbol, Symbol, "Symbol not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct currency", done => {
        instance.currency.call().then(_currency => {
            assert.equal(_currency, Currency, "Currency not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct number of decimals", done => {
        instance.decimals.call().then(_decimals => {
            assert.equal(_decimals, Decimals, "Decimals not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should have the correct version", done => {
        instance.version.call().then(_version => {
            assert.equal(_version, Version, "Wrong version!");
        })
        .then(done).catch(done);
    });


    // Now testing ownership

    it("Should start with the correct owner", done => {
        instance.owner.call().then(_owner => {
            assert.equal(_owner, owner, "Owner not set correctly");
        })
        .then(done).catch(done);
    });

    it("Function isOwner() should return true when called from owner address", done => {
        instance.isOwner.call({from:owner}).then(_result => {
            assert.equal(_result, true, "isOwner returned false");
        })
        .then(done).catch(done);
    });

    it("Function isOwner() should return false when called from a non owner address", done => {
        instance.isOwner.call({from:userAccount1}).then(_result => {
            assert.equal(_result, false, "isOwner returned true");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to transfer ownership", done => {
        instance.transferOwnership(userAccount1, {from:owner}).then(_tx => {
            var event = _tx.logs[0];
            assert.equal(event.event, "OwnershipTransferred", "OwnershipTransferred event not issued");
            assert.equal(event.args.previousOwner, owner, "Incorrect argument in OwnershipTransferred event");
            assert.equal(event.args.newOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
            instance.owner.call().then(_owner => {
                assert.equal(_owner, userAccount1, "Owner not transferred correctly");
            })
        })
        .then(done).catch(done);
    });

    it('Non owner should not be able to transfer ownership', async () => {
        await truffleAssert.reverts(instance.transferOwnership(owner, {from:owner}), "", "Was able to transfer ownership");
    })

    it("New owner should be able to transfer ownership", done => {
        instance.transferOwnership(owner, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "OwnershipTransferred", "OwnershipTransferred event not issued");
            assert.equal(event.args.previousOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
            assert.equal(event.args.newOwner, owner, "Incorrect argument in OwnershipTransferred event");
            instance.owner.call().then(_owner => {
                assert.equal(_owner, owner, "Owner not transferred correctly");
            })
        })
        .then(done).catch(done);
    });

    // Now creating roles
    
    it("Owner should not have explicit roles", done => {
        instance.hasRole.call(owner, CRO_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Owner should not have explicit roles", done => {
        instance.hasRole.call(owner, OPERATOR_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Owner should not have explicit roles", done => {
        instance.hasRole.call(owner, COMPLIANCE_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Users should not have explicit roles before creating them", done => {
        instance.hasRole.call(cro, CRO_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Users should not have explicit roles before creating them", done => {
        instance.hasRole.call(operator, OPERATOR_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Users should not have explicit roles before creating them", done => {
        instance.hasRole.call(compliance, COMPLIANCE_ROLE).then(_result => {
            assert.equal(_result, false, "Should not have role before defining it");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to add roles", done => {
        instance.addRole(cro, CRO_ROLE, {from:owner}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "RoleAdded", "RoleAdded event not issued");
            assert.equal(event.args.account, cro, "Incorrect argument in RoleAdded event");
            assert.equal(event.args.role, CRO_ROLE, "Incorrect argument in RoleAdded event");
            instance.hasRole.call(cro, CRO_ROLE).then(_result => {
                assert.equal(_result, true, "Role has not been added");
            })
        })
        .then(done).catch(done);
    });

    it('Non owner should not be able to add roles', async () => {
        await truffleAssert.reverts(instance.addRole(userAccount1, CRO_ROLE, {from:userAccount1}), "", "Was able to add role");
    })

    it("Owner should be able to add roles", done => {
        instance.addRole(userAccount1, CRO_ROLE, {from:owner}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "RoleAdded", "RoleAdded event not issued");
            assert.equal(event.args.account, userAccount1, "Incorrect argument in RoleAdded event");
            assert.equal(event.args.role, CRO_ROLE, "Incorrect argument in RoleAdded event");
            instance.hasRole.call(userAccount1, CRO_ROLE).then(_result => {
                assert.equal(_result, true, "Role has not been added");
            })
        })
        .then(done).catch(done);
    });

    it("Owner should be able to add roles", done => {
        instance.addRole(operator, OPERATOR_ROLE, {from:owner}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "RoleAdded", "RoleAdded event not issued");
            assert.equal(event.args.account, operator, "Incorrect argument in RoleAdded event");
            assert.equal(event.args.role, OPERATOR_ROLE, "Incorrect argument in RoleAdded event");
            instance.hasRole.call(operator, OPERATOR_ROLE).then(_result => {
                assert.equal(_result, true, "Role has not been added");
            })
        })
        .then(done).catch(done);
    });

    it("Owner should be able to add roles", done => {
        instance.addRole(compliance, COMPLIANCE_ROLE, {from:owner}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "RoleAdded", "RoleAdded event not issued");
            assert.equal(event.args.account, compliance, "Incorrect argument in RoleAdded event");
            assert.equal(event.args.role, COMPLIANCE_ROLE, "Incorrect argument in RoleAdded event");
            instance.hasRole.call(compliance, COMPLIANCE_ROLE).then(_result => {
                assert.equal(_result, true, "Role has not been added");
            })
        })
        .then(done).catch(done);
    });

    it("Owner should be able to revoke roles", done => {
        instance.revokeRole(userAccount1, CRO_ROLE, {from:owner}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "RoleRevoked", "RoleRevoked event not issued");
            assert.equal(event.args.account, userAccount1, "Incorrect argument in RoleRevoked event");
            assert.equal(event.args.role, CRO_ROLE, "Incorrect argument in RoleRevoked event");
            instance.hasRole.call(userAccount1, CRO_ROLE).then(_result => {
                assert.equal(_result, false, "Role has not been revoked");
            })
        })
        .then(done).catch(done);
    });

    // Now testing Whitelisting

    it("Should start with zero whitelisted addresses", done => {
        instance.manyRegisteredAddresses.call().then(_result => {
            assert.equal(_result, 0, "Did not start with zero wallets");
        })
        .then(done).catch(done);
    });
    
    it("isWhitelisted() should return false for not (yet) whitelisted wallets (1)", done => {
        instance.isWhitelisted.call(userAccount1).then(_result => {
            assert.equal(_result, false, "isWhitelisted returned true!");
        })
        .then(done).catch(done);
    });
    
    it("isWhitelisted() should return false for not (yet) whitelisted wallets (2)", done => {
        instance.isWhitelisted.call(userAccount2).then(_result => {
            assert.equal(_result, false, "isWhitelisted returned true!");
        })
        .then(done).catch(done);
    });
    
    it("Compliance officer should be able to whitelist addresses (user1)", done => {
        instance.whitelist(userAccount1, {from:compliance}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            assert.equal(event.args.index, 0, "Incorrect argument in Whitelisted event");
            instance.manyRegisteredAddresses.call().then(_result => {
                assert.equal(_result, 1, "New wallet not added to the array");
            })
            instance.isWhitelisted.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User not whitelisted");
            })
            instance.isRegisteredInWhitelist.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User not registered");
            })
            instance.indexInWhitelist.call(userAccount1).then(_position => {
                assert.equal(_position, 0, "Wallet not found in array");
            })
            instance.addressInWhitelist.call(0).then(_address => {
                assert.equal(_address, userAccount1, "Wallet not added correctly");
            })
        })
        .then(done).catch(done);
    });

    it("Compliance officer should be able to whitelist addresses (user2)", done => {
        instance.whitelist(userAccount2, {from:compliance}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount2, "Incorrect argument in Whitelisted event");
            assert.equal(event.args.index, 1, "Incorrect argument in Whitelisted event");
            instance.manyRegisteredAddresses.call().then(_result => {
                assert.equal(_result, 2, "New wallet not added to the array");
            })
            instance.isWhitelisted.call(userAccount2).then(_result => {
                assert.equal(_result, true, "User not whitelisted");
            })
            instance.isRegisteredInWhitelist.call(userAccount2).then(_result => {
                assert.equal(_result, true, "User not registered");
            })
            instance.indexInWhitelist.call(userAccount2).then(_position => {
                assert.equal(_position, 1, "Wallet not found in array");
            })
            instance.addressInWhitelist.call(1).then(_address => {
                assert.equal(_address, userAccount2, "Wallet not added correctly");
            })
        })
        .then(done).catch(done);
    });

    it('Anyone who is not a compliance officer should not be able to whitelist addresses', async () => {
        await truffleAssert.reverts(instance.whitelist(userAccount3, {from:owner}), "", "Was able to whitelist address");
    });

    it("Compliance officer should be able to unwhitelist an address", done => {
        instance.unWhitelist(userAccount1, {from:compliance}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "UnWhitelisted", "UnWhitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            instance.manyRegisteredAddresses.call().then(_result => {
                assert.equal(_result, 2, "Wallet array changed on unwhitelisting");
            })
            instance.isWhitelisted.call(userAccount1).then(_result => {
                assert.equal(_result, false, "User still whitelisted");
            })
            instance.isRegisteredInWhitelist.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User not registered");
            })
            instance.indexInWhitelist.call(userAccount1).then(_position => {
                assert.equal(_position, 0, "Wallet not found in array");
            })
            instance.addressInWhitelist.call(0).then(_address => {
                assert.equal(_address, userAccount1, "Wallet not added correctly");
            })
        })
        .then(done).catch(done);
    });

    it("isWhitelisted should return true on whitelisted address", done => {
        instance.isWhitelisted.call(userAccount2).then(_result => {
            assert.equal(_result, true, "Whitelisted address returned false");
        })
        .then(done).catch(done);
    });

    it("isWhitelisted should return false on non whitelisted address", done => {
        instance.isWhitelisted.call(userAccount3).then(_result => {
            assert.equal(_result, false, "Non whitelisted address returned true");
        })
        .then(done).catch(done);
    });

    it("Compliance officer should be able to re-whitelist previously unwhitelisted addresses", done => {
        instance.whitelist(userAccount1, {from:compliance}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            instance.manyRegisteredAddresses.call().then(_result => {
                assert.equal(_result, 2, "Re-whitelisted address added (again!) to the array");
            })
            instance.isWhitelisted.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User still whitelisted");
            })
            instance.isRegisteredInWhitelist.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User not registered");
            })
            instance.indexInWhitelist.call(userAccount1).then(_position => {
                assert.equal(_position, 0, "Wallet not found in array");
            })
            instance.addressInWhitelist.call(0).then(_address => {
                assert.equal(_address, userAccount1, "Wallet not added correctly");
            })
        })
        .then(done).catch(done);
    });

    it("Compliance officer should be able to whitelist addresses (user3)", done => {
        instance.whitelist(userAccount3, {from:compliance}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount3, "Incorrect argument in Whitelisted event");
            assert.equal(event.args.index, 2, "Incorrect argument in Whitelisted event");
            instance.manyRegisteredAddresses.call().then(_result => {
                assert.equal(_result, 3, "New wallet not added to the array");
            })
            instance.isWhitelisted.call(userAccount3).then(_result => {
                assert.equal(_result, true, "User not whitelisted");
            })
            instance.isRegisteredInWhitelist.call(userAccount3).then(_result => {
                assert.equal(_result, true, "User not registered");
            })
            instance.indexInWhitelist.call(userAccount3).then(_position => {
                assert.equal(_position, 2, "Wallet not found in array");
            })
            instance.addressInWhitelist.call(2).then(_address => {
                assert.equal(_address, userAccount3, "Wallet not added correctly");
            })
        })
        .then(done).catch(done);
    });

    // Now testing initial total stock variables

    it("Should start with zero totalSupply", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 0, "Initial total supply not zero");
        })
        .then(done).catch(done);
    });

    it("Should start with zero totalDrawnAmount", done => {
        instance.totalDrawnAmount.call().then(_result => {
            assert.equal(_result, 0, "Initial total drawn amount not zero");
        })
        .then(done).catch(done);
    });

    it("Should start with zero totalSupplyOnHold", done => {
        instance.totalSupplyOnHold.call().then(_result => {
            assert.equal(_result, 0, "Initial total supply on hold not zero");
        })
        .then(done).catch(done);
    });

    it("All wallets should start with zero balance", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 0, "Initial balance not zero");
        })
        .then(done).catch(done);
    });


    // Now testing funding

    it("Compliance check functions for funding should work", done => {
        // "Requesting funding by whitelisted addresses should be compliant"
        instance.canOrderFunding.call(userAccount1, userAccount1, 0).then(_result => {
            assert.equal(_result, SUCCESS, "Requesting funding from whitelisted address is not compliant");
        })
        // "Requesting funding by non whitelisted addresses should not be compliant"
        instance.canOrderFunding.call(userAccount1, notWhilisted1, 0).then(_result => {
            assert.equal(_result, FAILURE, "Requesting funding from non whitelisted address passess compliance check");
        })
        // "Approving whitelisted address to request funding on behalf of others should be compliant"
        instance.canApproveToOrderFunding.call(userAccount2, userAccount3).then(_result => {
            assert.equal(_result, SUCCESS, "Approving a whitelisted address is not compliant");
        })
        // "Approving non whitelisted address to request funding on behalf of others should not be compliant"
        instance.canApproveToOrderFunding.call(userAccount2, notWhilisted2).then(_result => {
            assert.equal(_result, FAILURE, "Approving a non whitelisted address passes compliance check");
        })
        .then(done).catch(done);
    });

    it("Not yet submitted funding requests should not exist", done => {
        instance.doesFundingExist.call(userAccount1, FUNDING_ID1).then(_result => {
            assert.equal(_result, false, "Not submitted funding request seems to exist");
        })
        .then(done).catch(done);
    });

    it("Whitelisted users should be able to request funding", done => {
        instance.orderFunding(FUNDING_ID1, 250000, "No particular instructions", {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
            assert.equal(event.args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.operationId, FUNDING_ID1, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.walletToFund, userAccount1, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.amount, 250000, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.instructions, "No particular instructions", "Incorrect argument in FundingOrdered event");
        })
        .then(done).catch(done);
    });

    it("Just ordered funding request sshould be correctly stored", done => {
        instance.doesFundingExist.call(userAccount1, FUNDING_ID1).then(_result => {
            assert.equal(_result, true, "Submitted funding request does not exist");
        })
        instance.retrieveFundingData.call(userAccount1, FUNDING_ID1).then(_result => {
            assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
            assert.equal(_result.amount, 250000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Amount not correctly registered");
            assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("A funding request should not be able to be ordered twice", async () => {
        await truffleAssert.reverts(instance.orderFunding(FUNDING_ID1, 250000, "No particular instructions", {from:userAccount1}), "", "Was able to re-order funding");
    });

    it("Non operator (not even owner) should not be able to process, execute or reject funding request", async () => {
        await truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:userAccount1}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:userAccount1}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:userAccount1}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:userAccount2}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:userAccount2}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:userAccount1}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:owner}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:owner}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:owner}), "", "Was able to manage funding");
    });

    it("No one other than orderer should be able to cancel a funding request", async () => {
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:userAccount2}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:owner}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
    });

    it("Orderer should be able to cancel a funding request", done => {
        instance.cancelFunding(FUNDING_ID1, {from:userAccount1}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "FundingCancelled", "FundingCancelled event not issued");
            assert.equal(event1.args.orderer, userAccount1, "Incorrect argument in FundingCancelled event");
            assert.equal(event1.args.operationId, FUNDING_ID1, "Incorrect argument in FundingCancelled event");
        })
        .then(done).catch(done);
    });

    it("Cancelled funding request should be correctly reflected", done => {
        instance.doesFundingExist.call(userAccount1, FUNDING_ID1).then(_result => {
            assert.equal(_result, true, "Cancelled funding request does not exist");
        })
        instance.retrieveFundingData.call(userAccount1, FUNDING_ID1).then(_result => {
            assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
            assert.equal(_result.amount, 250000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Instructions not correctly registered");
            assert.equal(_result.status, FundingStatusCode.Cancelled, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Cancelled funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:userAccount1}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:operator}), "", "Was able to cancel funding");
    });

    it("(Again) Whitelisted users should be able to request funding", done => {
        instance.orderFunding(FUNDING_ID2, 150000, "No particular instructions 2", {from:userAccount2}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
            assert.equal(event.args.orderer, userAccount2, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.operationId, FUNDING_ID2, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.amount,150000, "Incorrect argument in FundingOrdered event");
            assert.equal(event.args.instructions, "No particular instructions 2", "Incorrect argument in FundingOrdered event");
        })
        .then(done).catch(done);
    });

    it("(Again) Just ordered funding request sshould be correctly stored", done => {
        instance.doesFundingExist.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result, true, "Submitted funding request does not exist");
        })
        instance.retrieveFundingData.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
            assert.equal(_result.amount, 150000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions 2", "Amount not correctly registered");
            assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("Operator should be able to put a funding request in process", done => {
        instance.processFunding(userAccount2, FUNDING_ID2, {from:operator}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "FundingInProcess", "FundingInProcess event not issued");
            assert.equal(event1.args.orderer, userAccount2, "Incorrect argument in FundingInProcess event");
            assert.equal(event1.args.operationId, FUNDING_ID2, "Incorrect argument in FundingInProcess event");
        })
        .then(done).catch(done);
    });

    it("Funding request in process should be correctly reflected", done => {
        instance.doesFundingExist.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result, true, "Cancelled funding request does not exist");
        })
        instance.retrieveFundingData.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
            assert.equal(_result.amount, 150000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions 2", "Instructions not correctly registered");
            assert.equal(_result.status, FundingStatusCode.InProcess, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Orderer should not be able to cancel a funding request that is in process", async () => {
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:userAccount2}), "", "Was able to cancel funding");
    });

    it("A funding request in process should not be able to be ordered twice", async () => {
        await truffleAssert.reverts(instance.orderFunding(FUNDING_ID2, 250000, "No particular instructions", {from:userAccount2}), "", "Was able to re-order funding");
    });

    it("Operator should be able to execute a funding request in process", done => {
        instance.executeFunding(userAccount2, FUNDING_ID2, {from:operator}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "BalanceIncrease", "BalanceIncrease event not issued");
            assert.equal(event1.args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
            assert.equal(event1.args.value, 150000, "Incorrect argument in BalanceIncrease event");
            var event1 = _tx.logs[1]
            assert.equal(event1.event, "FundingExecuted", "FundingExecuted event not issued");
            assert.equal(event1.args.orderer, userAccount2, "Incorrect argument in FundingExecuted event");
            assert.equal(event1.args.operationId, FUNDING_ID2, "Incorrect argument in FundingExecuted event");
        })
        .then(done).catch(done);
    });

    it("Executed funding request should be correctly reflected", done => {
        instance.doesFundingExist.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result, true, "Cancelled funding request does not exist");
        })
        instance.retrieveFundingData.call(userAccount2, FUNDING_ID2).then(_result => {
            assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
            assert.equal(_result.amount, 150000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions 2", "Instructions not correctly registered");
            assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Executed funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:userAccount2}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.processFunding(userAccount2, FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.executeFunding(userAccount2, FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount2, FUNDING_ID2, "No reason", {from:operator}), "", "Was able to cancel funding");
    });

it("(Again 2) Whitelisted users should be able to request funding", done => {
    instance.orderFunding(FUNDING_ID3, 350000, "No particular instructions 3", {from:userAccount3}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(event.args.orderer, userAccount3, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.operationId, FUNDING_ID3, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.walletToFund, userAccount3, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.amount,350000, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.instructions, "No particular instructions 3", "Incorrect argument in FundingOrdered event");
    })
    .then(done).catch(done);
});

it("(Again 2) Just ordered funding request sshould be correctly stored", done => {
    instance.doesFundingExist.call(userAccount3, FUNDING_ID3).then(_result => {
        assert.equal(_result, true, "Submitted funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount3, FUNDING_ID3).then(_result => {
        assert.equal(_result.walletToFund, userAccount3, "walletToFund not correctly registered");
        assert.equal(_result.amount, 350000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 3", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    })
    .then(done).catch(done);
});

it("Operator should be able to execute a funding request just ordered", done => {
    instance.executeFunding(userAccount3, FUNDING_ID3, {from:operator}).then(_tx => {
        var event1 = _tx.logs[0]
        assert.equal(event1.event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(event1.args.wallet, userAccount3, "Incorrect argument in BalanceIncrease event");
        assert.equal(event1.args.value, 350000, "Incorrect argument in BalanceIncrease event");
        var event1 = _tx.logs[1]
        assert.equal(event1.event, "FundingExecuted", "FundingExecuted event not issued");
        assert.equal(event1.args.orderer, userAccount3, "Incorrect argument in FundingExecuted event");
        assert.equal(event1.args.operationId, FUNDING_ID3, "Incorrect argument in FundingExecuted event");
    })
    .then(done).catch(done);
});

it("Executed funding request should be correctly reflected", done => {
    instance.doesFundingExist.call(userAccount3, FUNDING_ID3).then(_result => {
        assert.equal(_result, true, "Cancelled funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount3, FUNDING_ID3).then(_result => {
        assert.equal(_result.walletToFund, userAccount3, "walletToFund not correctly registered");
        assert.equal(_result.amount, 350000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 3", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
    })
    .then(done).catch(done);
});

it("Executed funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
    await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:userAccount3}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.processFunding(userAccount3, FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.executeFunding(userAccount3, FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.rejectFunding(userAccount3, FUNDING_ID3, "No reason", {from:operator}), "", "Was able to cancel funding");
});

it("(Again 3) Whitelisted users should be able to request funding", done => {
    instance.orderFunding(FUNDING_ID4, 100000, "No particular instructions 4", {from:userAccount1}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(event.args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.operationId, FUNDING_ID4, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.walletToFund, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.instructions, "No particular instructions 4", "Incorrect argument in FundingOrdered event");
    })
    .then(done).catch(done);
});

it("(Again 3) Just ordered funding request sshould be correctly stored", done => {
    instance.doesFundingExist.call(userAccount1, FUNDING_ID4).then(_result => {
        assert.equal(_result, true, "Submitted funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount1, FUNDING_ID4).then(_result => {
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    })
    .then(done).catch(done);
});

it("(Again 3) Operator should be able to put a funding request in process", done => {
    instance.processFunding(userAccount1, FUNDING_ID4, {from:operator}).then(_tx => {
        var event1 = _tx.logs[0]
        assert.equal(event1.event, "FundingInProcess", "FundingInProcess event not issued");
        assert.equal(event1.args.orderer, userAccount1, "Incorrect argument in FundingInProcess event");
        assert.equal(event1.args.operationId, FUNDING_ID4, "Incorrect argument in FundingInProcess event");
    })
    .then(done).catch(done);
});

it("Operator should be able to reject a funding request in process", done => {
    instance.rejectFunding(userAccount1, FUNDING_ID4, "No real reason", {from:operator}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingRejected", "FundingRejected event not issued");
        assert.equal(event.args.orderer, userAccount1, "Incorrect argument in FundingRejected event");
        assert.equal(event.args.operationId, FUNDING_ID4, "Incorrect argument in FundingRejected event");
        assert.equal(event.args.reason, "No real reason", "Incorrect argument in FundingRejected event");
    })
    .then(done).catch(done);
});

it("Executed funding request should be correctly reflected", done => {
    instance.doesFundingExist.call(userAccount1, FUNDING_ID4).then(_result => {
        assert.equal(_result, true, "Cancelled funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount1, FUNDING_ID4).then(_result => {
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Rejected, "Status not correctly updated");
    })
    .then(done).catch(done);
});

it("(Again 4) Whitelisted users should be able to request funding", done => {
    instance.orderFunding(FUNDING_ID1, 100000, "No particular instructions 5", {from:userAccount2}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(event.args.orderer, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.operationId, FUNDING_ID1, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.instructions, "No particular instructions 5", "Incorrect argument in FundingOrdered event");
    })
    .then(done).catch(done);
});

it("(Again 4) Just ordered funding request sshould be correctly stored", done => {
    instance.doesFundingExist.call(userAccount2, FUNDING_ID1).then(_result => {
        assert.equal(_result, true, "Submitted funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount2, FUNDING_ID1).then(_result => {
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    })
    .then(done).catch(done);
});

it("Operator should be able to reject a funding request just ordered", done => {
    instance.rejectFunding(userAccount2, FUNDING_ID1, "No real reason", {from:operator}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingRejected", "FundingRejected event not issued");
        assert.equal(event.args.orderer, userAccount2, "Incorrect argument in FundingRejected event");
        assert.equal(event.args.operationId, FUNDING_ID1, "Incorrect argument in FundingRejected event");
        assert.equal(event.args.reason, "No real reason", "Incorrect argument in FundingRejected event");
    })
    .then(done).catch(done);
});

it("Executed funding request should be correctly reflected", done => {
    instance.doesFundingExist.call(userAccount2, FUNDING_ID1).then(_result => {
        assert.equal(_result, true, "Cancelled funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount2, FUNDING_ID1).then(_result => {
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Rejected, "Status not correctly updated");
    })
    .then(done).catch(done);
});

it("Whitelisted but non approved user should not be able to request funding on behalf of others", async () => {
    await truffleAssert.reverts(instance.orderFundingFrom(FUNDING_ID3, userAccount2, 10000, "Some instructions", {from:userAccount1}), "", "Was able to order funding on behalf of others");
});

it( "Whitelisted user should not be able to approve a non whitelisted user to be able to request funding", async () => {
    await truffleAssert.reverts(instance.approveToOrderFunding(notWhilisted1, {from:userAccount2}), "", "Was able to approve a non whitelisted address");
});

it("Whitelisted user should be able to approve a whitelisted user to be able to request funding", done => {
    instance.approveToOrderFunding(userAccount1, {from:userAccount2}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "ApprovalToOrderFunding", "ApprovalToOrderFunding event not issued");
        assert.equal(event.args.walletToFund, userAccount2, "Incorrect argument in ApprovalToOrderFunding event");
        assert.equal(event.args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderFunding event");
    })
    .then(done).catch(done);
});

it("Approvals should be correctly reflected", done => {
    instance.isApprovedToOrderFunding.call(userAccount2, userAccount1).then(_result => {
        assert.equal(_result, true, "Wrong approval");
    })
    instance.isApprovedToOrderFunding.call(userAccount1, userAccount2).then(_result => {
        assert.equal(_result, false, "Wrong approval");
    })
    instance.isApprovedToOrderFunding.call(userAccount1, userAccount3).then(_result => {
        assert.equal(_result, false, "Wrong approval");
    })
    .then(done).catch(done);
});

it("Approved users should be able to request funding on behalf of others", done => {
    instance.orderFundingFrom(FUNDING_ID3, userAccount2, 200000, "No particular instructions 6", {from:userAccount1}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(event.args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.operationId, FUNDING_ID3, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.amount,200000, "Incorrect argument in FundingOrdered event");
        assert.equal(event.args.instructions, "No particular instructions 6", "Incorrect argument in FundingOrdered event");
    })
    .then(done).catch(done);
});

it("Just ordered funding request should be correctly stored", done => {
    instance.doesFundingExist.call(userAccount1, FUNDING_ID3).then(_result => {
        assert.equal(_result, true, "Submitted funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount1, FUNDING_ID3).then(_result => {
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 200000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    })
    .then(done).catch(done);
});

it("No one other than orderer should be able to cancel a funding request", async () => {
    await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:userAccount2}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:owner}), "", "Was able to cancel funding");
    await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
});

it("Operator should be able to execute a funding request just ordered", done => {
    instance.executeFunding(userAccount1, FUNDING_ID3, {from:operator}).then(_tx => {
        var event1 = _tx.logs[0]
        assert.equal(event1.event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(event1.args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
        assert.equal(event1.args.value, 200000, "Incorrect argument in BalanceIncrease event");
        var event1 = _tx.logs[1]
        assert.equal(event1.event, "FundingExecuted", "FundingExecuted event not issued");
        assert.equal(event1.args.orderer, userAccount1, "Incorrect argument in FundingExecuted event");
        assert.equal(event1.args.operationId, FUNDING_ID3, "Incorrect argument in FundingExecuted event");
    })
    .then(done).catch(done);
});

it("Executed funding request should be correctly reflected", done => {
    instance.doesFundingExist.call(userAccount1, FUNDING_ID3).then(_result => {
        assert.equal(_result, true, "Cancelled funding request does not exist");
    })
    instance.retrieveFundingData.call(userAccount1, FUNDING_ID3).then(_result => {
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 200000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
    })
    .then(done).catch(done);
});

it("User shold be able to revoke previously approved users to request funding", done => {
    instance.revokeApprovalToOrderFunding(userAccount1, {from:userAccount2}).then(_tx => {
        var event = _tx.logs[0]
        assert.equal(event.event, "RevokeApprovalToOrderFunding", "RevokeApprovalToOrderFunding event not issued");
        assert.equal(event.args.walletToFund, userAccount2, "Incorrect argument in RevokeApprovalToOrderFunding event");
        assert.equal(event.args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderFunding event");
    })
    .then(done).catch(done);
});

it("Whitelisted but non approved user should not be able to request funding on behalf of others", async () => {
    await truffleAssert.reverts(instance.orderFundingFrom(FUNDING_ID5, userAccount2, 10000, "Some instructions", {from:userAccount1}), "", "Was able to order funding on behalf of others");
});
    
    // Now testing redemptions

//     it("Whitelisted users should be able to request redemptions", done => {
//         instance.requestRedeem(25000, "No particular redemption instructions", {from:userAccount1}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Suspended", "Suspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
//             assert.equal(event1.args.value, 25000, "Incorrect argument in Suspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
//             assert.equal(event2.args.redeemId, 0, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.amount, 25000, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.instructions, "No particular redemption instructions", "Incorrect argument in RedeemRequested event");
//             instance.manyRedeemRequests.call().then(_result => {
//                 assert.equal(_result, 1, "Redeem request not registered into array");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("Redeem request should be created with correct information", done => {
//         instance.retrieveRedeemData.call(0).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
//             assert.equal(_result.amount, 25000, "Amount not correctly registered");
//             assert.equal(_result.instructions, "No particular redemption instructions", "Amount not correctly registered");
//             assert.equal(_result.status, 0, "Status not correctly initialized");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to execute Redeem request", done => {
//         instance.executeRedeemRequest(0, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
//             assert.equal(event1.args.value, 25000, "Incorrect argument in Unsuspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "Burned", "Burned event not issued");
//             assert.equal(event2.args.account, userAccount1, "Incorrect argument in Burned event");
//             assert.equal(event2.args.value, 25000, "Incorrect argument in Burned event");
//             var event3 = _tx.logs[2]
//             assert.equal(event3.event, "RedeemRequestExecuted", "RedeemRequestExecuted event not issued");
//             assert.equal(event3.args.redeemId, 0, "Incorrect argument in RedeemRequestExecuted event");
//             assert.equal(event3.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestExecuted event");
//         })
//         .then(done).catch(done);
//     });
   
//     it("Redeem request status should be updated after execution", done => {
//         instance.retrieveRedeemData.call(0).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
//             assert.equal(_result.amount, 25000, "Amount not correctly registered");
//             assert.equal(_result.instructions, "No particular redemption instructions", "Instructions not correctly registered");
//             assert.equal(_result.status, 1, "Status not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Funded wallet should be updated", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Non-whitelisted users should not be able to request redemptions", done => {
//         instance.requestRedeem(15000, "No particular instructions", {from:userAccount3}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//             instance.manyRedeemRequests.call().then(_result => {
//                 assert.equal(_result, 1, "Redeem request added to array");
//             })
// })
//         .then(done).catch(done);
//     });

//     it("(Again) Whitelisted users should be able to request redemptions", done => {
//         instance.requestRedeem(35000, "No particular redeem instructions", {from:userAccount1}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Suspended", "Suspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
//             assert.equal(event1.args.value, 35000, "Incorrect argument in Suspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
//             assert.equal(event2.args.redeemId, 1, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.amount, 35000, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.instructions, "No particular redeem instructions", "Incorrect argument in RedeemRequested event");
//             instance.manyRedeemRequests.call().then(_result => {
//                 assert.equal(_result, 2, "Redeem request not registered into array");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("(Again) Redeem request should be created with correct information", done => {
//         instance.retrieveRedeemData.call(1).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
//             assert.equal(_result.amount, 35000, "Amount not correctly registered");
//             assert.equal(_result.instructions, "No particular redeem instructions", "Amount not correctly registered");
//             assert.equal(_result.status, 0, "Status not correctly initialized");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to reject Redeem request", done => {
//         instance.rejectRedeemRequest(1, "No particular reason", {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
//             assert.equal(event1.args.value, 35000, "Incorrect argument in Unsuspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "RedeemRequestRejected", "RedeemRequestReject event not issued");
//             assert.equal(event2.args.redeemId, 1, "Incorrect argument in RedeemRequestRejected event");
//             assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestRejected event");
//             assert.equal(event2.args.reason, "No particular reason", "Incorrect reason for rejection")
//         })
//         .then(done).catch(done);
//     });
   
//     it("Redeem request status should be updated after execution", done => {
//         instance.retrieveRedeemData.call(1).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
//             assert.equal(_result.amount, 35000, "Amount not correctly registered");
//             assert.equal(_result.instructions, "No particular redeem instructions", "Instructions not correctly registered");
//             assert.equal(_result.status, 2, "Status not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Funded wallet should not be changed", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000, "Balance changed");
//         })
//         .then(done).catch(done);
//     });

//     it("Closed (executed) Redeem request should not be able to be re-executed", done => {
//         instance.executeRedeemRequest(0, {from:ownerAccount}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//             instance.retrieveRedeemData.call(0).then(_result => {
//                 assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//                 assert.equal(_result.amount, 25000, "Amount changed");
//                 assert.equal(_result.instructions, "No particular redemption instructions", "Instructions changed");
//                 assert.equal(_result.status, 1, "Status changed");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("Closed (executed) Redeem request should not be able to be rejected", done => {
//         instance.rejectRedeemRequest(0, "No particular reason", {from:ownerAccount}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//             instance.retrieveRedeemData.call(0).then(_result => {
//                 assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//                 assert.equal(_result.amount, 25000, "Amount changed");
//                 assert.equal(_result.instructions, "No particular redemption instructions", "Instructions changed");
//                 assert.equal(_result.status, 1, "Status changed");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("Closed (rejected) Redeem request should not be able to be executed", done => {
//         instance.executeRedeemRequest(1, {from:ownerAccount}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//             instance.retrieveRedeemData.call(1).then(_result => {
//                 assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//                 assert.equal(_result.amount, 35000, "Amount changed");
//                 assert.equal(_result.instructions, "No particular redeem instructions", "Instructions changed");
//                 assert.equal(_result.status, 2, "Status changed");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("Closed (rejected) Redeem request should not be able to be re-rejected", done => {
//         instance.rejectRedeemRequest(1, "No reason", {from:ownerAccount}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//             instance.retrieveRedeemData.call(1).then(_result => {
//                 assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//                 assert.equal(_result.amount, 35000, "Amount changed");
//                 assert.equal(_result.instructions, "No particular redeem instructions", "Instructions changed");
//                 assert.equal(_result.status, 2, "Status changed");
//             })
//         })
//         .then(done).catch(done);
//     });
    
//     it("(Again again) Whitelisted users should be able to request redemptions", done => {
//         instance.requestRedeem(20000, "Some instructions", {from:userAccount1}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Suspended", "Suspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
//             assert.equal(event1.args.value, 20000, "Incorrect argument in Suspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
//             assert.equal(event2.args.redeemId, 2, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.amount, 20000, "Incorrect argument in RedeemRequested event");
//             assert.equal(event2.args.instructions, "Some instructions", "Incorrect argument in RedeemRequested event");
//             instance.manyRedeemRequests.call().then(_result => {
//                 assert.equal(_result, 3, "Redeem request not registered into array");
//             })
//             instance.retrieveRedeemData.call(2).then(_result => {
//                 assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
//                 assert.equal(_result.amount, 20000, "Amount not correctly registered");
//                 assert.equal(_result.instructions, "Some instructions", "Amount not correctly registered");
//                 assert.equal(_result.status, 0, "Status not correctly initialized");
//             })
//         })
//         .then(done).catch(done);
//     });

//     it("Non owner should not be able to execute redemptions", done => {
//         instance.executeRedeemRequest(2, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//         })
//         .then(done).catch(done);
//     });

//     it("Failed execution attempts should not be registered", done => {
//         instance.retrieveRedeemData.call(2).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//             assert.equal(_result.amount, 20000, "Amount changed");
//             assert.equal(_result.instructions, "Some instructions", "Instructions changed");
//             assert.equal(_result.status, 0, "Status changed");
//         })
//     .then(done).catch(done);
//     });

//     it("Non owner should not be able to reject redemptions", done => {
//         instance.rejectRedeemRequest(2, "Blah blah", {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated");
//         })
//         .then(done).catch(done);
//     });

//     it("Failed reject requests should not be registered", done => {
//         instance.retrieveRedeemData.call(2).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//             assert.equal(_result.amount, 20000, "Amount changed");
//             assert.equal(_result.instructions, "Some instructions", "Instructions changed");
//             assert.equal(_result.status, 0, "Status changed");
//         })
//     .then(done).catch(done);
//     });

//     it("User should not be able to cancel others' Redeem requests", done => {
//         instance.cancelRedeemRequest(2, {from:userAccount2}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was generated")
//         })
//         .then(done).catch(done);
//     });

//     it("Failed cancelling attempts should not modify others' Redeem requests", done => {
//         instance.retrieveRedeemData.call(2).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//             assert.equal(_result.amount, 20000, "Amount changed");
//             assert.equal(_result.instructions, "Some instructions", "Instructions changed");
//             assert.equal(_result.status, 0, "Status changed");
//         })
//     .then(done).catch(done);
//     });

//     it("User should be able to cancel his own Redeem requests", done => {
//         instance.cancelRedeemRequest(2, {from:userAccount1}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
//             assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
//             assert.equal(event1.args.value, 20000, "Incorrect argument in Unsuspended event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "RedeemRequestCancelled", "RedeemRequestReject event not issued");
//             assert.equal(event2.args.redeemId, 2, "Incorrect argument in RedeemRequestCancelled event");
//             assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestCancelled event")
//         })
//         .then(done).catch(done);
//     });

//     it("Cancelling a Redeem request should be correctly registered", done => {
//         instance.retrieveRedeemData.call(2).then(_result => {
//             assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
//             assert.equal(_result.amount, 20000, "Amount changed");
//             assert.equal(_result.instructions, "Some instructions", "Instructions changed");
//             assert.equal(_result.status, 3, "Status not correctly changed");
//         })
//         .then(done).catch(done);
//     });

//     // Now testing direct writes to wallets

//     it("Owner should be able to directly add funds to a whitelisted wallet", done => {
//         instance.directAddToWallet(userAccount2, 220000, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Minted", "Minted event not issued");
//             assert.equal(event1.args.account, userAccount2, "Incorrect argument in Minted event");
//             assert.equal(event1.args.value, 220000, "Incorrect argument in Minted event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "DirectAddToWallet", "DirectAddToWallet event not issued");
//             assert.equal(event2.args.account, userAccount2, "Incorrect account argument in DirectAddToWallet event")
//             assert.equal(event2.args.value, 220000, "Incorrect value argument in DirectAddToWallet event");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to directly remove funds to a whitelisted wallet", done => {
//         instance.directRemoveFromWallet(userAccount2, 40000, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Burned", "Burned event not issued");
//             assert.equal(event1.args.account, userAccount2, "Incorrect argument in Burned event");
//             assert.equal(event1.args.value, 40000, "Incorrect argument in Burned event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "DirectRemoveFromWallet", "DirectRemoveFromWallet event not issued");
//             assert.equal(event2.args.account, userAccount2, "Incorrect account argument in DirectRemoveFromWallet event")
//             assert.equal(event2.args.value, 40000, "Incorrect value argument in DirectRemoveFromWallet event");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be correctly updated after direct adds and removes", done => {
//         instance.balanceOf.call(userAccount2).then(_result => {
//             assert.equal(_result, 220000-40000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should be correctly updated", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 220000-40000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to directly set the balance of a whitelisted wallet", done => {
//         instance.directSetWalletBalance(userAccount2, 150000, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Burned", "Burned event not issued");
//             assert.equal(event1.args.account, userAccount2, "Incorrect argument in Burned event");
//             assert.equal(event1.args.value, 220000-40000, "Incorrect argument in Burned event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "Minted", "Minted event not issued");
//             assert.equal(event2.args.account, userAccount2, "Incorrect argument in Minted event");
//             assert.equal(event2.args.value, 150000, "Incorrect argument in Minted event");
//             var event3 = _tx.logs[2]
//             assert.equal(event3.event, "DirectSetWalletBalance", "DirectSetWalletBalance event not issued");
//             assert.equal(event3.args.account, userAccount2, "Incorrect account argument in DirectSetWalletBalance event")
//             assert.equal(event3.args.value, 150000, "Incorrect value argument in DirectSetWalletBalance event");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be correctly updated after direct balance set", done => {
//         instance.balanceOf.call(userAccount2).then(_result => {
//             assert.equal(_result, 150000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should be correctly updated", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to directly add funds even to a non whitelisted wallet", done => {
//         instance.directAddToWallet(userAccount3, 100000, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Minted", "Minted event not issued");
//             assert.equal(event1.args.account, userAccount3, "Incorrect argument in Minted event");
//             assert.equal(event1.args.value, 100000, "Incorrect argument in Minted event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "DirectAddToWallet", "DirectAddToWallet event not issued");
//             assert.equal(event2.args.account, userAccount3, "Incorrect account argument in DirectAddToWallet event")
//             assert.equal(event2.args.value, 100000, "Incorrect value argument in DirectAddToWallet event");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be correctly updated after direct add, even to a non whitelisted wallet", done => {
//         instance.balanceOf.call(userAccount3).then(_result => {
//             assert.equal(_result, 100000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should be correctly updated", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 150000 + 100000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Owner should be able to directly set the balance of a non whitelisted wallet", done => {
//         instance.directSetWalletBalance(userAccount3, 0, {from:ownerAccount}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Burned", "Burned event not issued");
//             assert.equal(event1.args.account, userAccount3, "Incorrect argument in Burned event");
//             assert.equal(event1.args.value, 100000, "Incorrect argument in Burned event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "Minted", "Minted event not issued");
//             assert.equal(event2.args.account, userAccount3, "Incorrect argument in Minted event");
//             assert.equal(event2.args.value, 0, "Incorrect argument in Minted event");
//             var event3 = _tx.logs[2]
//             assert.equal(event3.event, "DirectSetWalletBalance", "DirectSetWalletBalance event not issued");
//             assert.equal(event3.args.account, userAccount3, "Incorrect account argument in DirectSetWalletBalance event")
//             assert.equal(event3.args.value, 0, "Incorrect value argument in DirectSetWalletBalance event");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be correctly updated after direct balance set", done => {
//         instance.balanceOf.call(userAccount3).then(_result => {
//             assert.equal(_result, 0, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should be correctly updated", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Non owner should not be able to directly add funds to a wallet", done => {
//         instance.directAddToWallet(userAccount1, 50000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Non owner should not be able to directly remove funds from a wallet", done => {
//         instance.directRemoveFromWallet(userAccount1, 20000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be not change after failed direct add or remove attempts", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Non owner should not be able to directly add funds to a wallet", done => {
//         instance.directSetWalletBalance(userAccount1, 90000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balance should be not change after failed direct balance set attempts", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000, "Balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     // Now testing transfers etc.

//     it("Whitelisted user should be able to transfer funds to other whitelisted users", done => {
//         instance.transfer(userAccount2, 3000, {from:userAccount1}).then(_tx => {
//             var event = _tx.logs[0]
//             assert.equal(event.event, "Transfer", "Transfer event not issued");
//             assert.equal(event.args.from, userAccount1, "Incorrect from account argument in Transfer event")
//             assert.equal(event.args.to, userAccount2, "Incorrect to account argument in Transfer event")
//             assert.equal(event.args.value, 3000, "Incorrect value argument in Transfer event");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should not be able to transfer funds to non whitelisted users", done => {
//         instance.transfer(userAccount3, 2000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "An event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balances should be correctly updated after transfers", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000-3000, "Sender balance not updated");
//         })
//         instance.balanceOf.call(userAccount2).then(_result => {
//             assert.equal(_result, 150000+3000, "Receiver balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should not change after transfers", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should be able to approve another whitelisted users", done => {
//         instance.approve(userAccount2, 5000, {from:userAccount1}).then(_tx => {
//             var event = _tx.logs[0]
//             assert.equal(event.event, "Approval", "Approval event not issued");
//             assert.equal(event.args.owner, userAccount1, "Incorrect owner account argument in Approval event")
//             assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
//             assert.equal(event.args.value, 5000, "Incorrect value argument in Approval event");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should be able to increase allowance for whitelisted users", done => {
//         instance.increaseAllowance(userAccount2, 3000, {from:userAccount1}).then(_tx => {
//             var event = _tx.logs[0]
//             assert.equal(event.event, "Approval", "Approval event not issued");
//             assert.equal(event.args.owner, userAccount1, "Incorrect owner account argument in Approval event")
//             assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
//             assert.equal(event.args.value, 5000+3000, "Incorrect value argument in Approval event");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should be able to decrease allowance for whitelisted users", done => {
//         instance.decreaseAllowance(userAccount2, 1000, {from:userAccount1}).then(_tx => {
//             var event = _tx.logs[0]
//             assert.equal(event.event, "Approval", "Approval event not issued");
//             assert.equal(event.args.owner, userAccount1, "Incorrect ownder account argument in Approval event")
//             assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
//             assert.equal(event.args.value, 5000+3000-1000, "Incorrect value argument in Approval event");
//         })
//         .then(done).catch(done);
//     });

//     it("Allowances should be correctly updated after approvals", done => {
//         instance.allowance.call(userAccount1, userAccount2).then(_result => {
//             assert.equal(_result, 5000+3000-1000, "Allowance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balances should not change after approvals", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000-3000, "Sender balance not updated");
//         })
//         instance.balanceOf.call(userAccount2).then(_result => {
//             assert.equal(_result, 150000+3000, "Receiver balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Allowed spender should be able to spend within the allowance", done => {
//         instance.transferFrom(userAccount1, userAccount2, 4000, {from:userAccount2}).then(_tx => {
//             var event1 = _tx.logs[0]
//             assert.equal(event1.event, "Transfer", "Transfer event not issued");
//             assert.equal(event1.args.from, userAccount1, "Incorrect from account argument in Transfer event")
//             assert.equal(event1.args.to, userAccount2, "Incorrect to account argument in Transfer event")
//             assert.equal(event1.args.value, 4000, "Incorrect value argument in Transfer event");
//             var event2 = _tx.logs[1]
//             assert.equal(event2.event, "Approval", "Approval event not issued");
//             assert.equal(event2.args.owner, userAccount1, "Incorrect from account argument in Approval event")
//             assert.equal(event2.args.spender, userAccount2, "Incorrect to account argument in Approval event")
//             assert.equal(event2.args.value, 5000+3000-1000-4000, "Incorrect value argument in Approval event");
//         })
//         .then(done).catch(done);
//     });

//     it("Allowed spender should be not able to spend outside the allowance", done => {
//         instance.transferFrom(userAccount1, userAccount2, 10000, {from:userAccount2}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "And event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Allowances should be correctly updated after spending", done => {
//         instance.allowance.call(userAccount1, userAccount2).then(_result => {
//             assert.equal(_result, 5000+3000-1000-4000, "Allowance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should not be able to approve non whitelisted users", done => {
//         instance.approve(userAccount3, 5000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "And event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("Whitelisted user should not be able to increase allowance for whitelisted users", done => {
//         instance.increaseAllowance(userAccount3, 3000, {from:userAccount1}).then(_tx => {
//             assert.equal(_tx.logs.length, 0, "And event was sent");
//         })
//         .then(done).catch(done);
//     });

//     it("No allowance should be set for non whitelisted users after attempts", done => {
//         instance.allowance.call(userAccount1, userAccount3).then(_result => {
//             assert.equal(_result, 0, "Allowance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("Wallet balances should be correctly updated after transferFrom's", done => {
//         instance.balanceOf.call(userAccount1).then(_result => {
//             assert.equal(_result, 250000-25000-3000-4000, "Sender balance not updated");
//         })
//         instance.balanceOf.call(userAccount2).then(_result => {
//             assert.equal(_result, 150000+3000+4000, "Receiver balance not updated");
//         })
//         .then(done).catch(done);
//     });

//     it("totalSupply should not change after transferFrom's", done => {
//         instance.totalSupply.call().then(_result => {
//             assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
//         })
//         .then(done).catch(done);
//     });

});
