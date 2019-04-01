const EMoneyToken = artifacts.require("EMoneyToken");
const truffleAssert = require('truffle-assertions'); // install with: npm install truffle-assertions

var ClearableTransferStatusCode =
    Object.freeze({
        "Nonexistent":0,
        "Ordered":1,
        "InProcess":2,
        "Executed":3,
        "Rejected":4,
        "Cancelled":5
    });

var HoldStatusCode =
    Object.freeze({
        "Nonexistent":0,
        "Ordered":1,
        "ExecutedByNotary":2,
        "ExecutedByOperator":3,
        "ReleasedByNotary":4,
        "ReleasedByPayee":5,
        "ReleasedByOperator":6,
        "ReleasedOnExpiration":7
    });

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
    
    const FAILURE = 0x00
    const SUCCESS = 0x01
    
    const CLEARABLE_TRANSFER_ID1 = "ClearableTransferID1"
    const CLEARABLE_TRANSFER_ID2 = "ClearableTransferID2"
    const CLEARABLE_TRANSFER_ID3 = "ClearableTransferID3"
    const CLEARABLE_TRANSFER_ID4 = "ClearableTransferID4"
    const CLEARABLE_TRANSFER_ID5 = "ClearableTransferID5"

    before( async () => {
        console.log("  > Now testing clearable transfers");
        instance = await EMoneyToken.deployed();
        console.log("  > Contract address is", instance.address);
    })

    // Check compliance aspects of clearable transfers

    it("Compliance check functions for clearable transfers should work", async () => {
        assert.equal(await instance.canOrderClearableTransfer.call(userAccount1, userAccount2, 10), SUCCESS, "Requesting clearable transfers from whitelisted address is not compliant");
        assert.equal(await instance.canOrderClearableTransfer.call(userAccount1, notWhitelisted1, 10), FAILURE, "Requesting clearable transfers from non whitelisted address passess compliance check");
        assert.equal(await instance.canOrderClearableTransfer.call(notWhitelisted1, userAccount1, 10), FAILURE, "Requesting clearable transfers from non whitelisted address passess compliance check");
        assert.equal(await instance.canApproveToOrderClearableTransfer.call(userAccount2, userAccount3), SUCCESS, "Approving a whitelisted address is not compliant");
        assert.equal(await instance.canApproveToOrderClearableTransfer.call(userAccount2, notWhitelisted2), FAILURE, "Approving a non whitelisted address passes compliance check");
        assert.equal(await instance.canApproveToOrderClearableTransfer.call(notWhitelisted2, userAccount2), FAILURE, "Approving a non whitelisted address passes compliance check");
    })

    it("Not whitelisted addresses should not be able to order payouts", async () => {
        truffleAssert.reverts(instance.orderPayout(CLEARABLE_TRANSFER_ID1, 0, "No particular instructions", {from:notWhitelisted1}), "", "Was able to order payout");
        truffleAssert.reverts(instance.orderPayout(CLEARABLE_TRANSFER_ID1, 10, "No particular instructions", {from:notWhitelisted1}), "", "Was able to order payout");
        truffleAssert.reverts(instance.approveToOrderClearableTransfer(userAccount2, {from:notWhitelisted1}), "", "A non whitelisted address was able to approve");
        await truffleAssert.reverts(instance.approveToOrderClearableTransfer(notWhitelisted1, {from:userAccount2}), "", "Was able to approve a non whitelisted address");
    })

    // Checking clearable transfer process

    // Transaction #1, will be cancelled by orderer

    it("Non submitted clearable transfer requests should not exist", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount2, CLEARABLE_TRANSFER_ID1), false, "Not submitted clearable transfer request seems to exist");
    });

    it("A whitelisted user with enough balance should be able to order clearable transfers", async () => {
        tx = await instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID1, userAccount2, 1000, {from:userAccount1});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 1000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");
//        assert.equal(tx.logs[0].args.expiration, , "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount, 1000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("A clearable transfer just ordered plus its associated hold should exist and should be registered correctly", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID1), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID1);
        assert.equal(_result.from, userAccount1, "From field not correctly registered");
        assert.equal(_result.to, userAccount2, "To field not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");

        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID1), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID1);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Balances and limits should be correctly registered after ordering", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 1000, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000-1000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 5000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), -5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 20000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 150000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 1000, "Total supply on hold not correctly registered");
    })

    it("A clearable transfer request should not be able to be ordered twice", async () => {
        await truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID1, userAccount2, 10, {from:userAccount1}), "", "Was able to re-order clearable transfer");
    });

    it("Non operator (not even owner) should not be able to process, execute or reject clearable transfer request", async () => {
        truffleAssert.reverts(instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:userAccount1}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:userAccount1}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, "No reason", {from:userAccount1}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:userAccount3}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:userAccount3}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, "No reason", {from:userAccount3}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:owner}), "", "Was able to manage clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:owner}), "", "Was able to manage clearable transfer");
        await truffleAssert.reverts(instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, "No reason", {from:owner}), "", "Was able to manage clearable transfer");
    });

    it("Unauthorized addresses should not be able to cancel a clearable transfer request", async () => {
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:userAccount2}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:userAccount3}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:cro}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:owner}), "", "Was able to cancel clearable transfer");
    });

    it("Orderer should be able to cancel a clearable transfer request", async () => {
        tx = await instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:userAccount1});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID1, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in ClearableTransferCancelled event");

        assert.equal(tx.logs[1].event, "ClearableTransferCancelled", "ClearableTransferCancelled event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferCancelled event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID1, "Incorrect argument in ClearableTransferCancelled event");
    });

    it("Cancelled clearable transfer request and the associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID1), true, "Cancelled clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID1);
        assert.equal(_result.from, userAccount1, "From field not correctly registered");
        assert.equal(_result.to, userAccount2, "To field not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Cancelled, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID1), true, "Associated hold does not exist");
        
        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID1);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ReleasedByNotary, "Status not correctly initialized");
    });

    it("Balances and limits should be correctly registered after cancellation", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 5000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), -5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 20000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 150000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    })

    it("Cancelled clearable transfer request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID1, userAccount2, 10, {from:userAccount1}), "", "Was able to re-order clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID1, {from:userAccount1}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:operator}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, {from:operator}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID1, "No reason", {from:operator}), "", "Was able to cancel clearable transfer");
    });

    // Transaction #2, will be put InProcess and executed

    it("(Again) A whitelisted user with enough available balance should be able to order clearable transfers", async () => {
        tx = await instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID2, userAccount2, 10000, {from:userAccount1});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 10000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");
//        assert.equal(tx.logs[0].args.expiration, , "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount, 10000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("(Again) Just ordered clearable transfer request and the associated hold should exist and be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From field not correctly registered");
        assert.equal(_result.to, userAccount2, "To field not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");

        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to put a clearable transfer request in process", async () => {
        tx = await instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID2, {from:operator});
        assert.equal(tx.logs[0].event, "ClearableTransferInProcess", "ClearableTransferInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ClearableTransferInProcess event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID2, "Incorrect argument in ClearableTransferInProcess event");
    });

    it("Clearable transfer request in process and the associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Cancelled clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From field not correctly registered");
        assert.equal(_result.to, userAccount2, "To field not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.InProcess, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Orderer should not be able to cancel or re-order a clearable transfer request that is in process", async () => {
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID2, {from:userAccount1}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID2, userAccount2, 10, {from:userAccount1}), "", "Was able to re-order clearable transfer");
    });

    it("Balances and limits should be correctly registered after clearable transfer has been put in process", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 10000, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000-10000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 5000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), -5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 20000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 150000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 10000, "Total supply on hold not correctly registered");
    })

    it("Operator should be able to execute a clearable transfer in process", async () => {
        tx = await instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID2, {from:operator});

        assert.equal(tx.logs[0].event, "OverdraftDrawn", "OverdraftDrawn event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount1, "Incorrect argument in OverdraftDrawn event");
        assert.equal(tx.logs[0].args.amount, 10000, "Incorrect argument in OverdraftDrawn event");

        assert.equal(tx.logs[1].event, "OverdraftRestored", "OverdraftRestored event not issued");
        assert.equal(tx.logs[1].args.wallet, userAccount2, "Incorrect argument in OverdraftRestored event");
        assert.equal(tx.logs[1].args.amount, 5000, "Incorrect argument in OverdraftRestored event");

        assert.equal(tx.logs[2].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[2].args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[2].args.value, 5000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[3].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[3].args.holder, userAccount1, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[3].args.operationId, CLEARABLE_TRANSFER_ID2, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[3].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[4].event, "ClearableTransferExecuted", "ClearableTransferExecuted event not issued");
        assert.equal(tx.logs[4].args.orderer, userAccount1, "Incorrect argument in ClearableTransferExecuted event");
        assert.equal(tx.logs[4].args.operationId, CLEARABLE_TRANSFER_ID2, "Incorrect argument in ClearableTransferExecuted event");
    });

    it("Executed clearable transfer and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Cancelled clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From field not correctly registered");
        assert.equal(_result.to, userAccount2, "To field not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Executed, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID2), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID2);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 10000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly initialized");
    });

    it("Balances and limits should be correctly registered after clearable transfer has been put in process", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000+10000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000-10000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000-10000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 5000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 30000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 155000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 11000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    })

    it("Executed clearable transfer request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID2, {from:operator}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID2, {from:userAccount1}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.processClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID2, {from:operator}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID2, {from:operator}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID2, "No reason", {from:operator}), "", "Was able to cancel clearable transfer");
    });

    // Transaction #3, will be directly executed

    it("(Again 2) Whitelisted users should be able to request clearable transfer", async () => {
        tx = await instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID3, userAccount1, 2000, {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 2000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,2000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("(Again 2) Just ordered clearable transfer request and the associated hold should exist and be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount2, CLEARABLE_TRANSFER_ID3), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount2, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 2000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount2, CLEARABLE_TRANSFER_ID3), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount2, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, userAccount1, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 2000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Operator should be able to directly execute a clearable transfer request just ordered", async () => {
        tx = await instance.executeClearableTransfer(userAccount2, CLEARABLE_TRANSFER_ID3, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount2, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 2000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "OverdraftRestored", "OverdraftRestored event not issued");
        assert.equal(tx.logs[1].args.wallet, userAccount1, "Incorrect argument in OverdraftRestored event");
        assert.equal(tx.logs[1].args.amount, 2000, "Incorrect argument in OverdraftRestored event");

        assert.equal(tx.logs[2].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[2].args.holder, userAccount2, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[3].event, "ClearableTransferExecuted", "ClearableTransferExecuted event not issued");
        assert.equal(tx.logs[3].args.orderer, userAccount2, "Incorrect argument in ClearableTransferExecuted event");
        assert.equal(tx.logs[3].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in ClearableTransferExecuted event");
    });

    it("Executed clearable transfer and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount2, CLEARABLE_TRANSFER_ID3), true, "Executed clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount2, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 2000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Executed, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount2, CLEARABLE_TRANSFER_ID3), true, "Hold associated to executed clearable transfer request does not exist");

        _result = await instance.retrieveHoldData.call(userAccount2, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, userAccount1, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 2000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Expires not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly initialized");
    });

    it("Executed clearable transfer request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:userAccount2}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.processClearableTransfer(userAccount2, CLEARABLE_TRANSFER_ID3, {from:operator}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.executeClearableTransfer(userAccount2, CLEARABLE_TRANSFER_ID3, {from:operator}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.rejectClearableTransfer(userAccount3, CLEARABLE_TRANSFER_ID3, "No reason", {from:operator}), "", "Was able to cancel clearable transfer");
    });

    it("Balances and limits should be correctly registered after executing clearable transfer", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 3000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 3000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 28000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    });

    it("Nobody should be able to request clearable transfers beyond their available balances", async () => {
        truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID4, userAccount2, 41001, {from:userAccount1}), "", "Was able to request clearable transfer");
        truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID4, userAccount3, 28001, {from:userAccount2}), "", "Was able to request clearable transfer");
        await truffleAssert.reverts(instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID4, userAccount1, 150001, {from:userAccount3}), "", "Was able to request clearable transfer");
    });

    // Transaction #4, will be put InProcess and rejected

    it("(Again 3) Whitelisted users should be able to request clearable transfer", async () => {
        tx = await instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID4, userAccount2, 100000, {from:userAccount3});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 100000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,100000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("(Again 3) Just ordered clearable transfer request and associated hold should be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("(Again 3) Operator should be able to put a clearable transfer request in process", async () => {
        tx = await instance.processClearableTransfer(userAccount3, CLEARABLE_TRANSFER_ID4, {from:operator});
        assert.equal(tx.logs[0].event, "ClearableTransferInProcess", "ClearableTransferInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount3, "Incorrect argument in ClearableTransferInProcess event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in ClearableTransferInProcess event");
    });

    it("(Again 3) Just ordered clearable transfer request and associated hold should be correctly updated", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.InProcess, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Operator should be able to reject a clearable transfer request in process", async () => {
        tx = await instance.rejectClearableTransfer(userAccount3, CLEARABLE_TRANSFER_ID4, "No real reason", {from:operator});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount3, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in ClearableTransferCancelled event");

        assert.equal(tx.logs[1].event, "ClearableTransferRejected", "ClearableTransferRejected event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount3, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.reason, "No real reason", "Incorrect argument in ClearableTransferRejected event");
    });

    it("Rejected clearable transfer request and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Rejected, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount3, CLEARABLE_TRANSFER_ID4), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount3, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ReleasedByNotary, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Balances and limits should be correctly registered after rejecting clearable transfer", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 3000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 3000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 28000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    });

    // Transaction #5, directly rejected

    it("(Again 4) Whitelisted users should be able to request clearable transfer", async () => {
        tx = await instance.orderClearableTransfer(CLEARABLE_TRANSFER_ID5, userAccount1, 1000, {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 1000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,1000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("(Again 4) Just ordered clearable transfer request and associated hold should be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount2, CLEARABLE_TRANSFER_ID5), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount2, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount2, CLEARABLE_TRANSFER_ID5), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount2, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, userAccount1, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Operator should be able to reject a clearable transfer request just ordered", async () => {
        tx = await instance.rejectClearableTransfer(userAccount2, CLEARABLE_TRANSFER_ID5, "No real reason", {from:operator});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in ClearableTransferCancelled event");

        assert.equal(tx.logs[1].event, "ClearableTransferRejected", "ClearableTransferRejected event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.reason, "No real reason", "Incorrect argument in ClearableTransferRejected event");
    });

    it("Rejected clearable transfer request and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount2, CLEARABLE_TRANSFER_ID5), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount2, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Rejected, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount2, CLEARABLE_TRANSFER_ID5), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount2, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, userAccount1, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ReleasedByNotary, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Balances and limits should be correctly registered after executing clearable transfer", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 3000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 3000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 28000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    });

    // Transaction #6, ordered through orderClearableTransferFrom and cancelled

    it("Whitelisted user should be able to approve a whitelisted user to be able to request clearable transfer", async () => {
        tx = await instance.approveToOrderClearableTransfer(userAccount1, {from:userAccount3});
        assert.equal(tx.logs[0].event, "ApprovalToOrderClearableTransfer", "ApprovalToOrderClearableTransfer event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount3, "Incorrect argument in ApprovalToOrderClearableTransfer event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderClearableTransfer event");
    });

    it("Approvals should be correctly reflected", async () => {
        assert.equal(await instance.isApprovedToOrderClearableTransfer.call(userAccount3, userAccount1), true, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderClearableTransfer.call(userAccount1, userAccount2), false, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderClearableTransfer.call(userAccount1, userAccount3), false, "Wrong approval");
    });

    it("Approved users should be able to request clearable transfer on behalf of others", async () => {
        tx = await instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID3, userAccount3, userAccount2, 7000, {from:userAccount1})

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to,userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 7000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,7000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("Just ordered clearable transfer request should be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID3), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID3), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("No one other than orderer should be able to cancel a clearable transfer request", async () => {
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:userAccount3}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:userAccount2}), "", "Was able to cancel clearable transfer");
        truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:owner}), "", "Was able to cancel clearable transfer");
        await truffleAssert.reverts(instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:operator}), "", "Was able to cancel clearable transfer");
    });

    it("Orderer should be able to cancel a clearable transfer request", async () => {
        tx = await instance.cancelClearableTransfer(CLEARABLE_TRANSFER_ID3, {from:userAccount1});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in ClearableTransferCancelled event");

        assert.equal(tx.logs[1].event, "ClearableTransferCancelled", "ClearableTransferCancelled event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferCancelled event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID3, "Incorrect argument in ClearableTransferCancelled event");
    });

    it("Cancelled clearable transfer and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID3), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Cancelled, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID3), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID3);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ReleasedByNotary, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Balances and limits should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 3000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 3000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 28000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    })

    // Transaction #7, ordered through orderClearableTransferFrom and rejected

    it("(Again) Approved users should be able to request clearable transfer on behalf of others", async () => {
        tx = await instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID5, userAccount3, userAccount2, 7000, {from:userAccount1})

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to,userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 7000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,7000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("Just ordered clearable transfer request should be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID5), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID5), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Operator should be able to reject a clearable transfer request in process", async () => {
        tx = await instance.rejectClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID5, "No real reason", {from:operator});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in ClearableTransferCancelled event");

        assert.equal(tx.logs[1].event, "ClearableTransferRejected", "ClearableTransferRejected event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID5, "Incorrect argument in ClearableTransferRejected event");
        assert.equal(tx.logs[1].args.reason, "No real reason", "Incorrect argument in ClearableTransferRejected event");
    });

    it("Rejected clearable transfer and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID5), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Rejected, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID5), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID5);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ReleasedByNotary, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Balances and limits should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 3000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 3000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 28000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 150000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 150000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 150000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    })

    // Transaction #8, ordered through orderClearableTransferFrom and executed

    it("(Again 2) Approved users should be able to request clearable transfer on behalf of others", async () => {
        tx = await instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID4, userAccount3, userAccount2, 7000, {from:userAccount1})

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to,userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 7000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "ClearableTransferOrdered", "ClearableTransferOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.from, userAccount3, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.to, userAccount2, "Incorrect argument in ClearableTransferOrdered event");
        assert.equal(tx.logs[1].args.amount,7000, "Incorrect argument in ClearableTransferOrdered event");
    });

    it("Just ordered clearable transfer request should be correctly stored", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID4), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Ordered, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID4), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("Operator should be able to execute a clearable transfer request in process", async () => {
        tx = await instance.executeClearableTransfer(userAccount1, CLEARABLE_TRANSFER_ID4, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount3, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 7000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[1].args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].args.value, 7000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[2].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[2].args.holder, userAccount1, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[3].event, "ClearableTransferExecuted", "ClearableTransferExecuted event not issued");
        assert.equal(tx.logs[3].args.orderer, userAccount1, "Incorrect argument in ClearableTransferExecuted event");
        assert.equal(tx.logs[3].args.operationId, CLEARABLE_TRANSFER_ID4, "Incorrect argument in ClearableTransferExecuted event");
    });

    it("Rejected clearable transfer and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesClearableTransferExist.call(userAccount1, CLEARABLE_TRANSFER_ID4), true, "Submitted clearable transfer request does not exist");

        _result = await instance.retrieveClearableTransferData.call(userAccount1, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.to, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, ClearableTransferStatusCode.Executed, "Status not correctly initialized");
 
        assert.equal(await instance.doesHoldExist.call(userAccount1, CLEARABLE_TRANSFER_ID4), true, "Associated hold does not exist");

        _result = await instance.retrieveHoldData.call(userAccount1, CLEARABLE_TRANSFER_ID4);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, userAccount2, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 7000, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly initialized");
        assert.equal(_result.expires, false, "Expires not correctly registered");
    });

    it("User shold be able to revoke previously approved users to request clearable transfer", async () => {
        tx = await instance.revokeApprovalToOrderClearableTransfer(userAccount1, {from:userAccount3});
        assert.equal(tx.logs[0].event, "RevokeApprovalToOrderClearableTransfer", "RevokeApprovalToOrderClearableTransfer event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount3, "Incorrect argument in RevokeApprovalToOrderClearableTransfer event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderClearableTransfer event");
    });

    it("Whitelisted but non approved user should not be able to request clearable transfer on behalf of others", async () => {
        truffleAssert.reverts(instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID2, userAccount3, userAccount1, 100, {from:userAccount1}), "", "Was able to order clearable transfer on behalf of others");
        truffleAssert.reverts(instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID2, userAccount2, userAccount3, 100, {from:userAccount1}), "", "Was able to order clearable transfer on behalf of others");
        await truffleAssert.reverts(instance.orderClearableTransferFrom(CLEARABLE_TRANSFER_ID2, userAccount1, userAccount3, 100, {from:userAccount2}), "", "Was able to order clearable transfer on behalf of others");
    });

    it("Balances and limits should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 9000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -9000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount1), 41000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount2), 10000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 10000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 35000, "Available funds not correctly registered");
        
        assert.equal(await instance.balanceOf.call(userAccount3), 143000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 143000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 143000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 153000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 9000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "Total supply on hold not correctly registered");
    })

});
