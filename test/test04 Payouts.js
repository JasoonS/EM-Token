const EMoneyToken = artifacts.require("EMoneyToken");
const truffleAssert = require('truffle-assertions'); // install with: npm install truffle-assertions

var PayoutStatusCode =
    Object.freeze({
        "Nonexistent":0,
        "Ordered":1,
        "InProcess":2,
        "FundsInSuspense":3,
        "Executed":4,
        "Rejected":5,
        "Cancelled":6
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
    const notWhilisted1 = accounts[1]
    const notWhilisted2 = accounts[0]
    const SUSPENSE_WALLET = "0x0000000000000000000000000000000000000000"
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    
    var instance
    var tx
    var _result

    // Constants for this test
    
    const FAILURE = 0x00
    const SUCCESS = 0x01
    
    const PAYOUT_ID1 = "PayoutID1"
    const PAYOUT_ID2 = "PayoutID2"
    const PAYOUT_ID3 = "PayoutID3"
    const PAYOUT_ID4 = "PayoutID4"
    const PAYOUT_ID5 = "PayoutID5"

    before( async () => {
        console.log("  > Now testing payout processes");
        instance = await EMoneyToken.deployed();
        console.log("  > Contract address is", instance.address);
    })

    // Check compliance aspects of payouts

    it("Compliance check functions for payouts should work", async () => {
        assert.equal(await instance.canOrderPayout.call(userAccount1, userAccount1, 10), SUCCESS, "Requesting payouts from whitelisted address is not compliant");
        assert.equal(await instance.canOrderPayout.call(userAccount1, notWhilisted1, 10), FAILURE, "Requesting payouts from non whitelisted address passess compliance check");
        assert.equal(await instance.canOrderPayout.call(notWhilisted1, userAccount1, 10), FAILURE, "Requesting payouts from non whitelisted address passess compliance check");
        assert.equal(await instance.canApproveToOrderPayout.call(userAccount2, userAccount3), SUCCESS, "Approving a whitelisted address is not compliant");
        assert.equal(await instance.canApproveToOrderPayout.call(userAccount2, notWhilisted2), FAILURE, "Approving a non whitelisted address passes compliance check");
        assert.equal(await instance.canApproveToOrderPayout.call(notWhilisted2, userAccount2), FAILURE, "Approving a non whitelisted address passes compliance check");
    })

    // Checking payout process
    
    it("Non submitted payout requests should not exist", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID1), false, "Not submitted payout request seems to exist");
    });

    it("A whitelisted user with enough balance should be able to order payouts", async () => {
        tx = await instance.orderPayout(PAYOUT_ID1, 5000, "Send it to my bank account please", {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 5000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");
//        assert.equal(tx.logs[0].args.expiration, , "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID1, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount, 5000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "Send it to my bank account please", "Incorrect argument in PayoutOrdered event");
    });

    it("A payout just ordered should exist", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID1), true, "Submitted payout request does not exist");
    });

    it("A payout just ordered should be registered correctly", async () => {
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID1);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 5000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("The hold generated by the payout just ordered should be registered correctly", async () => {
        _result = await instance.retrieveHoldData.call(userAccount2, PAYOUT_ID1);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, SUSPENSE_WALLET, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 5000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Balances and limits should be correctly registered after ordering", async () => {
        assert.equal(await instance.balanceOf.call(userAccount2), 250000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 250000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 5000, "Wrong overdraft limit set");
        assert.equal(await instance.availableFunds.call(userAccount2), 250000+25000-5000, "Available funds not correctly registered");

        assert.equal(await instance.totalSupply.call(), 0+250000+350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 0, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 5000, "TOtal supply on hold not correctly registered");
    })

    it("A payout request should not be able to be ordered twice", async () => {
        await truffleAssert.reverts(instance.orderPayout(PAYOUT_ID1, 10, "Send it to my bank account please", {from:userAccount2}), "", "Was able to re-order payout");
    });

    it("Non operator (not even owner) should not be able to process, execute or reject payout request", async () => {
        truffleAssert.reverts(instance.processPayout(userAccount2, PAYOUT_ID1, {from:userAccount2}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.putFundsInSuspenseInPayout(userAccount2, PAYOUT_ID1, {from:userAccount2}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.executePayout(userAccount2, PAYOUT_ID1, {from:userAccount2}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.rejectPayout(userAccount2, PAYOUT_ID1, "No reason", {from:userAccount2}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.processPayout(userAccount2, PAYOUT_ID1, {from:userAccount3}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.putFundsInSuspenseInPayout(userAccount2, PAYOUT_ID1, {from:userAccount3}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.executePayout(userAccount2, PAYOUT_ID1, {from:userAccount3}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.rejectPayout(userAccount2, PAYOUT_ID1, "No reason", {from:userAccount3}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.processPayout(userAccount2, PAYOUT_ID1, {from:owner}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.putFundsInSuspenseInPayout(userAccount2, PAYOUT_ID1, {from:owner}), "", "Was able to manage payout");
        truffleAssert.reverts(instance.executePayout(userAccount2, PAYOUT_ID1, {from:owner}), "", "Was able to manage payout");
        await truffleAssert.reverts(instance.rejectPayout(userAccount1, PAYOUT_ID1, "No reason", {from:owner}), "", "Was able to manage payout");
    });

    it("Unauthorized addresses should not be able to cancel a payout request", async () => {
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:userAccount1}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:userAccount3}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:cro}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:owner}), "", "Was able to cancel payout");
    });

    it("Orderer should be able to cancel a payout request", async () => {
        tx = await instance.cancelPayout(PAYOUT_ID1, {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID1, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in PayoutCancelled event");

        assert.equal(tx.logs[1].event, "PayoutCancelled", "PayoutCancelled event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutCancelled event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID1, "Incorrect argument in PayoutCancelled event");
    });

    it("Cancelled payout request should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID1), true, "Cancelled payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID1);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 5000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Cancelled, "Status not correctly updated");
    });

    it("Balances and limits should be correctly registered after cancellation", async () => {
        assert.equal(await instance.balanceOf.call(userAccount2), 250000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 250000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 250000+25000, "Available funds not correctly registered");

        assert.equal(await instance.totalSupply.call(), 0+250000+350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 0, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    })

    it("Cancelled payout request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.orderPayout(PAYOUT_ID1, 10, "Send it to my bank account please", {from:userAccount2}), "", "Was able to re-order payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:operator}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID1, {from:userAccount2}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.processPayout(userAccount1, PAYOUT_ID1, {from:operator}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.executePayout(userAccount1, PAYOUT_ID1, {from:operator}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.rejectPayout(userAccount1, PAYOUT_ID1, "No reason", {from:operator}), "", "Was able to cancel payout");
    });

    it("(Again) A whitelisted user with enough available balance should be able to order payouts", async () => {
        tx = await instance.orderPayout(PAYOUT_ID2, 1000, "Send it to my bank account please 2", {from:userAccount1});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 1000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");
//        assert.equal(tx.logs[0].args.expiration, , "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount1, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount, 1000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "Send it to my bank account please 2", "Incorrect argument in PayoutOrdered event");
    });

    it("(Again) Just ordered payout request should be correctly stored", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount1, PAYOUT_ID2), true, "Submitted payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID2);
        assert.equal(_result.walletToDebit, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 2", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to put a payout request in process", async () => {
        tx = await instance.processPayout(userAccount1, PAYOUT_ID2, {from:operator});
        assert.equal(tx.logs[0].event, "PayoutInProcess", "PayoutInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in PayoutInProcess event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID2, "Incorrect argument in PayoutInProcess event");
    });

    it("Payout request in process should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount1, PAYOUT_ID2), true, "Cancelled payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID2);
        assert.equal(_result.walletToDebit, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 2", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.InProcess, "Status not correctly updated");
    });

    it("Orderer should not be able to cancel or re-order a payout request that is in process", async () => {
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID2, {from:userAccount1}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.orderPayout(PAYOUT_ID2, 10, "No particular instructions", {from:userAccount1}), "", "Was able to re-order payout");
    });

    it("Operator should not be able to execute a payout that has not put the funds in suspense", async () => {
        await truffleAssert.reverts(instance.executePayout(userAccount1, PAYOUT_ID2, {from:operator}), "", "Was able to execute payout");
    });

    it("Operator should be able to put the funds in suspense", async () => {
        tx = await instance.putFundsInSuspenseInPayout(userAccount1, PAYOUT_ID2, {from:operator});

        assert.equal(tx.logs[0].event, "OverdraftDrawn", "OverdraftDrawn event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount1, "Incorrect argument in OverdraftDrawn event");
        assert.equal(tx.logs[0].args.amount, 1000, "Incorrect argument in OverdraftDrawn event");

        assert.equal(tx.logs[1].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[1].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].args.value, 1000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[2].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[2].args.holder, userAccount1, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.operationId, PAYOUT_ID2, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[3].event, "PayoutFundsInSuspense", "PayoutFundsInSuspense event not issued");
        assert.equal(tx.logs[3].args.orderer, userAccount1, "Incorrect argument in PayoutFundsInSuspense event");
        assert.equal(tx.logs[3].args.operationId, PAYOUT_ID2, "Incorrect argument in PayoutFundsInSuspense event");
    });

    it("A payout just put in suspense should be registered correctly", async () => {
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID2);
        assert.equal(_result.walletToDebit, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 2", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.FundsInSuspense, "Status not correctly initialized");
    });

    it("The hold generated by the payout just ordered should be registered correctly", async () => {
        _result = await instance.retrieveHoldData.call(userAccount1, PAYOUT_ID2);
        assert.equal(_result.from, userAccount1, "From not correctly registered");
        assert.equal(_result.to, SUSPENSE_WALLET, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly initialized");
    });

    it("Balances and limits should be correctly registered after putting funds in suspense", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong overdraft limit set");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 1000, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 0+250000+350000+1000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 1000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    })

    it("Operator should not be able to process or reject a payout that has put funds in suspense", async () => {
        truffleAssert.reverts(instance.processPayout(userAccount1, PAYOUT_ID2, {from:operator}), "", "Was able to reject payout");
        await truffleAssert.reverts(instance.rejectPayout(userAccount1, PAYOUT_ID2, "No particular reason", {from:operator}), "", "Was able to reject payout");
    });

    it("Operator should be able to execute a payout with funds in suspense", async () => {
        tx = await instance.executePayout(userAccount1, PAYOUT_ID2, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 1000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "PayoutExecuted", "PayoutExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in PayoutExecuted event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID2, "Incorrect argument in PayoutExecuted event");
    });

    it("Executed payout should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount1, PAYOUT_ID2), true, "Cancelled payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID2);
        assert.equal(_result.walletToDebit, userAccount1, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 2", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Executed, "Status not correctly updated");
    });

    it("Balances and limits should be correctly registered after executing payout", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong overdraft limit set");
        assert.equal(await instance.availableFunds.call(userAccount1), 50000-1000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 0+250000+350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 1000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    })

    it("Executed payout request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID2, {from:operator}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID2, {from:userAccount1}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.processPayout(userAccount1, PAYOUT_ID2, {from:operator}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.executePayout(userAccount1, PAYOUT_ID2, {from:operator}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.rejectPayout(userAccount1, PAYOUT_ID2, "No reason", {from:operator}), "", "Was able to cancel payout");
    });

    it("(Again 2) Whitelisted users should be able to request payout", async () => {
        tx = await instance.orderPayout(PAYOUT_ID3, 255000, "Send it to my bank account please 3", {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 255000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount,255000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "Send it to my bank account please 3", "Incorrect argument in PayoutOrdered event");
    });

    it("(Again 2) Just ordered payout request should be correctly stored", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID3), true, "Submitted payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID3);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 255000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 3", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to put funds in suspense and execute a payout request just ordered", async () => {
        tx = await instance.putFundsInSuspenseInPayout(userAccount2, PAYOUT_ID3, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount2, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 250000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "OverdraftDrawn", "OverdraftDrawn event not issued");
        assert.equal(tx.logs[1].args.wallet, userAccount2, "Incorrect argument in OverdraftDrawn event");
        assert.equal(tx.logs[1].args.amount, 5000, "Incorrect argument in OverdraftDrawn event");

        assert.equal(tx.logs[2].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[2].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[2].args.value, 255000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[3].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[3].args.holder, userAccount2, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[3].args.operationId, PAYOUT_ID3, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[3].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[4].event, "PayoutFundsInSuspense", "PayoutFundsInSuspense event not issued");
        assert.equal(tx.logs[4].args.orderer, userAccount2, "Incorrect argument in PayoutFundsInSuspense event");
        assert.equal(tx.logs[4].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutFundsInSuspense event");

        tx = await instance.executePayout(userAccount2, PAYOUT_ID3, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 255000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "PayoutExecuted", "PayoutExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutExecuted event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutExecuted event");
    });

    it("Executed payout and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID3), true, "Executed payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID3);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 255000, "Amount not correctly registered");
        assert.equal(_result.instructions, "Send it to my bank account please 3", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Executed, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount2, PAYOUT_ID3), true, "Hold associated to executed payout request does not exist");
        _result = await instance.retrieveHoldData.call(userAccount2, PAYOUT_ID3);
        assert.equal(_result.from, userAccount2, "From not correctly registered");
        assert.equal(_result.to, SUSPENSE_WALLET, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 255000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly initialized");
    });

    it("Executed payout request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID3, {from:userAccount2}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.processPayout(userAccount2, PAYOUT_ID3, {from:operator}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.executePayout(userAccount2, PAYOUT_ID3, {from:operator}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.rejectPayout(userAccount3, PAYOUT_ID3, "No reason", {from:operator}), "", "Was able to cancel payout");
    });

    it("Balances and limits should be correctly registered after executing payout", async () => {
        assert.equal(await instance.balanceOf.call(userAccount2), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 5000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), -5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 20000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    });

    it("Nobody should be able to request payouts beyond their available balances", async () => {
        truffleAssert.reverts(instance.orderPayout(PAYOUT_ID4, 50000-1000+1, "Whatever", {from:userAccount1}), "", "Was able to request payout");
        truffleAssert.reverts(instance.orderPayout(PAYOUT_ID4, 20000+1, "Whatever", {from:userAccount2}), "", "Was able to request payout");
        await truffleAssert.reverts(instance.orderPayout(PAYOUT_ID4, 350000+1, "Whatever", {from:userAccount3}), "", "Was able to request payout");
    });

    it("(Again 3) Whitelisted users should be able to request payout", async () => {
        tx = await instance.orderPayout(PAYOUT_ID4, 100000, "No particular instructions 4", {from:userAccount3});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID4, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 100000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount3, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID4, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount3, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount,100000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "No particular instructions 4", "Incorrect argument in PayoutOrdered event");
    });

    it("(Again 3) Just ordered payout request should be correctly stored", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount3, PAYOUT_ID4), true, "Submitted payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount3, PAYOUT_ID4);
        assert.equal(_result.walletToDebit, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("(Again 3) Operator should be able to put a payout request in process", async () => {
        tx = await instance.processPayout(userAccount3, PAYOUT_ID4, {from:operator});
        assert.equal(tx.logs[0].event, "PayoutInProcess", "PayoutInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount3, "Incorrect argument in PayoutInProcess event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID4, "Incorrect argument in PayoutInProcess event");
    });

    it("Operator should be able to reject a payout request in process", async () => {
        tx = await instance.rejectPayout(userAccount3, PAYOUT_ID4, "No real reason", {from:operator});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount3, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID4, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in PayoutCancelled event");

        assert.equal(tx.logs[1].event, "PayoutRejected", "PayoutRejected event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount3, "Incorrect argument in PayoutRejected event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID4, "Incorrect argument in PayoutRejected event");
        assert.equal(tx.logs[1].args.reason, "No real reason", "Incorrect argument in PayoutRejected event");
    });

    it("Executed payout request should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount3, PAYOUT_ID4), true, "Cancelled payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount3, PAYOUT_ID4);
        assert.equal(_result.walletToDebit, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Rejected, "Status not correctly updated");
    });

    it("Balances and limits should be correctly registered after rejecting payout", async () => {
        assert.equal(await instance.balanceOf.call(userAccount3), 350000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 350000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount3), 0, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount3), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount3), 350000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    });

    it("(Again 4) Whitelisted users should be able to request payout", async () => {
        tx = await instance.orderPayout(PAYOUT_ID5, 1000, "No particular instructions 5", {from:userAccount2});

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID5, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount2, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 1000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID5, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount2, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount,1000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "No particular instructions 5", "Incorrect argument in PayoutOrdered event");
    });

    it("(Again 4) Just ordered payout request should be correctly stored", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID5), true, "Submitted payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID5);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to reject a payout request just ordered", async () => {
        tx = await instance.rejectPayout(userAccount2, PAYOUT_ID5, "No real reason", {from:operator});

        assert.equal(tx.logs[0].event, "HoldReleased", "HoldReleased event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount2, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID5, "Incorrect argument in HoldReleased event");
        assert.equal(tx.logs[0].args.status, HoldStatusCode.ReleasedByNotary, "Incorrect argument in PayoutCancelled event");

        assert.equal(tx.logs[1].event, "PayoutRejected", "PayoutRejected event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in PayoutRejected event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID5, "Incorrect argument in PayoutRejected event");
        assert.equal(tx.logs[1].args.reason, "No real reason", "Incorrect argument in PayoutRejected event");
    });

    it("Executed payout request should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount2, PAYOUT_ID5), true, "Cancelled payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount2, PAYOUT_ID5);
        assert.equal(_result.walletToDebit, userAccount2, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 1000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Rejected, "Status not correctly updated");
    });

    it("Balances and limits should be correctly registered after executing payout", async () => {
        assert.equal(await instance.balanceOf.call(userAccount2), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 5000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), -5000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount2), 25000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount2), 0, "Wrong balance on hold");
        assert.equal(await instance.availableFunds.call(userAccount2), 20000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(SUSPENSE_WALLET), 0, "Balance in suspense wallet not correctly registered");

        assert.equal(await instance.totalSupply.call(), 350000, "Total suuply not correctly registered");
        assert.equal(await instance.totalDrawnAmount.call(), 6000, "Total drawn amount not correctly registered");
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    });

    it("Non whitelisted users should be able to be approved to request funding on behalf of others", async () => {
        await truffleAssert.reverts(instance.approveToOrderPayout(notWhilisted1, {from:userAccount2}), "", "Was able to approve a non whitelisted address");
    });

    it("Whitelisted user should be able to approve a whitelisted user to be able to request payout", async () => {
        tx = await instance.approveToOrderPayout(userAccount1, {from:userAccount3});
        assert.equal(tx.logs[0].event, "ApprovalToOrderPayout", "ApprovalToOrderPayout event not issued");
        assert.equal(tx.logs[0].args.walletToDebit, userAccount3, "Incorrect argument in ApprovalToOrderPayout event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderPayout event");
    });

    it("Approvals should be correctly reflected", async () => {
        assert.equal(await instance.isApprovedToOrderPayout.call(userAccount3, userAccount1), true, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderPayout.call(userAccount1, userAccount2), false, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderPayout.call(userAccount1, userAccount3), false, "Wrong approval");
    });

    it("Approved users should be able to request payout on behalf of others", async () => {
        tx = await instance.orderPayoutFrom(PAYOUT_ID3, userAccount3, 200000, "No particular instructions 6", {from:userAccount1})

        assert.equal(tx.logs[0].event, "HoldCreated", "HoldCreated event not issued");
        assert.equal(tx.logs[0].args.holder, userAccount1, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.operationId, PAYOUT_ID3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.from, userAccount3, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.to, SUSPENSE_WALLET, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.notary, ZERO_ADDRESS, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.amount, 200000, "Incorrect argument in HoldCreated event");
        assert.equal(tx.logs[0].args.expires, false, "Incorrect argument in HoldCreated event");

        assert.equal(tx.logs[1].event, "PayoutOrdered", "PayoutOrdered event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.walletToDebit, userAccount3, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.amount,200000, "Incorrect argument in PayoutOrdered event");
        assert.equal(tx.logs[1].args.instructions, "No particular instructions 6", "Incorrect argument in PayoutOrdered event");
    });

    it("Just ordered payout request should be correctly stored", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount1, PAYOUT_ID3), true, "Submitted payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID3);
        assert.equal(_result.walletToDebit, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 200000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Amount not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Ordered, "Status not correctly initialized");
    });

    it("No one other than orderer should be able to cancel a payout request", async () => {
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID3, {from:userAccount3}), "", "Was able to cancel payout");
        truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID3, {from:owner}), "", "Was able to cancel payout");
        await truffleAssert.reverts(instance.cancelPayout(PAYOUT_ID3, {from:operator}), "", "Was able to cancel payout");
    });

    it("Operator should be able to put funds in suspense and execute a payout request just ordered", async () => {
        tx = await instance.putFundsInSuspenseInPayout(userAccount1, PAYOUT_ID3, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceDecrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount3, "Incorrect argument in BalanceDecrease event");
        assert.equal(tx.logs[0].args.value, 200000, "Incorrect argument in BalanceDecrease event");

        assert.equal(tx.logs[1].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[1].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].args.value, 200000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[2].event, "HoldExecuted", "HoldExecuted event not issued");
        assert.equal(tx.logs[2].args.holder, userAccount1, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.operationId, PAYOUT_ID3, "Incorrect argument in HoldExecuted event");
        assert.equal(tx.logs[2].args.status, HoldStatusCode.ExecutedByNotary, "Incorrect argument in HoldExecuted event");

        assert.equal(tx.logs[3].event, "PayoutFundsInSuspense", "PayoutFundsInSuspense event not issued");
        assert.equal(tx.logs[3].args.orderer, userAccount1, "Incorrect argument in PayoutFundsInSuspense event");
        assert.equal(tx.logs[3].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutFundsInSuspense event");

        tx = await instance.executePayout(userAccount1, PAYOUT_ID3, {from:operator});

        assert.equal(tx.logs[0].event, "BalanceDecrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[0].args.wallet, SUSPENSE_WALLET, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[0].args.value, 200000, "Incorrect argument in BalanceIncrease event");

        assert.equal(tx.logs[1].event, "PayoutExecuted", "PayoutExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in PayoutExecuted event");
        assert.equal(tx.logs[1].args.operationId, PAYOUT_ID3, "Incorrect argument in PayoutExecuted event");
    });

    it("Executed payout and associated hold should be correctly reflected", async () => {
        assert.equal(await instance.doesPayoutExist.call(userAccount1, PAYOUT_ID3), true, "Executed payout request does not exist");
        _result = await instance.retrievePayoutData.call(userAccount1, PAYOUT_ID3);
        assert.equal(_result.walletToDebit, userAccount3, "walletToDebit not correctly registered");
        assert.equal(_result.amount, 200000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Instructions not correctly registered");
        assert.equal(_result.status, PayoutStatusCode.Executed, "Status not correctly updated");

        assert.equal(await instance.doesHoldExist.call(userAccount1, PAYOUT_ID3), true, "Hold associated to executed payout request does not exist");
        _result = await instance.retrieveHoldData.call(userAccount1, PAYOUT_ID3);
        assert.equal(_result.from, userAccount3, "From not correctly registered");
        assert.equal(_result.to, SUSPENSE_WALLET, "To not correctly registered");
        assert.equal(_result.notary, ZERO_ADDRESS, "Notary not correctly registered");
        assert.equal(_result.amount, 200000, "Amount not correctly registered");
        assert.equal(_result.expires, false, "Amount not correctly registered");
        assert.equal(_result.status, HoldStatusCode.ExecutedByNotary, "Status not correctly recorded");
    });

    it("User shold be able to revoke previously approved users to request payout", async () => {
        tx = await instance.revokeApprovalToOrderPayout(userAccount1, {from:userAccount3});
        assert.equal(tx.logs[0].event, "RevokeApprovalToOrderPayout", "RevokeApprovalToOrderPayout event not issued");
        assert.equal(tx.logs[0].args.walletToDebit, userAccount3, "Incorrect argument in RevokeApprovalToOrderPayout event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderPayout event");
    });

    it("Whitelisted but non approved user should not be able to request payout on behalf of others", async () => {
        truffleAssert.reverts(instance.orderPayoutFrom(PAYOUT_ID5, userAccount3, 100, "Some instructions", {from:userAccount1}), "", "Was able to order payout on behalf of others");
        truffleAssert.reverts(instance.orderPayoutFrom(PAYOUT_ID5, userAccount2, 100, "Some instructions", {from:userAccount1}), "", "Was able to order payout on behalf of others");
        await truffleAssert.reverts(instance.orderPayoutFrom(PAYOUT_ID2, userAccount1, 10000, "Some instructions", {from:userAccount2}), "", "Was able to order payout on behalf of others");
    });

    it("Balances and limits should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 1000, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), -1000, "Net balance not correctly registered");
        assert.equal(await instance.unsecuredOverdraftLimit.call(userAccount1), 50000, "Wrong overdraft limit set");
        assert.equal(await instance.balanceOnHold.call(userAccount1), 0, "Wrong overdraft limit set");
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
        assert.equal(await instance.totalSupplyOnHold.call(), 0, "TOtal supply on hold not correctly registered");
    })

});
