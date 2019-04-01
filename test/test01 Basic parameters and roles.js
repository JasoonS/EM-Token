const EMoneyToken = artifacts.require("EMoneyToken");
const truffleAssert = require('truffle-assertions'); // install with: npm install truffle-assertions

contract("EMoneyToken", accounts => {

    // Common to all tests
    const owner = accounts[9]
    const cro = accounts[8]
    const operator = accounts[7]
    const compliance = accounts[6]
    const userAccount1 = accounts[5]
    const userAccount2 = accounts[4]
    const userAccount3 = accounts[3]
    const notary1 = accounts[2]
    const notWhitelisted1 = accounts[1]
    const notWhitelisted2 = accounts[0]
    const SUSPENSE_WALLET = "0x0000000000000000000000000000000000000000"
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    
    var instance
    var tx
    var _result

    // Constants for this test
    const Name = 'Test EMoneyToken'
    const Symbol = 'EMT-EUR'
    const Currency = 'EUR'
    const Decimals = 2
    const Version = "0.1.0"

    const CRO_ROLE = "cro";
    const OPERATOR_ROLE = "operator"
    const COMPLIANCE_ROLE = "compliance"
    
    // runs before all tests

    // before(done => {
    //     EMoneyToken.new(Name,Symbol, Currency, Decimals, ZeroAddr, {from: owner, gas: 500000000})
    //     .then(_instance => {
    //         instance = _instance;
    //         console.log(instance.address);
    //     })
    //     .then(done).catch(done);
    // });

    // Now doing it with this construct
    // Important! deployment parameters are the one in the migrations file
    // So the parameters defined here should match (i.e. name, symbol, etc. - plus, most curcially, owner!!)
    before( async () => {
        console.log("  > Now testing basic parameters and roles");
        instance = await EMoneyToken.deployed();
        console.log("  > Contract address is", instance.address);
    })

    //Now testing EM Token informational parameters (set at instantiation)

    it("Should start with the correct parameters", async () => {
        assert.equal(await instance.name.call(), Name, "Name not set correctly");
        assert.equal(await instance.symbol.call(), Symbol, "Symbol not set correctly");
        assert.equal(await instance.currency.call(), Currency, "Currency not set correctly");
        assert.equal(await instance.decimals.call(), Decimals, "Decimals not set correctly");
        assert.equal(await instance.version.call(), Version, "Wrong version!");
    });

    // Now testing ownership

    it("Ownership should be well set", async () => {
        assert.equal(await instance.owner.call(), owner, "Owner not set correctly");
        assert.equal(await instance.isOwner.call({from:owner}), true, "isOwner from owner returned false");
    });
    
    it("Should be able to transfer ownership", async () => {
        tx = await instance.transferOwnership(userAccount1, {from:owner});
        assert.equal(tx.logs[0].event, "OwnershipTransferred", "OwnershipTransferred event not issued");
        assert.equal(tx.logs[0].args.previousOwner, owner, "Incorrect argument in OwnershipTransferred event");
        assert.equal(tx.logs[0].args.newOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
        assert.equal(await instance.owner.call(), userAccount1, "Owner not transferred correctly");

        await truffleAssert.reverts(instance.transferOwnership(owner, {from:owner}), "", "Was able to transfer ownership from a non owner");

        tx = await instance.transferOwnership(owner, {from:userAccount1});
        assert.equal(tx.logs[0].event, "OwnershipTransferred", "OwnershipTransferred event not issued");
        assert.equal(tx.logs[0].args.previousOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
        assert.equal(tx.logs[0].args.newOwner, owner, "Incorrect argument in OwnershipTransferred event");
        assert.equal(await instance.owner.call(), owner, "Owner not transferred correctly");
    });

    // Now creating roles

    it("There should be no predefined roles", async () => {
        assert.equal(await instance.hasRole.call(owner, CRO_ROLE), false, "User should not have role before defining it");
        assert.equal(await instance.hasRole.call(owner, OPERATOR_ROLE), false, "User should not have role before defining it");
        assert.equal(await instance.hasRole.call(owner, COMPLIANCE_ROLE), false, "Should not have role before defining it");
        assert.equal(await instance.hasRole.call(cro, CRO_ROLE), false, "Should not have role before defining it");
        assert.equal(await instance.hasRole.call(operator, OPERATOR_ROLE), false, "Should not have role before defining it");
        assert.equal(await instance.hasRole.call(compliance, COMPLIANCE_ROLE), false, "Should not have role before defining it");
    });

    it("The owner should be able to add roles", async () => {
        tx = await instance.addRole(cro, CRO_ROLE, {from:owner});
        assert.equal(tx.logs[0].event, "RoleAdded", "RoleAdded event not issued");
        assert.equal(tx.logs[0].args.account, cro, "Incorrect argument in RoleAdded event");
        assert.equal(tx.logs[0].args.role, CRO_ROLE, "Incorrect argument in RoleAdded event");
        assert.equal(await instance.hasRole.call(cro, CRO_ROLE), true, "Role has not been added");
        
        tx = await instance.addRole(userAccount1, CRO_ROLE, {from:owner});
        assert.equal(tx.logs[0].event, "RoleAdded", "RoleAdded event not issued");
        assert.equal(tx.logs[0].args.account, userAccount1, "Incorrect argument in RoleAdded event");
        assert.equal(tx.logs[0].args.role, CRO_ROLE, "Incorrect argument in RoleAdded event");
        assert.equal(await instance.hasRole.call(userAccount1, CRO_ROLE), true, "Role has not been added");
        
        tx = await instance.addRole(operator, OPERATOR_ROLE, {from:owner});
        assert.equal(tx.logs[0].event, "RoleAdded", "RoleAdded event not issued");
        assert.equal(tx.logs[0].args.account, operator, "Incorrect argument in RoleAdded event");
        assert.equal(tx.logs[0].args.role, OPERATOR_ROLE, "Incorrect argument in RoleAdded event");
        assert.equal(await instance.hasRole.call(operator, OPERATOR_ROLE), true, "Role has not been added");
        
        tx = await instance.addRole(compliance, COMPLIANCE_ROLE, {from:owner});
        assert.equal(tx.logs[0].event, "RoleAdded", "RoleAdded event not issued");
        assert.equal(tx.logs[0].args.account, compliance, "Incorrect argument in RoleAdded event");
        assert.equal(tx.logs[0].args.role, COMPLIANCE_ROLE, "Incorrect argument in RoleAdded event");
        assert.equal(await instance.hasRole.call(compliance, COMPLIANCE_ROLE), true, "Role has not been added");
    });

    it("The ownwer should be able to revoke roles", async () => {
        tx = await instance.revokeRole(userAccount1, CRO_ROLE, {from:owner});
        assert.equal(tx.logs[0].event, "RoleRevoked", "RoleRevoked event not issued");
        assert.equal(tx.logs[0].args.account, userAccount1, "Incorrect argument in RoleRevoked event");
        assert.equal(tx.logs[0].args.role, CRO_ROLE, "Incorrect argument in RoleRevoked event");
        assert.equal(await instance.hasRole.call(userAccount1, CRO_ROLE), false, "Role has not been revoked");

        truffleAssert.reverts(instance.revokeRole(operator, OPERATOR_ROLE, {from:userAccount1}), "", "Was able to revoke role");
        await truffleAssert.reverts(instance.revokeRole(operator, OPERATOR_ROLE, {from:operator}), "", "Was able to revoke role");
    });

    it("Nobody but the ownwer should be able to add or revoke roles", async () => {
        truffleAssert.reverts(instance.addRole(userAccount1, CRO_ROLE, {from:userAccount1}), "", "Was able to add role");
        truffleAssert.reverts(instance.addRole(userAccount2, CRO_ROLE, {from:cro}), "", "Was able to add role");
        truffleAssert.reverts(instance.revokeRole(cro, CRO_ROLE, {from:cro}), "", "Was able to revoke role");
        await truffleAssert.reverts(instance.revokeRole(operator, CRO_ROLE, {from:operator}), "", "Was able to revoke role");
    });

    // Now testing Whitelisting

    it("Should start with no whitelisted addresses", async () => {
        assert.equal(await instance.manyRegisteredAddresses.call(), 0, "Did not start with zero wallets");
        assert.equal(await instance.isWhitelisted.call(userAccount1), false, "isWhitelisted returned true!");
        assert.equal(await instance.isWhitelisted.call(userAccount2), false, "isWhitelisted returned true!");
    });

    it("Users without a compliance role should not be able to whitelist addresses", async () => {
        truffleAssert.reverts(instance.whitelist(userAccount1, {from:owner}), "", "Was able to whitelist an address");
        truffleAssert.reverts(instance.whitelist(userAccount1, {from:userAccount1}), "", "Was able to whitelist an address");
        await truffleAssert.reverts(instance.whitelist(userAccount1, {from:operator}), "", "Was able to whitelist an address");
    });

    it("Compliance officer should be able to whitelist addresses (user1)", async () => {
        tx = await instance.whitelist(userAccount1, {from:compliance});
        assert.equal(tx.logs[0].event, "Whitelisted", "Whitelisted event not issued");
        assert.equal(tx.logs[0].args.who, userAccount1, "Incorrect argument in Whitelisted event");
        assert.equal(tx.logs[0].args.index, 0, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 1, "New wallet not added to the array");
        assert.equal(await instance.isWhitelisted.call(userAccount1), true, "User not whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(userAccount1), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(userAccount1), 0, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(0), userAccount1, "Wallet not added correctly");
    });

    it("Compliance officer should be able to whitelist addresses (user2)", async () => {
        tx = await instance.whitelist(userAccount2, {from:compliance});
        assert.equal(tx.logs[0].event, "Whitelisted", "Whitelisted event not issued");
        assert.equal(tx.logs[0].args.who, userAccount2, "Incorrect argument in Whitelisted event");
        assert.equal(tx.logs[0].args.index, 1, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 2, "New wallet not added to the array");
        assert.equal(await instance.isWhitelisted.call(userAccount2), true, "User not whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(userAccount2), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(userAccount2), 1, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(1), userAccount2, "Wallet not added correctly");
    });

    it("Nobody without a compliance role should be able to whitelist addresses", async () => {
        await truffleAssert.reverts(instance.whitelist(userAccount3, {from:owner}), "", "Someone that was not a compliance officer Was able to whitelist address");
    });

    it("Compliance officer should be able to unwhitelist an address", async () => {
        tx = await instance.unWhitelist(userAccount1, {from:compliance});
        assert.equal(tx.logs[0].event, "UnWhitelisted", "UnWhitelisted event not issued");
        assert.equal(tx.logs[0].args.who, userAccount1, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 2, "Wallet array changed on unwhitelisting");
        assert.equal(await instance.isWhitelisted.call(userAccount1), false, "User still whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(userAccount1), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(userAccount1), 0, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(0), userAccount1, "Wallet not added correctly");

        assert.equal(await instance.isWhitelisted.call(userAccount2), true, "Whitelisted address returned false");
        assert.equal(await instance.isWhitelisted.call(userAccount3), false, "Non whitelisted address returned true");
    });

    it("Compliance officer should be able to re-whitelist previously unwhitelisted addresses", async () => {
        tx = await instance.whitelist(userAccount1, {from:compliance});
        assert.equal(tx.logs[0].event, "Whitelisted", "Whitelisted event not issued");
        assert.equal(tx.logs[0].args.who, userAccount1, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 2, "Re-whitelisted address added (again!) to the array");
        assert.equal(await instance.isWhitelisted.call(userAccount1), true, "User still whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(userAccount1), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(userAccount1), 0, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(0), userAccount1, "Wallet not added correctly");
    });

    it("Compliance officer should be able to whitelist addresses (user3)", async () => {
        tx = await instance.whitelist(userAccount3, {from:compliance});
        assert.equal(tx.logs[0].event, "Whitelisted", "Whitelisted event not issued");
        assert.equal(tx.logs[0].args.who, userAccount3, "Incorrect argument in Whitelisted event");
        assert.equal(tx.logs[0].args.index, 2, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 3, "New wallet not added to the array");
        assert.equal(await instance.isWhitelisted.call(userAccount3), true, "User not whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(userAccount3), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(userAccount3), 2, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(2), userAccount3, "Wallet not added correctly");
    });

    it("Compliance officer should be able to whitelist addresses (notary1)", async () => {
        tx = await instance.whitelist(notary1, {from:compliance});
        assert.equal(tx.logs[0].event, "Whitelisted", "Whitelisted event not issued");
        assert.equal(tx.logs[0].args.who, notary1, "Incorrect argument in Whitelisted event");
        assert.equal(tx.logs[0].args.index, 3, "Incorrect argument in Whitelisted event");
        assert.equal(await instance.manyRegisteredAddresses.call(), 4, "New wallet not added to the array");
        assert.equal(await instance.isWhitelisted.call(notary1), true, "User not whitelisted");
        assert.equal(await instance.isRegisteredInWhitelist.call(notary1), true, "User not registered");
        assert.equal(await instance.indexInWhitelist.call(notary1), 3, "Wallet not found in array");
        assert.equal(await instance.addressInWhitelist.call(3), notary1, "Wallet not added correctly");
    });

    it("Nobody but a compliance officer should be able to unwhitelist addresses", async () => {
        truffleAssert.reverts(instance.unWhitelist(userAccount1, {from:owner}), "", "Someone that was not a compliance officer Was able to unwhitelist address");
        truffleAssert.reverts(instance.unWhitelist(userAccount1, {from:operator}), "", "Someone that was not a compliance officer Was able to unwhitelist address");
        await truffleAssert.reverts(instance.unWhitelist(userAccount1, {from:userAccount1}), "", "Someone that was not a compliance officer Was able to unwhitelist address");
    });

    // // Now testing initial total stock variables

    if("Should start with initial stock variables set to zero", async () => {
        assert.equal(await instance.totalSupply.call(), 0, "Initial total supply not zero");
        assert.equal(await instance.totalDrawnAmount.call(), 0, "Initial total drawn amount not zero");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Initial total supply on hold not zero");
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Initial balance not zero");
    });

});
