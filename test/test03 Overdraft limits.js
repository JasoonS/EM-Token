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
    const notWhilisted1 = accounts[1]
    const notWhilisted2 = accounts[0]
    const SUSPENSE_WALLET = "0x0000000000000000000000000000000000000000"
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    
    var instance
    var tx
    var _result

    // Constants for this test
    
    before( async () => {
        console.log("  > Now testing overdraft limits (just setting them up)");
        instance = await EMoneyToken.deployed();
        console.log("  > Contract address is", instance.address);
    })

    it("All addresses should start with no overdrafts and no drawn limits", async () => {
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.unsecuredOverdraftLimit.call(cro), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.unsecuredOverdraftLimit.call(operator), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.unsecuredOverdraftLimit.call(owner), 0, "Wallet started with a non-zero overdraft limit");
        assert.equal(await instance.drawnAmount.call(userAccount1), 0, "Wallet started with a non-zero drawn amount");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Wallet started with a non-zero drawn amount");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Wallet started with a non-zero drawn amount");
        assert.equal(await instance.drawnAmount.call(cro), 0, "Wallet started with a non-zero drawn amount");
        assert.equal(await instance.drawnAmount.call(operator), 0, "Wallet started with a non-zero drawn amount");
        assert.equal(await instance.drawnAmount.call(owner), 0, "Wallet started with a non-zero drawn amount");
    });

    it("Nobody but the CRO should be able to set up overdraft limits", async () => {
        truffleAssert.reverts(instance.setUnsecuredOverdraftLimit(userAccount1, 100000, {from:userAccount1}), "", "Was able to set up overdraft limit");
        truffleAssert.reverts(instance.setUnsecuredOverdraftLimit(userAccount1, 100000, {from:userAccount2}), "", "Was able to set up overdraft limit");
        truffleAssert.reverts(instance.setUnsecuredOverdraftLimit(userAccount2, 100000, {from:operator}), "", "Was able to set up overdraft limit");
        await truffleAssert.reverts(instance.setUnsecuredOverdraftLimit(userAccount1, 100000, {from:owner}), "", "Was able to set up overdraft limit");
    });

    it("The CRO should be able to set up overdraft limits", async () => {
        assert.equal(await instance.hasRole.call(cro, "cro"), true, "cro has no CRO role");
        
        tx = await instance.setUnsecuredOverdraftLimit(userAccount1, 50000, {from:cro});
        assert.equal(tx.logs[0].event, "UnsecuredOverdraftLimitSet", "UnsecuredOverdraftLimitSet event not issued (1)");
        assert.equal(tx.logs[0].args.wallet, userAccount1, "Incorrect argument in UnsecuredOverdraftLimitSet event (1, wallet)");
        assert.equal(tx.logs[0].args.oldLimit, 0, "Incorrect argument in UnsecuredOverdraftLimitSet event (1, oldLimit)");
        assert.equal(tx.logs[0].args.newLimit, 50000, "Incorrect argument in UnsecuredOverdraftLimitSet event (1, newLimit)");

        tx = await instance.setUnsecuredOverdraftLimit(userAccount2, 25000, {from:cro});
        assert.equal(tx.logs[0].event, "UnsecuredOverdraftLimitSet", "UnsecuredOverdraftLimitSet event not issued (2)");
        assert.equal(tx.logs[0].args.wallet, userAccount2, "Incorrect argument in UnsecuredOverdraftLimitSet event (2, wallet)");
        assert.equal(tx.logs[0].args.oldLimit, 0, "Incorrect argument in UnsecuredOverdraftLimitSet event (2, oldLimit)");
        assert.equal(tx.logs[0].args.newLimit, 25000, "Incorrect argument in UnsecuredOverdraftLimitSet event (2, newLimit)");

    });
    
    it("Balances and limits should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), 0, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 250000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 250000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 250000+25000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 350000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 350000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 350000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 0+250000+350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 0, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    })

    // TO DO: interest engines

});
