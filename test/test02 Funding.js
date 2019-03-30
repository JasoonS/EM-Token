const EMoneyToken = artifacts.require("EMoneyToken");
const truffleAssert = require('truffle-assertions'); // install with: npm install truffle-assertions

var FundingStatusCode = Object.freeze({"Nonexistent":0, "Ordered":1, "InProcess":2, "Executed":3, "Rejected":4, "Cancelled":5});

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
    
    const FUNDING_ID1 = "FundingID1"
    const FUNDING_ID2 = "FundingID2"
    const FUNDING_ID3 = "FundingID3"
    const FUNDING_ID4 = "FundingID4"
    const FUNDING_ID5 = "FundingID5"
    const FUNDING_ID6 = "FundingID6"
    
    before( async () => {
        console.log("  > Now testing funding processes");
        instance = await EMoneyToken.deployed();
        console.log("  > Contract address is", instance.address);
    })

    // Check compliance aspects of funding

    it("Compliance check functions for funding should work", async () => {
        assert.equal(await instance.canOrderFunding.call(userAccount1, userAccount1, 10), SUCCESS, "Requesting funding from whitelisted address is not compliant");
        assert.equal(await instance.canOrderFunding.call(userAccount1, notWhilisted1, 10), FAILURE, "Requesting funding from non whitelisted address passess compliance check");
        assert.equal(await instance.canApproveToOrderFunding.call(userAccount2, userAccount3), SUCCESS, "Approving a whitelisted address is not compliant");
        assert.equal(await instance.canApproveToOrderFunding.call(userAccount2, notWhilisted2), FAILURE, "Approving a non whitelisted address passes compliance check");
    })

    // Checking funding process
    
    // Transaction #1, will be cancelled by orderer

    it("Should provide working workflows for funding requests", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID1), false, "Not submitted funding request seems to exist");

        tx = await instance.orderFunding(FUNDING_ID1, 250000, "No particular instructions", {from:userAccount1});
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount, 250000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions", "Incorrect argument in FundingOrdered event");

        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID1), true, "Submitted funding request does not exist");

        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID1);
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 250000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("A funding request should not be able to be ordered twice", async () => {
        await truffleAssert.reverts(instance.orderFunding(FUNDING_ID1, 250000, "No particular instructions", {from:userAccount1}), "", "Was able to re-order funding");
    });

    it("Non operator (not even owner) should not be able to process, execute or reject funding request", async () => {
        truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:userAccount1}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:userAccount1}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:userAccount1}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:userAccount2}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:userAccount2}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:userAccount2}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:owner}), "", "Was able to manage funding");
        truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:owner}), "", "Was able to manage funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:owner}), "", "Was able to manage funding");
    });

    it("No one other than orderer should be able to cancel a funding request", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:userAccount2}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:owner}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
    });

    it("Orderer should be able to cancel a funding request", async () => {
        tx = await instance.cancelFunding(FUNDING_ID1, {from:userAccount1});
        assert.equal(tx.logs[0].event, "FundingCancelled", "FundingCancelled event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingCancelled event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID1, "Incorrect argument in FundingCancelled event");
    });

    it("Cancelled funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID1), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID1);
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 250000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Cancelled, "Status not correctly updated");
    });

    it("Cancelled funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID1, {from:userAccount1}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.processFunding(userAccount1, FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.executeFunding(userAccount1, FUNDING_ID1, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount1, FUNDING_ID1, "No reason", {from:operator}), "", "Was able to cancel funding");
    });

    // Transaction #2, will be put in process and executed

    it("(Again) Whitelisted users should be able to request funding", async () => {
        tx = await instance.orderFunding(FUNDING_ID2, 150000, "No particular instructions 2", {from:userAccount2});
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,150000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 2", "Incorrect argument in FundingOrdered event");
    });

    it("(Again) Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount2, FUNDING_ID2), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount2, FUNDING_ID2);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 150000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 2", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to put a funding request in process", async () => {
        tx = await instance.processFunding(userAccount2, FUNDING_ID2, {from:operator});
        assert.equal(tx.logs[0].event, "FundingInProcess", "FundingInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount2, "Incorrect argument in FundingInProcess event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID2, "Incorrect argument in FundingInProcess event");
    });

    it("Funding request in process should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount2, FUNDING_ID2), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount2, FUNDING_ID2);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 150000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 2", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.InProcess, "Status not correctly updated");
    });

    it("Orderer should not be able to cancel or re-oreder a funding request that is in process", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:userAccount2}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.orderFunding(FUNDING_ID2, 250000, "No particular instructions", {from:userAccount2}), "", "Was able to re-order funding");
    });

    it("Operator should be able to execute a funding request in process", async () => {
        tx = await instance.executeFunding(userAccount2, FUNDING_ID2, {from:operator});
        assert.equal(tx.logs[0].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[0].args.value, 150000, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].event, "FundingExecuted", "FundingExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount2, "Incorrect argument in FundingExecuted event");
        assert.equal(tx.logs[1].args.operationId, FUNDING_ID2, "Incorrect argument in FundingExecuted event");
    });

    it("Executed funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount2, FUNDING_ID2), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount2, FUNDING_ID2);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 150000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 2", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
    });

    it("Executed funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:userAccount2}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.processFunding(userAccount2, FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.executeFunding(userAccount2, FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount2, FUNDING_ID2, "No reason", {from:operator}), "", "Was able to cancel funding");
    });

    // Transaction #3, will be executed

    it("(Again 2) Whitelisted users should be able to request funding", async () => {
        tx = await instance.orderFunding(FUNDING_ID3, 350000, "No particular instructions 3", {from:userAccount3});
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount3, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID3, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount3, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,350000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 3", "Incorrect argument in FundingOrdered event");
    });

    it("(Again 2) Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount3, FUNDING_ID3), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount3, FUNDING_ID3);
        assert.equal(_result.walletToFund, userAccount3, "walletToFund not correctly registered");
        assert.equal(_result.amount, 350000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 3", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to execute a funding request just ordered", async () => {
        tx = await instance.executeFunding(userAccount3, FUNDING_ID3, {from:operator});
        assert.equal(tx.logs[0].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount3, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[0].args.value, 350000, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].event, "FundingExecuted", "FundingExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount3, "Incorrect argument in FundingExecuted event");
        assert.equal(tx.logs[1].args.operationId, FUNDING_ID3, "Incorrect argument in FundingExecuted event");
    });

    it("Executed funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount3, FUNDING_ID3), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount3, FUNDING_ID3);
        assert.equal(_result.walletToFund, userAccount3, "walletToFund not correctly registered");
        assert.equal(_result.amount, 350000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 3", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
    });

    it("Executed funding request should not be able to be reordered, cancelled, processed, executed or rejected", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID3, {from:userAccount3}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.processFunding(userAccount3, FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.executeFunding(userAccount3, FUNDING_ID3, {from:operator}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.rejectFunding(userAccount3, FUNDING_ID3, "No reason", {from:operator}), "", "Was able to cancel funding");
    });

    // Transaction #4, will be put in process and rejected

    it("(Again 3) Whitelisted users should be able to request funding", async () => {
        tx = await instance.orderFunding(FUNDING_ID4, 100000, "No particular instructions 4", {from:userAccount1});
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID4, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 4", "Incorrect argument in FundingOrdered event");
    });

    it("(Again 3) Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID4), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID4);
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("(Again 3) Operator should be able to put a funding request in process", async () => {
        tx = await instance.processFunding(userAccount1, FUNDING_ID4, {from:operator});
        assert.equal(tx.logs[0].event, "FundingInProcess", "FundingInProcess event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingInProcess event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID4, "Incorrect argument in FundingInProcess event");
    });

    it("Operator should be able to reject a funding request in process", async () => {
        tx = await instance.rejectFunding(userAccount1, FUNDING_ID4, "No real reason", {from:operator});
        assert.equal(tx.logs[0].event, "FundingRejected", "FundingRejected event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID4, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.reason, "No real reason", "Incorrect argument in FundingRejected event");
    });

    it("Rejected funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID4), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID4);
        assert.equal(_result.walletToFund, userAccount1, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 4", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Rejected, "Status not correctly updated");
    });

    // Transaction #5, will be directly rejected

    it("(Again 4) Whitelisted users should be able to request funding", async () => {
        tx = await instance.orderFunding(FUNDING_ID1, 100000, "No particular instructions 5", {from:userAccount2});
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 5", "Incorrect argument in FundingOrdered event");
    });

    it("(Again 4) Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount2, FUNDING_ID1), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount2, FUNDING_ID1);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to reject a funding request just ordered", async () => {
        tx = await instance.rejectFunding(userAccount2, FUNDING_ID1, "No real reason", {from:operator});
        assert.equal(tx.logs[0].event, "FundingRejected", "FundingRejected event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount2, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID1, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.reason, "No real reason", "Incorrect argument in FundingRejected event");
    });

    it("Rejected funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount2, FUNDING_ID1), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount2, FUNDING_ID1);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 5", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Rejected, "Status not correctly updated");
    });

    // Transaction #6, will be ordered through orderFundingFrom and cancelled

    it("Non whitelisted users should not be able to be approved to request funding on behalf of others", async () => {
        await truffleAssert.reverts(instance.approveToOrderFunding(notWhilisted1, {from:userAccount2}), "", "Was able to approve a non whitelisted address");
    });

    it("Whitelisted user should be able to approve a whitelisted user to be able to request funding", async () => {
        tx = await instance.approveToOrderFunding(userAccount1, {from:userAccount2});
        assert.equal(tx.logs[0].event, "ApprovalToOrderFunding", "ApprovalToOrderFunding event not issued");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in ApprovalToOrderFunding event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderFunding event");
    });

    it("Approvals should be correctly reflected", async () => {
        assert.equal(await instance.isApprovedToOrderFunding.call(userAccount2, userAccount1), true, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderFunding.call(userAccount1, userAccount2), false, "Wrong approval");
        assert.equal(await instance.isApprovedToOrderFunding.call(userAccount1, userAccount3), false, "Wrong approval");
    });

    it("Approved users should be able to request funding on behalf of others", async () => {
        tx = await instance.orderFundingFrom(FUNDING_ID2, userAccount2, 100000, "No particular instructions 6", {from:userAccount1})
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 6", "Incorrect argument in FundingOrdered event");
    });

    it("Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID2), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID2);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("No one other than orderer should be able to cancel a funding request", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:userAccount2}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:owner}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID2, {from:operator}), "", "Was able to cancel funding");
    });

    it("Orderer should be able to cancel a funding request just ordered", async () => {
        tx = await instance.cancelFunding(FUNDING_ID2, {from:userAccount1});
        assert.equal(tx.logs[0].event, "FundingCancelled", "FundingCancelled event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingCancelled event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID2, "Incorrect argument in FundingCancelled event");
    });

    it("Cancelled funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID2), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID2);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Cancelled, "Status not correctly updated");
    });

    // Transaction #7, will be ordered through orderFundingFrom and rejected

    it("(Again) Approved users should be able to request funding on behalf of others", async () => {
        tx = await instance.orderFundingFrom(FUNDING_ID3, userAccount2, 100000, "No particular instructions 6", {from:userAccount1})
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID3, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 6", "Incorrect argument in FundingOrdered event");
    });

    it("Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID3), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID3);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("Operator should be able to reject a funding request just ordered", async () => {
        tx = await instance.rejectFunding(userAccount1, FUNDING_ID3, "No particular reason", {from:operator});
        assert.equal(tx.logs[0].event, "FundingRejected", "FundingRejected event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID3, "Incorrect argument in FundingRejected event");
        assert.equal(tx.logs[0].args.reason, "No particular reason", "Incorrect argument in FundingRejected event");
    });

    it("Rejected funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID3), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID3);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Rejected, "Status not correctly updated");
    });

    // Transaction #8, will be ordered through orderFundingFrom and executed

    it("(Again 2) Approved users should be able to request funding on behalf of others", async () => {
        tx = await instance.orderFundingFrom(FUNDING_ID5, userAccount2, 100000, "No particular instructions 6", {from:userAccount1})
        assert.equal(tx.logs[0].event, "FundingOrdered", "FundingOrdered event not issued");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.operationId, FUNDING_ID5, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.amount,100000, "Incorrect argument in FundingOrdered event");
        assert.equal(tx.logs[0].args.instructions, "No particular instructions 6", "Incorrect argument in FundingOrdered event");
    });

    it("Just ordered funding request should be correctly stored", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID5), true, "Submitted funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID5);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Amount not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Ordered, "Status not correctly initialized");
    });

    it("No one other than orderer should be able to cancel a funding request", async () => {
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID5, {from:userAccount2}), "", "Was able to cancel funding");
        truffleAssert.reverts(instance.cancelFunding(FUNDING_ID5, {from:owner}), "", "Was able to cancel funding");
        await truffleAssert.reverts(instance.cancelFunding(FUNDING_ID5, {from:operator}), "", "Was able to cancel funding");
    });

    it("Operator should be able to execute a funding request just ordered", async () => {
        tx = await instance.executeFunding(userAccount1, FUNDING_ID5, {from:operator});
        assert.equal(tx.logs[0].event, "BalanceIncrease", "BalanceIncrease event not issued");
        assert.equal(tx.logs[0].args.wallet, userAccount2, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[0].args.value, 100000, "Incorrect argument in BalanceIncrease event");
        assert.equal(tx.logs[1].event, "FundingExecuted", "FundingExecuted event not issued");
        assert.equal(tx.logs[1].args.orderer, userAccount1, "Incorrect argument in FundingExecuted event");
        assert.equal(tx.logs[1].args.operationId, FUNDING_ID5, "Incorrect argument in FundingExecuted event");
    });

    it("Executed funding request should be correctly reflected", async () => {
        assert.equal(await instance.doesFundingExist.call(userAccount1, FUNDING_ID5), true, "Cancelled funding request does not exist");
        _result = await instance.retrieveFundingData.call(userAccount1, FUNDING_ID5);
        assert.equal(_result.walletToFund, userAccount2, "walletToFund not correctly registered");
        assert.equal(_result.amount, 100000, "Amount not correctly registered");
        assert.equal(_result.instructions, "No particular instructions 6", "Instructions not correctly registered");
        assert.equal(_result.status, FundingStatusCode.Executed, "Status not correctly updated");
    });

    it("User shold be able to revoke previously approved users to request funding", async () => {
        tx = await instance.revokeApprovalToOrderFunding(userAccount1, {from:userAccount2});
        assert.equal(tx.logs[0].event, "RevokeApprovalToOrderFunding", "RevokeApprovalToOrderFunding event not issued");
        assert.equal(tx.logs[0].args.walletToFund, userAccount2, "Incorrect argument in RevokeApprovalToOrderFunding event");
        assert.equal(tx.logs[0].args.orderer, userAccount1, "Incorrect argument in ApprovalToOrderFunding event");
    });

    it("Whitelisted but non approved user should not be able to request funding on behalf of others", async () => {
        await truffleAssert.reverts(instance.orderFundingFrom(FUNDING_ID6, userAccount2, 10000, "Some instructions", {from:userAccount1}), "", "Was able to order funding on behalf of others");
    });

    it("Balances should be correctly registered", async () => {
        assert.equal(await instance.balanceOf.call(userAccount1), 0, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount1), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount1), 0, "Net balance not correctly registered");
        assert.equal(await instance.availableFunds.call(userAccount1), 0, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(userAccount2), 250000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount2), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount2), 250000, "Net balance not correctly registered");
        assert.equal(await instance.availableFunds.call(userAccount2), 250000, "Available funds not correctly registered");

        assert.equal(await instance.balanceOf.call(userAccount3), 350000, "Balance not correctly registered");
        assert.equal(await instance.drawnAmount.call(userAccount3), 0, "Drawn amount not correctly registered");
        assert.equal(await instance.netBalanceOf.call(userAccount3), 350000, "Net balance not correctly registered");
        assert.equal(await instance.availableFunds.call(userAccount3), 350000, "Available funds not correctly registered");
    })
    
});
