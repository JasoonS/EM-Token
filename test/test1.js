const EMoneyToken = artifacts.require("EMoneyToken");

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

    var EternalStorageAddr = "0x76dD02b760968079B4d9Ba9E12C8c42D248A08E8"
    var ZeroAddr = "0x0000000000000000000000000000000000000000"
  
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
        instance.name.call({from:owner}).then(_name => {
            assert.equal(_name, Name, "Name not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct symbol", done => {
        instance.symbol.call({from:owner}).then(_symbol => {
            assert.equal(_symbol, Symbol, "Symbol not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct currency", done => {
        instance.currency.call({from:owner}).then(_currency => {
            assert.equal(_currency, Currency, "Currency not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should start with the correct number of decimals", done => {
        instance.decimals.call({from:owner}).then(_decimals => {
            assert.equal(_decimals, Decimals, "Decimals not set correctly");
        })
        .then(done).catch(done);
    });

    it("Should havethe correct version", done => {
        instance.ersion.call({from:owner}).then(_version => {
            assert.equal(_version, Version, "Wrong version!");
        })
        .then(done).catch(done);
    });


    // Now testing ownership

    it("Should start with the correct owner", done => {
        instance.owner.call().then(_owner => {
            assert.equal(_owner, ownerAccount, "Owner not set correctly");
        })
        .then(done).catch(done);
    });

    it("Function isOwner() should return true when called from owner address", done => {
        instance.isOwner.call({from:ownerAccount}).then(_result => {
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
        instance.transferOwnership(userAccount1, {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0];
            assert.equal(event.event, "OwnershipTransferred", "OwnershipTransferred event not issued");
            assert.equal(event.args.previousOwner, ownerAccount, "Incorrect argument in OwnershipTransferred event");
            assert.equal(event.args.newOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
            instance.owner.call().then(_owner => {
                assert.equal(_owner, userAccount1, "Owner not transferred correctly");
            })
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to transfer ownership", done => {
        instance.transferOwnership(ownerAccount, {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.owner.call().then(_owner => {
                assert.equal(_owner, userAccount1, "Ownership was transferred");
            })
        })
        .then(done).catch(done);
    });

    it("New owner should be able to transfer ownership", done => {
        instance.transferOwnership(ownerAccount, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "OwnershipTransferred", "OwnershipTransferred event not issued");
            assert.equal(event.args.previousOwner, userAccount1, "Incorrect argument in OwnershipTransferred event");
            assert.equal(event.args.newOwner, ownerAccount, "Incorrect argument in OwnershipTransferred event");
            instance.owner.call().then(_owner => {
                assert.equal(_owner, ownerAccount, "Owner not transferred correctly");
            })
        })
        .then(done).catch(done);
    });


    // Now testing Whitelisting

    it("Should start with just one wallet", done => {
        instance.manyWallets.call().then(_result => {
            assert.equal(_result, 1, "Did not start with one wallet");
        })
        .then(done).catch(done);
    });

    it("Should have a first wallet for address 0", done => {
        instance.whichAddress.call(0).then(_address => {
            assert.equal(_address, "0x0000000000000000000000000000000000000000", "Initial wallet is not for address 0");
        })
        .then(done).catch(done);
    });

    it("Not (yet) whitelisted wallets should not be found", done => {
        instance.whichWallet.call(userAccount1).then(_position => {
            assert.equal(_position, 0, "Wallet found in array (!!)");
        })
        .then(done).catch(done);
    });

    it("isWhitelisted() should return false for not (yet) whitelisted wallets", done => {
        instance.isWhitelisted.call(userAccount1).then(_result => {
            assert.equal(_result, false, "isWhitelisted returned true!");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to whitelist addresses (user1)", done => {
        instance.whitelist(userAccount1, {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            instance.manyWallets.call().then(_result => {
                assert.equal(_result, 2, "New wallet not added to the array");
            })
            instance.isWhitelisted.call(userAccount1).then(_result => {
                assert.equal(_result, true, "User not whitelisted");
            })
        })
        .then(done).catch(done);
    });

    it("Owner should be able to whitelist addresses (user2)", done => {
        instance.whitelist(userAccount2, {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount2, "Incorrect argument in Whitelisted event");
            instance.manyWallets.call().then(_result => {
                assert.equal(_result, 3, "New wallet not added to the array");
            })
            instance.isWhitelisted.call(userAccount2).then(_result => {
                assert.equal(_result, true, "User not whitelisted");
            })
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to whitelist addresses", done => {
        instance.whitelist(userAccount3, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.manyWallets.call().then(_result => {
                assert.equal(_result, 3, "New wallet added to the array");
            })
            instance.isWhitelisted.call(userAccount3).then(_result => {
                assert.equal(_result, false, "User whitelisted");
            })
        })
        .then(done).catch(done);
    });

    it("Whitelisted wallet should be added to the array (user1)", done => {
        instance.whichWallet.call(userAccount1).then(_position => {
            assert.equal(_position, 1, "Wallet not found in array (!!)");
        })
        .then(done).catch(done);
    });

    it("Whitelisted wallet should be registered in the array (user1)", done => {
        instance.whichAddress.call(1).then(_address => {
            assert.equal(_address, userAccount1, "Wallet not added correctly");
        })
        .then(done).catch(done);
    });

    it("Whitelisted wallet should be added to the array (user2)", done => {
        instance.whichWallet.call(userAccount2).then(_position => {
            assert.equal(_position, 2, "Wallet not found in array (!!)");
        })
        .then(done).catch(done);
    });

    it("Whitelisted wallet should be registered in the array (user1)", done => {
        instance.whichAddress.call(2).then(_address => {
            assert.equal(_address, userAccount2, "Wallet not added correctly");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to unwhitelist an address", done => {
        instance.unWhitelist(userAccount1, {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "UnWhitelisted", "UnWhitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            instance.manyWallets.call().then(_result => {
                assert.equal(_result, 3, "Wallet array changed on unwhitelisting");
            })
            instance.isWhitelisted.call(userAccount1).then(_result => {
                assert.equal(_result, false, "User still whitelisted");
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

    it("isWhitelisted should return false on unwhitelisted address", done => {
        instance.isWhitelisted.call(userAccount1).then(_result => {
            assert.equal(_result, false, "Unwhitelisted address returned true");
        })
        .then(done).catch(done);
    });

    it("Unwhitelisted wallet should be in the same position in the array", done => {
        instance.whichWallet.call(userAccount1).then(_position => {
            assert.equal(_position, 1, "Uwhitelisted wallet not found in array (!!)");
        })
        .then(done).catch(done);
    });

    it("Unwhitelisted wallet should stay registered in the array", done => {
        instance.whichAddress.call(1).then(_address => {
            assert.equal(_address, userAccount1, "Wallet not found");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to re-whitelist previously unwhitelisted addresses", done => {
        instance.whitelist(userAccount1, {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Whitelisted", "Whitelisted event not issued");
            assert.equal(event.args.who, userAccount1, "Incorrect argument in Whitelisted event");
            instance.manyWallets.call().then(_result => {
                assert.equal(_result, 3, "Re-whitelisted address added (again!) to the array");
            })
        })
        .then(done).catch(done);
    });

    it("Re-whitelisted wallet should be in the same position in the array", done => {
        instance.whichWallet.call(userAccount1).then(_position => {
            assert.equal(_position, 1, "Wallet not found in array (!!)");
        })
        .then(done).catch(done);
    });

    it("Re-whitelisted wallet should stay registered in the array", done => {
        instance.whichAddress.call(1).then(_address => {
            assert.equal(_address, userAccount1, "Wallet not added correctly");
        })
        .then(done).catch(done);
    });


    // Now testing initial totalSupply

    it("Should start with zero totalSupply", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 0, "Initial total supply not zero");
        })
        .then(done).catch(done);
    });


    // Now testing funding

    it("All wallets should start with zero balance", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 0, "Initial balance not zero");
        })
        .then(done).catch(done);
    });

    it("Whitelisted users should be able to request funding", done => {
        instance.requestFunding(250000, "No particular instructions", {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingRequested", "FundingRequested event not issued");
            assert.equal(event.args.fundingId, 0, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.requester, userAccount1, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.amount, 250000, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.instructions, "No particular instructions", "Incorrect argument in FundingRequested event");
            instance.manyFundingRequests.call().then(_result => {
                assert.equal(_result, 1, "Funding request not registered into array");
            })
        })
        .then(done).catch(done);
    });

    it("Funding request should be created with correct information", done => {
        instance.retrieveFundingData.call(0).then(_result => {
            assert.equal(_result.requester, userAccount1, "Requester not correctly registered");
            assert.equal(_result.amount, 250000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Amount not correctly registered");
            assert.equal(_result.status, 0, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to execute funding request", done => {
        instance.executeFundingRequest(0, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Minted", "Minted event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Minted event");
            assert.equal(event1.args.value, 250000, "Incorrect argument in Minted event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "FundingRequestExecuted", "FundingRequestExecuted event not issued");
            assert.equal(event2.args.fundingId, 0, "Incorrect argument in FundingRequestExecuted event");
            assert.equal(event2.args.requester, userAccount1, "Incorrect argument in FundingRequestExecuted event");
        })
        .then(done).catch(done);
    });
   
    it("Funding request status should be updated after execution", done => {
        instance.retrieveFundingData.call(0).then(_result => {
            assert.equal(_result.requester, userAccount1, "Requester not correctly registered");
            assert.equal(_result.amount, 250000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Instructions not correctly registered");
            assert.equal(_result.status, 1, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Funded wallet should be updated", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("Non-whitelisted users should not be able to request funding", done => {
        instance.requestFunding(150000, "No particular instructions", {from:userAccount3}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.manyFundingRequests.call().then(_result => {
                assert.equal(_result, 1, "Funding request added to array");
            })
})
        .then(done).catch(done);
    });

    it("(Again) Whitelisted users should be able to request funding", done => {
        instance.requestFunding(350000, "No particular instructions", {from:userAccount2}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingRequested", "FundingRequested event not issued");
            assert.equal(event.args.fundingId, 1, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.requester, userAccount2, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.amount, 350000, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.instructions, "No particular instructions", "Incorrect argument in FundingRequested event");
            instance.manyFundingRequests.call().then(_result => {
                assert.equal(_result, 2, "Funding request not registered into array");
            })
        })
        .then(done).catch(done);
    });

    it("(Again) Funding request should be created with correct information", done => {
        instance.retrieveFundingData.call(1).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester not correctly registered");
            assert.equal(_result.amount, 350000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Amount not correctly registered");
            assert.equal(_result.status, 0, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to reject funding request", done => {
        instance.rejectFundingRequest(1, "No particular reason", {from:ownerAccount}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingRequestRejected", "FundingRequestReject event not issued");
            assert.equal(event.args.fundingId, 1, "Incorrect argument in FundingRequestRejected event");
            assert.equal(event.args.requester, userAccount2, "Incorrect argument in FundingRequestRejected event");
            assert.equal(event.args.reason, "No particular reason", "Incorrect reason for rejection")
        })
        .then(done).catch(done);
    });
   
    it("Funding request status should be updated after execution", done => {
        instance.retrieveFundingData.call(1).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester not correctly registered");
            assert.equal(_result.amount, 350000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular instructions", "Instructions not correctly registered");
            assert.equal(_result.status, 2, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Funded wallet should not be changed", done => {
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 0, "Balance changed");
        })
        .then(done).catch(done);
    });
    
    it("Closed (executed) funding request should not be able to be re-executed", done => {
        instance.executeFundingRequest(0, {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveFundingData.call(0).then(_result => {
                assert.equal(_result.requester, userAccount1, "Requester changed");
                assert.equal(_result.amount, 250000, "Amount changed");
                assert.equal(_result.instructions, "No particular instructions", "Instructions changed");
                assert.equal(_result.status, 1, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (executed) funding request should not be able to be rejected", done => {
        instance.rejectFundingRequest(0, "No particular reason", {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveFundingData.call(0).then(_result => {
                assert.equal(_result.requester, userAccount1, "Requester changed");
                assert.equal(_result.amount, 250000, "Amount changed");
                assert.equal(_result.instructions, "No particular instructions", "Instructions changed");
                assert.equal(_result.status, 1, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (rejected) funding request should not be able to be executed", done => {
        instance.executeFundingRequest(1, {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveFundingData.call(1).then(_result => {
                assert.equal(_result.requester, userAccount2, "Requester changed");
                assert.equal(_result.amount, 350000, "Amount changed");
                assert.equal(_result.instructions, "No particular instructions", "Instructions changed");
                assert.equal(_result.status, 2, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (rejected) funding request should not be able to be re-rejected", done => {
        instance.rejectFundingRequest(1, "No reason", {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveFundingData.call(1).then(_result => {
                assert.equal(_result.requester, userAccount2, "Requester changed");
                assert.equal(_result.amount, 350000, "Amount changed");
                assert.equal(_result.instructions, "No particular instructions", "Instructions changed");
                assert.equal(_result.status, 2, "Status changed");
            })
        })
            .then(done).catch(done);
    });
    
    it("(Again again) Whitelisted users should be able to request funding", done => {
        instance.requestFunding(200000, "Some instructions", {from:userAccount2}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingRequested", "FundingRequested event not issued");
            assert.equal(event.args.fundingId, 2, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.requester, userAccount2, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.amount, 200000, "Incorrect argument in FundingRequested event");
            assert.equal(event.args.instructions, "Some instructions", "Incorrect argument in FundingRequested event");
            instance.manyFundingRequests.call().then(_result => {
                assert.equal(_result, 3, "Funding request not registered into array");
            })
            instance.retrieveFundingData.call(2).then(_result => {
                assert.equal(_result.requester, userAccount2, "Requester not correctly registered");
                assert.equal(_result.amount, 200000, "Amount not correctly registered");
                assert.equal(_result.instructions, "Some instructions", "Amount not correctly registered");
                assert.equal(_result.status, 0, "Status not correctly initialized");
            })
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to execute funding", done => {
        instance.executeFundingRequest(2, {from:userAccount2}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
        })
        .then(done).catch(done);
    });

    it("Failed execution attempts should not be registered", done => {
        instance.retrieveFundingData.call(2).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester changed");
            assert.equal(_result.amount, 200000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("Non owner should not be able to reject funding", done => {
        instance.rejectFundingRequest(2, "Blah blah", {from:userAccount2}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
        })
        .then(done).catch(done);
    });

    it("Failed reject requests should not be registered", done => {
        instance.retrieveFundingData.call(2).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester changed");
            assert.equal(_result.amount, 200000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("User should not be able to cancel others' funding requests", done => {
        instance.cancelFundingRequest(2, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated")
        })
        .then(done).catch(done);
    });

    it("Failed cancelling attempts should not modify others' funding requests", done => {
        instance.retrieveFundingData.call(2).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester changed");
            assert.equal(_result.amount, 200000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("User should be able to cancel his own funding requests", done => {
        instance.cancelFundingRequest(2, {from:userAccount2}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "FundingRequestCancelled", "FundingRequestReject event not issued");
            assert.equal(event.args.fundingId, 2, "Incorrect argument in FundingRequestCancelled event");
            assert.equal(event.args.requester, userAccount2, "Incorrect argument in FundingRequestCancelled event")
        })
        .then(done).catch(done);
    });

    it("Cancelling a funding request should be correctly registered", done => {
        instance.retrieveFundingData.call(2).then(_result => {
            assert.equal(_result.requester, userAccount2, "Requester changed");
            assert.equal(_result.amount, 200000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 3, "Status not correctly changed");
        })
        .then(done).catch(done);
    });

    
    // Now testing redemptions

    it("Whitelisted users should be able to request redemptions", done => {
        instance.requestRedeem(25000, "No particular redemption instructions", {from:userAccount1}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Suspended", "Suspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
            assert.equal(event1.args.value, 25000, "Incorrect argument in Suspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
            assert.equal(event2.args.redeemId, 0, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.amount, 25000, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.instructions, "No particular redemption instructions", "Incorrect argument in RedeemRequested event");
            instance.manyRedeemRequests.call().then(_result => {
                assert.equal(_result, 1, "Redeem request not registered into array");
            })
        })
        .then(done).catch(done);
    });

    it("Redeem request should be created with correct information", done => {
        instance.retrieveRedeemData.call(0).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
            assert.equal(_result.amount, 25000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular redemption instructions", "Amount not correctly registered");
            assert.equal(_result.status, 0, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to execute Redeem request", done => {
        instance.executeRedeemRequest(0, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
            assert.equal(event1.args.value, 25000, "Incorrect argument in Unsuspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "Burned", "Burned event not issued");
            assert.equal(event2.args.account, userAccount1, "Incorrect argument in Burned event");
            assert.equal(event2.args.value, 25000, "Incorrect argument in Burned event");
            var event3 = _tx.logs[2]
            assert.equal(event3.event, "RedeemRequestExecuted", "RedeemRequestExecuted event not issued");
            assert.equal(event3.args.redeemId, 0, "Incorrect argument in RedeemRequestExecuted event");
            assert.equal(event3.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestExecuted event");
        })
        .then(done).catch(done);
    });
   
    it("Redeem request status should be updated after execution", done => {
        instance.retrieveRedeemData.call(0).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
            assert.equal(_result.amount, 25000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular redemption instructions", "Instructions not correctly registered");
            assert.equal(_result.status, 1, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Funded wallet should be updated", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("Non-whitelisted users should not be able to request redemptions", done => {
        instance.requestRedeem(15000, "No particular instructions", {from:userAccount3}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.manyRedeemRequests.call().then(_result => {
                assert.equal(_result, 1, "Redeem request added to array");
            })
})
        .then(done).catch(done);
    });

    it("(Again) Whitelisted users should be able to request redemptions", done => {
        instance.requestRedeem(35000, "No particular redeem instructions", {from:userAccount1}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Suspended", "Suspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
            assert.equal(event1.args.value, 35000, "Incorrect argument in Suspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
            assert.equal(event2.args.redeemId, 1, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.amount, 35000, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.instructions, "No particular redeem instructions", "Incorrect argument in RedeemRequested event");
            instance.manyRedeemRequests.call().then(_result => {
                assert.equal(_result, 2, "Redeem request not registered into array");
            })
        })
        .then(done).catch(done);
    });

    it("(Again) Redeem request should be created with correct information", done => {
        instance.retrieveRedeemData.call(1).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
            assert.equal(_result.amount, 35000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular redeem instructions", "Amount not correctly registered");
            assert.equal(_result.status, 0, "Status not correctly initialized");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to reject Redeem request", done => {
        instance.rejectRedeemRequest(1, "No particular reason", {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
            assert.equal(event1.args.value, 35000, "Incorrect argument in Unsuspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "RedeemRequestRejected", "RedeemRequestReject event not issued");
            assert.equal(event2.args.redeemId, 1, "Incorrect argument in RedeemRequestRejected event");
            assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestRejected event");
            assert.equal(event2.args.reason, "No particular reason", "Incorrect reason for rejection")
        })
        .then(done).catch(done);
    });
   
    it("Redeem request status should be updated after execution", done => {
        instance.retrieveRedeemData.call(1).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
            assert.equal(_result.amount, 35000, "Amount not correctly registered");
            assert.equal(_result.instructions, "No particular redeem instructions", "Instructions not correctly registered");
            assert.equal(_result.status, 2, "Status not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Funded wallet should not be changed", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000, "Balance changed");
        })
        .then(done).catch(done);
    });

    it("Closed (executed) Redeem request should not be able to be re-executed", done => {
        instance.executeRedeemRequest(0, {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveRedeemData.call(0).then(_result => {
                assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
                assert.equal(_result.amount, 25000, "Amount changed");
                assert.equal(_result.instructions, "No particular redemption instructions", "Instructions changed");
                assert.equal(_result.status, 1, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (executed) Redeem request should not be able to be rejected", done => {
        instance.rejectRedeemRequest(0, "No particular reason", {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveRedeemData.call(0).then(_result => {
                assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
                assert.equal(_result.amount, 25000, "Amount changed");
                assert.equal(_result.instructions, "No particular redemption instructions", "Instructions changed");
                assert.equal(_result.status, 1, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (rejected) Redeem request should not be able to be executed", done => {
        instance.executeRedeemRequest(1, {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveRedeemData.call(1).then(_result => {
                assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
                assert.equal(_result.amount, 35000, "Amount changed");
                assert.equal(_result.instructions, "No particular redeem instructions", "Instructions changed");
                assert.equal(_result.status, 2, "Status changed");
            })
        })
        .then(done).catch(done);
    });

    it("Closed (rejected) Redeem request should not be able to be re-rejected", done => {
        instance.rejectRedeemRequest(1, "No reason", {from:ownerAccount}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
            instance.retrieveRedeemData.call(1).then(_result => {
                assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
                assert.equal(_result.amount, 35000, "Amount changed");
                assert.equal(_result.instructions, "No particular redeem instructions", "Instructions changed");
                assert.equal(_result.status, 2, "Status changed");
            })
        })
        .then(done).catch(done);
    });
    
    it("(Again again) Whitelisted users should be able to request redemptions", done => {
        instance.requestRedeem(20000, "Some instructions", {from:userAccount1}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Suspended", "Suspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Suspended event");
            assert.equal(event1.args.value, 20000, "Incorrect argument in Suspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "RedeemRequested", "RedeemRequested event not issued");
            assert.equal(event2.args.redeemId, 2, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.amount, 20000, "Incorrect argument in RedeemRequested event");
            assert.equal(event2.args.instructions, "Some instructions", "Incorrect argument in RedeemRequested event");
            instance.manyRedeemRequests.call().then(_result => {
                assert.equal(_result, 3, "Redeem request not registered into array");
            })
            instance.retrieveRedeemData.call(2).then(_result => {
                assert.equal(_result.redeemer, userAccount1, "Redeemer not correctly registered");
                assert.equal(_result.amount, 20000, "Amount not correctly registered");
                assert.equal(_result.instructions, "Some instructions", "Amount not correctly registered");
                assert.equal(_result.status, 0, "Status not correctly initialized");
            })
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to execute redemptions", done => {
        instance.executeRedeemRequest(2, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
        })
        .then(done).catch(done);
    });

    it("Failed execution attempts should not be registered", done => {
        instance.retrieveRedeemData.call(2).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
            assert.equal(_result.amount, 20000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("Non owner should not be able to reject redemptions", done => {
        instance.rejectRedeemRequest(2, "Blah blah", {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated");
        })
        .then(done).catch(done);
    });

    it("Failed reject requests should not be registered", done => {
        instance.retrieveRedeemData.call(2).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
            assert.equal(_result.amount, 20000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("User should not be able to cancel others' Redeem requests", done => {
        instance.cancelRedeemRequest(2, {from:userAccount2}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was generated")
        })
        .then(done).catch(done);
    });

    it("Failed cancelling attempts should not modify others' Redeem requests", done => {
        instance.retrieveRedeemData.call(2).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
            assert.equal(_result.amount, 20000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 0, "Status changed");
        })
    .then(done).catch(done);
    });

    it("User should be able to cancel his own Redeem requests", done => {
        instance.cancelRedeemRequest(2, {from:userAccount1}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Unsuspended", "Unsuspended event not issued");
            assert.equal(event1.args.account, userAccount1, "Incorrect argument in Unsuspended event");
            assert.equal(event1.args.value, 20000, "Incorrect argument in Unsuspended event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "RedeemRequestCancelled", "RedeemRequestReject event not issued");
            assert.equal(event2.args.redeemId, 2, "Incorrect argument in RedeemRequestCancelled event");
            assert.equal(event2.args.redeemer, userAccount1, "Incorrect argument in RedeemRequestCancelled event")
        })
        .then(done).catch(done);
    });

    it("Cancelling a Redeem request should be correctly registered", done => {
        instance.retrieveRedeemData.call(2).then(_result => {
            assert.equal(_result.redeemer, userAccount1, "Redeemer changed");
            assert.equal(_result.amount, 20000, "Amount changed");
            assert.equal(_result.instructions, "Some instructions", "Instructions changed");
            assert.equal(_result.status, 3, "Status not correctly changed");
        })
        .then(done).catch(done);
    });

    // Now testing direct writes to wallets

    it("Owner should be able to directly add funds to a whitelisted wallet", done => {
        instance.directAddToWallet(userAccount2, 220000, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Minted", "Minted event not issued");
            assert.equal(event1.args.account, userAccount2, "Incorrect argument in Minted event");
            assert.equal(event1.args.value, 220000, "Incorrect argument in Minted event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "DirectAddToWallet", "DirectAddToWallet event not issued");
            assert.equal(event2.args.account, userAccount2, "Incorrect account argument in DirectAddToWallet event")
            assert.equal(event2.args.value, 220000, "Incorrect value argument in DirectAddToWallet event");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to directly remove funds to a whitelisted wallet", done => {
        instance.directRemoveFromWallet(userAccount2, 40000, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Burned", "Burned event not issued");
            assert.equal(event1.args.account, userAccount2, "Incorrect argument in Burned event");
            assert.equal(event1.args.value, 40000, "Incorrect argument in Burned event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "DirectRemoveFromWallet", "DirectRemoveFromWallet event not issued");
            assert.equal(event2.args.account, userAccount2, "Incorrect account argument in DirectRemoveFromWallet event")
            assert.equal(event2.args.value, 40000, "Incorrect value argument in DirectRemoveFromWallet event");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be correctly updated after direct adds and removes", done => {
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 220000-40000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should be correctly updated", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 220000-40000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to directly set the balance of a whitelisted wallet", done => {
        instance.directSetWalletBalance(userAccount2, 150000, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Burned", "Burned event not issued");
            assert.equal(event1.args.account, userAccount2, "Incorrect argument in Burned event");
            assert.equal(event1.args.value, 220000-40000, "Incorrect argument in Burned event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "Minted", "Minted event not issued");
            assert.equal(event2.args.account, userAccount2, "Incorrect argument in Minted event");
            assert.equal(event2.args.value, 150000, "Incorrect argument in Minted event");
            var event3 = _tx.logs[2]
            assert.equal(event3.event, "DirectSetWalletBalance", "DirectSetWalletBalance event not issued");
            assert.equal(event3.args.account, userAccount2, "Incorrect account argument in DirectSetWalletBalance event")
            assert.equal(event3.args.value, 150000, "Incorrect value argument in DirectSetWalletBalance event");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be correctly updated after direct balance set", done => {
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 150000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should be correctly updated", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to directly add funds even to a non whitelisted wallet", done => {
        instance.directAddToWallet(userAccount3, 100000, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Minted", "Minted event not issued");
            assert.equal(event1.args.account, userAccount3, "Incorrect argument in Minted event");
            assert.equal(event1.args.value, 100000, "Incorrect argument in Minted event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "DirectAddToWallet", "DirectAddToWallet event not issued");
            assert.equal(event2.args.account, userAccount3, "Incorrect account argument in DirectAddToWallet event")
            assert.equal(event2.args.value, 100000, "Incorrect value argument in DirectAddToWallet event");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be correctly updated after direct add, even to a non whitelisted wallet", done => {
        instance.balanceOf.call(userAccount3).then(_result => {
            assert.equal(_result, 100000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should be correctly updated", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 150000 + 100000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Owner should be able to directly set the balance of a non whitelisted wallet", done => {
        instance.directSetWalletBalance(userAccount3, 0, {from:ownerAccount}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Burned", "Burned event not issued");
            assert.equal(event1.args.account, userAccount3, "Incorrect argument in Burned event");
            assert.equal(event1.args.value, 100000, "Incorrect argument in Burned event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "Minted", "Minted event not issued");
            assert.equal(event2.args.account, userAccount3, "Incorrect argument in Minted event");
            assert.equal(event2.args.value, 0, "Incorrect argument in Minted event");
            var event3 = _tx.logs[2]
            assert.equal(event3.event, "DirectSetWalletBalance", "DirectSetWalletBalance event not issued");
            assert.equal(event3.args.account, userAccount3, "Incorrect account argument in DirectSetWalletBalance event")
            assert.equal(event3.args.value, 0, "Incorrect value argument in DirectSetWalletBalance event");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be correctly updated after direct balance set", done => {
        instance.balanceOf.call(userAccount3).then(_result => {
            assert.equal(_result, 0, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should be correctly updated", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to directly add funds to a wallet", done => {
        instance.directAddToWallet(userAccount1, 50000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was sent");
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to directly remove funds from a wallet", done => {
        instance.directRemoveFromWallet(userAccount1, 20000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was sent");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be not change after failed direct add or remove attempts", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    it("Non owner should not be able to directly add funds to a wallet", done => {
        instance.directSetWalletBalance(userAccount1, 90000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was sent");
        })
        .then(done).catch(done);
    });

    it("Wallet balance should be not change after failed direct balance set attempts", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000, "Balance not updated");
        })
        .then(done).catch(done);
    });

    // Now testing transfers etc.

    it("Whitelisted user should be able to transfer funds to other whitelisted users", done => {
        instance.transfer(userAccount2, 3000, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Transfer", "Transfer event not issued");
            assert.equal(event.args.from, userAccount1, "Incorrect from account argument in Transfer event")
            assert.equal(event.args.to, userAccount2, "Incorrect to account argument in Transfer event")
            assert.equal(event.args.value, 3000, "Incorrect value argument in Transfer event");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should not be able to transfer funds to non whitelisted users", done => {
        instance.transfer(userAccount3, 2000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "An event was sent");
        })
        .then(done).catch(done);
    });

    it("Wallet balances should be correctly updated after transfers", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000-3000, "Sender balance not updated");
        })
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 150000+3000, "Receiver balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should not change after transfers", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should be able to approve another whitelisted users", done => {
        instance.approve(userAccount2, 5000, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Approval", "Approval event not issued");
            assert.equal(event.args.owner, userAccount1, "Incorrect owner account argument in Approval event")
            assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
            assert.equal(event.args.value, 5000, "Incorrect value argument in Approval event");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should be able to increase allowance for whitelisted users", done => {
        instance.increaseAllowance(userAccount2, 3000, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Approval", "Approval event not issued");
            assert.equal(event.args.owner, userAccount1, "Incorrect owner account argument in Approval event")
            assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
            assert.equal(event.args.value, 5000+3000, "Incorrect value argument in Approval event");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should be able to decrease allowance for whitelisted users", done => {
        instance.decreaseAllowance(userAccount2, 1000, {from:userAccount1}).then(_tx => {
            var event = _tx.logs[0]
            assert.equal(event.event, "Approval", "Approval event not issued");
            assert.equal(event.args.owner, userAccount1, "Incorrect ownder account argument in Approval event")
            assert.equal(event.args.spender, userAccount2, "Incorrect spender account argument in Approval event")
            assert.equal(event.args.value, 5000+3000-1000, "Incorrect value argument in Approval event");
        })
        .then(done).catch(done);
    });

    it("Allowances should be correctly updated after approvals", done => {
        instance.allowance.call(userAccount1, userAccount2).then(_result => {
            assert.equal(_result, 5000+3000-1000, "Allowance not updated");
        })
        .then(done).catch(done);
    });

    it("Wallet balances should not change after approvals", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000-3000, "Sender balance not updated");
        })
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 150000+3000, "Receiver balance not updated");
        })
        .then(done).catch(done);
    });

    it("Allowed spender should be able to spend within the allowance", done => {
        instance.transferFrom(userAccount1, userAccount2, 4000, {from:userAccount2}).then(_tx => {
            var event1 = _tx.logs[0]
            assert.equal(event1.event, "Transfer", "Transfer event not issued");
            assert.equal(event1.args.from, userAccount1, "Incorrect from account argument in Transfer event")
            assert.equal(event1.args.to, userAccount2, "Incorrect to account argument in Transfer event")
            assert.equal(event1.args.value, 4000, "Incorrect value argument in Transfer event");
            var event2 = _tx.logs[1]
            assert.equal(event2.event, "Approval", "Approval event not issued");
            assert.equal(event2.args.owner, userAccount1, "Incorrect from account argument in Approval event")
            assert.equal(event2.args.spender, userAccount2, "Incorrect to account argument in Approval event")
            assert.equal(event2.args.value, 5000+3000-1000-4000, "Incorrect value argument in Approval event");
        })
        .then(done).catch(done);
    });

    it("Allowed spender should be not able to spend outside the allowance", done => {
        instance.transferFrom(userAccount1, userAccount2, 10000, {from:userAccount2}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "And event was sent");
        })
        .then(done).catch(done);
    });

    it("Allowances should be correctly updated after spending", done => {
        instance.allowance.call(userAccount1, userAccount2).then(_result => {
            assert.equal(_result, 5000+3000-1000-4000, "Allowance not updated");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should not be able to approve non whitelisted users", done => {
        instance.approve(userAccount3, 5000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "And event was sent");
        })
        .then(done).catch(done);
    });

    it("Whitelisted user should not be able to increase allowance for whitelisted users", done => {
        instance.increaseAllowance(userAccount3, 3000, {from:userAccount1}).then(_tx => {
            assert.equal(_tx.logs.length, 0, "And event was sent");
        })
        .then(done).catch(done);
    });

    it("No allowance should be set for non whitelisted users after attempts", done => {
        instance.allowance.call(userAccount1, userAccount3).then(_result => {
            assert.equal(_result, 0, "Allowance not updated");
        })
        .then(done).catch(done);
    });

    it("Wallet balances should be correctly updated after transferFrom's", done => {
        instance.balanceOf.call(userAccount1).then(_result => {
            assert.equal(_result, 250000-25000-3000-4000, "Sender balance not updated");
        })
        instance.balanceOf.call(userAccount2).then(_result => {
            assert.equal(_result, 150000+3000+4000, "Receiver balance not updated");
        })
        .then(done).catch(done);
    });

    it("totalSupply should not change after transferFrom's", done => {
        instance.totalSupply.call().then(_result => {
            assert.equal(_result, 250000-25000 + 150000, "Total supply not correctly updated");
        })
        .then(done).catch(done);
    });

});
