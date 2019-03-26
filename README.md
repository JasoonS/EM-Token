# EM Token: The Electronic Money Token standard

Contributors: xxx

## Objective

The EM Token standard aims to enable the issuance of regulated electronic money on blockchain networks, and its practical usage in real financial applications.

## Background

Financial institutions work today with electronic systems which hold account balances in databases on core banking systems. In order for an institution to be allowed to maintain records of client balances segregated and available for clients, such institution must be regulated under a known legal framework and must possess a license to do so. Maintaining a license under regulatory supervision entails ensuring compliance (i.e. performing KYC on all clients and ensuring good AML practices before allowing transactions) and demonstrating technical and operational solvency through periodic audits, so clients depositing funds with the institution can rest assured that their money is safe.

There are only a number of potential regulatory license frameworks that allow institutions to issue and hold money balances for customers (be it retail corporate or institutional types). The most important and practical ones are three:
* **Electronic money entities**: these are leanly regulated vehicles that are mostly used today for cash and payments services, instead of more complex financial services. For example prepaid cards or online payment systems such as PayPal run on such schemes. In most jurisdictions, electronic money balances are required to be 100% backed by assets, which often entails holding cash on an omnibus account at a bank with 100% of the funds issued to clients in the electronic money ledger   
* **Banking licenses**: these include commercial and investment banks, which segregate client funds using current and other type of accounts implemented on core banking systems. Banks can create money by lending to clients, so bank money can be backed by promises to pay and other illiquid assets 
* **Central banks**: central banks hold balances for banks in RTGS systems, similar to core banking systems but with much more restricted yet critical functionality. Central banks create money by lending it to banks, which pledge their assets to central banks as a lender of last resort for an official interest rate

Regulations for all these types of electronic money are local, i.e. only valid for each jurisdiction and not valid in others. And regulations can vary dramatically in different jurisdictions - for example there are places with no electronic money frameworks, on everything has to be done through banking licenses or directly with a central bank. But in all cases compliance with existing regulation needs to ensured, in particular:
* **Know Your Customer (KYC)**: the institution needs to identify the client before providing her with the possibility of depositing money or transact. In different jurisdictions and for different types of licenses there are different levels of balance and activity that can be allowed for different levels of KYC. For example, low KYC requirements with little checks or even no checks at all can usually be acceptable in many jurisdictions if cashin balances are kept low (i.e. hundreds of dollars)
* **Anti Money Laundering (AML)**: the institution needs to perform checks of parties transacting with its clients, typically checking against black lists and doing sanction screening, most notably in the context international transactions

Beyond cash, financial instruments such as equities or bonds are also registered in electronic systems in most cases, although all these systems and the bank accounting systems are only connected through rudimentary messaging means, which leads to the need for reconciliations and manual management in many cases. Cash systems to provide settlement of transactions in the capital markets are not well connected to the transactional systems, and often entail delays and settlement risk

## Overview

The EM Token builds on Ethereum standards currently in use such as ERC20, but it extends them to provide few key additional pieces of functionality, needed in the regulated financial world:
* **Compliance**: EM Tokens implement a set of methods to check in advance whether user-initiated transactions can be done from a compliance point of view. Implementations must ```require``` that these methods return a positive answer before executing the transaction
* **Clearing**: In addition to the standard ERC20 ```transfer``` method, EM Token provides a way to subnit transfers that need to be cleared by the token issuing authority offchain. These transfers are then executed in two steps: i) transfers are ordered, and ii) after clearing them, transfers are executed or rejected by the operator of the token contract
* **Holds**: token balances can be put on hold, which will make the held amount unavailable for further use until the hold is resolved (i.e. either executed or released). Holds have a payer, a payee, and a notary who is in charge of resolving the hold. Holds also implement expiration periods, after which anyone can release the hold Holds are similar to escrows in that are firm and lead to final settlement. Holds can also be used to implement collateralization
* **Credit lines**: an EM Token wallet can have associated a credit line, which is automatically drawn when transfers or holds are performed and there is insufficient balance in the wallet - i.e. the `transfer` method will then not throw if there is enough available credit in the wallet. Credit lines generate interest that is accrued in the relevant associated token wallet
* **Funding requests**: users can request for a wallet to be funded by calling the smart contract and attaching a debit instruction string. The tokenizer reads this request, interprets the debit instructions, and triggers a transfer in the bank ledger to initiate the tokenization process  
* **Payouts**: users can request payouts by calling the smart contract and attaching a payment instruction string. The (de)tokenizer reads this request, interprets the payment instructions, and triggers the transfer of funds (typically from the omnibus account) into the destination account, if possible. Note that a redemption request is an special type of payout in which the destination (bank) account for the payout is the bank account linked to the token wallet

The EM Token is thus different from other tokens commonly referred to as "stable coins" in that it is designed to be issued, burnt and made available to users in a compliant manner (i.e. with full KYC and AML compliance) through a licensed vehicle (an electronic money entity, a bank, or a central bank), and in that it provides the additional functionality described above so it can be used by other smart contracts implementing more complex financial applications such as interbank payments, supply chain finance instruments, or the creation of EM-Token denominated bonds and equities with automatic delivery-vs-payment

## Data types, methods and events (minimal standard implementation)

The EM Token standard specifies a set of data types, methods and events that ensure interoperability between different implementations. All these elements are included and described in the ```interface/I*.sol``` files. The following picture schamtically describes the hierarchy of these interface files:

![EM Token standard structure](./diagrams/standard_structure.png?raw=true "EM Token standard structure")

### _Basic token information_

EM Tokens implement some basic informational methods, only used for reference:

```
function name() external view returns (string memory);
function symbol() external view returns (string memory);
function currency() external view returns (string memory);
function decimals() external view returns (uint8);
function version() external pure returns (string memory);
```

The meaning of these fields are mostly self-explanatory:
* **name**: This is a human-readable form of the name of the token, such as "ioCash EUR token"
* **symbol**: This is meant to be a unique identifier or _ticker_, e.g. to be used in trading systems - e.g. "SANEUR"
* **currency**: This is the standardized symbol of the currency backing the token, e.g. "EUR", "USD", "GBO", etc. The underlying currency of the token determines the market risk the token is subject to, so market makers can know what they are dealing with, and can hedge accordingly. Note that different EM Tokens issued by different licensed institutions will be different and non interchangeable (e.g. SANUSD vs JPMUSD), yet they can have the same underlying currency (USD in this case) which would mean that they have the same market risk (yet different counterparty risk)
* **decimals**: The number of decimals of currency represented by number balances in the token. For example if _decimals_ is 2 and ```balanceOf(wallet)``` yields 1000, this would represent 10.00 units of currency. Note that _decimals_ is only provided for informational purposes and does not play any meaningful role in the internal implementation
* **version**: This is an optional string with information about the token contract version, typically implemented as a constant in the code

The ```Created``` event is sent upon contract instantiation:
```
event Created(string indexed name, string indexed symbol, string indexed currency, uint8 decimals, string version);
```

### _ERC20 standard_

EM Tokens implement the basic ERC20 methods:
```
function transfer(address to, uint256 value) external returns (bool);
function approve(address spender, uint256 value) external returns (bool);
function transferFrom(address from, address to, uint256 value) external returns (bool);
function balanceOf(address owner) external view returns (uint256);
function allowance(address owner, address spender) external view returns (uint256);
```

And also the basic events:
```
event Transfer(address indexed from, address indexed to, uint256 value);
event Approval(address indexed owner, address indexed spender, uint256 value);
 ```

Note that in this case the ```balanceOf()``` method will only return the token balance amount without taking into account balances on hold or overdraft limits. Therefore a ```transfer``` may not necessarily succeed even if the balance as returned by ```balanceOf()``` is higher than the amount to be transferred, nor may it fail if the balance is low. Further down we will document some methods that retrieve the amount of _available_  funds, as well as the _net_ balance taking into account drawn overdraft lines

### _Holds_

EM Tokens provide the possibility to perform _holds_ on tokens. A hold is created with the following fields:
* **holder**: the address that orders the hold, be it the wallet owner or an approved holder
* **operationId**: an unique transaction ID provided by the holder to identify the hold throughout its life cycle. The name _operationId_ is used instead of _transactionId_ to avoid confusion with ethereum transactions
* **from**: the wallet from which the tokens will be transferred in case the hold is executed (i.e. the payer)
* **to**: the wallet that will receive the tokens in case the hold is executed (i.e. the payee)
* **notary**: the address that will either execute or release the hold (after checking whatever condition)
* **amount**: the amount of tokens that will be transferred
* **expires**: a flag indicating whether the hold will have an expiration time or not
* **expiration**: the timestamp since which the hold is considered to be expired (in case ```expires==true```)
* **status**: the status of the hold, which can be one of the following as defined in the ```HoldStatusCode``` enum type (also part of the standard)

```
enum HoldStatusCode { Nonexistent, Ordered, ExecutedByNotary, ExecutedByOperator, ReleasedByNotary, ReleasedByPayee, ReleasedByOperator, ReleasedOnExpiration }
```

Holds are to be created directly by wallet owners. Wallet owners can also approve others to perform holds on their behalf:

```
function approveToHold(address holder) external returns (bool);
function revokeApprovalToHold(address holder) external returns (bool);
```

Note that approvals are yes or no, without allowances (as in ERC20's approve method)

The key methods are ```hold``` and ```holdFrom```, which create holds on behalf of payers:

```
function hold(string calldata operationId, address to, address notary, uint256 amount, bool expires, uint256 timeToExpiration) external returns (bool);
function holdFrom(string calldata operationId, address from, address to, address notary, uint256 amount, bool expires, uint256 timeToExpiration) external returns (bool);
```

Unique operationIds are to be provided by the issuer of the hold. Internally, keys are to be built by hashing the address of the _orderer_ and the _operationId_, which therefore supports the possibility of different orderers of holds using the same _operationId_.

Once the hold has been created, the hold can either be released (i.e. closed without further consequences, thus making the locked funds again available for transactions) or executed (i.e. executing the transfer between the payer and the payee). The orderer of the hold (the _holder_) can also renew the hold (i.e. adding more time to the current expiration date):

```
function releaseHold(address holder, string calldata operationId) external returns (bool);
function executeHold(address holder, string calldata operationId) external returns (bool);
function renewHold(string calldata operationId, uint256 timeToExpirationFromNow) external returns (bool);
```

The hold can be released (i.e. not executed) in four possible ways:
* By the notary
* By the operator or owner
* By the payee (as a way to reject the projected transfer)
* By the holder or by the payer, but only after the expiration time

The hold can be executed in two possible ways:
* By the notary (the normal)
* By the operator (e.g. in emergency cases)

The hold cannot be executed or renewed after expiration by any party. It can only be released in order to become closed.

Also, some ```view``` methods are provided to retrieve information about holds:

```
function isApprovedToHold(address wallet, address holder) external view returns (bool);
function retrieveHoldData(address holder, string calldata operationId) external view returns (address from, address to, address notary, uint256 amount, bool expires, uint256 expiration, HoldStatusCode status);
function balanceOnHold(address wallet) external view returns (uint256);
function totalSupplyOnHold() external view returns (uint256);
```

```balanceOnHold``` and ```totalSupplyOnHold``` return the addition of all the amounts of hold for an address or for all addresses, respectively

A number of events are to be sent as well:

```
event HoldCreated(address indexed holder, string indexed operationId, address from, address to, address indexed notary, uint256 amount, bool expires, uint256 expiration);
event HoldExecuted(address indexed holder, string indexed operationId, HoldStatusCode status);
event HoldReleased(address indexed holder, string indexed operationId, HoldStatusCode status);
event HoldRenewed(address indexed holder, string indexed operationId, uint256 oldExpiration, uint256 newExpiration);
```

### _Overdrafts_

The EM Token implements the possibility of token balances to be negative through the implementation of an unsecured overdraft line subject to limits and conditions to be set by a CRO. This credit line is subject to interest, which is to be charged at agreed-upon moments

Overdraft lines are set up with two key parameters:
- The **overdraft limit**, which is intended to be the maximum amount that should be drawn from the line. And
- The **interest engine**, which is (the address of) a separate contract where interest conditions are set up, and trough which interest charges are taken by the lending institution.

**(Interest engines to be defined in detail separately)**

Basic ```view``` methods allow to know the limits and the drawn amounts from the credit line, as well as address of the current interest engine contract:

```
function unsecuredOverdraftLimit(address wallet) external view returns (uint256);
function drawnAmount(address wallet) external view returns (uint256);
function totalDrawnAmount() external view returns (uint256);
function interestEngine(address wallet) external view returns (address);
```

The limit of the credit line and interest engine can only be changed by the CRO:

```
function setUnsecuredOverdraftLimit(address wallet, uint256 newLimit) external returns (bool);
function setInterestEngine(address wallet, address newEngine) external returns(bool);
```

These actions result in events being sent:

```
event UnsecuredOverdraftLimitSet(address indexed wallet, uint256 oldLimit, uint256 newLimit);
event InterestEngineSet(address indexed wallet, address indexed previousEngine, address indexed newEngine);
```

Interest can only be charged by the interest engine contract. To do so, the interest engine contract must call the ```chargeInterest``` method (the contract is the only one allowed to call this method). Note that interst can always be charged, even if the resulting drawn amount becomes larger than the established limit

```
function chargeInterest(address wallet, uint256 amount) external returns (bool);
// Implementation starts with some like:
// require(msg.sender == _interestEngine, "Only the interest engine can charge interest");
```


Charging interest results in an event being sent:

```
event interestCharged(address indexed wallet, address indexed engine, uint256 amount);
```

(events with more specific information about interest rates and charging periods can be sent in the interest engine contract)


### _Clearable transfers_

EM Token contracts provide the possibility of ordering and managing transfers that are not atomically executed, but rather need to be cleared by the token issuing authority before being executed (or rejected). Clearable transfers then have a status which changes along the process, of type ```ClearableTransferStatusCode```:

```
enum ClearableTransferStatusCode { Nonexistent, Ordered, InProcess, Executed, Rejected, Cancelled }
```

Clearable transfers can be ordered by wallet owners or by approved parties (again, no allowances are implemented):
```
function approveToOrderClearableTransfer(address orderer) external returns (bool);
function revokeApprovalToOrderClearableTransfer(address orderer) external returns (bool);
```

Clearable transfers are then submitted in a similar fashion to normal (ERC20) transfers, but using an unique identifier similar to the case of _operationIds_ in holds (again, internally the keys are built from the address of the _orderer_ and the _operationId_). Upon ordering a clearable transfer, a hold is performed on the ```fromWallet``` to secure the funds that will be transferred:

```
function orderClearableTransfer(string calldata operationId, address to, uint256 amount) external returns (bool);
function orderClearableTransferFrom(string calldata operationId, address from, address to, uint256 amount) external returns (bool);
```

Right after the transfer has been ordered (status is ```Ordered```), the orderer can still cancel the transfer:

```
function cancelClearableTransfer(string calldata operationId) external returns (bool);
```

The token contract owner / operator has then methods to manage the workflow process:

* The ```processClearableTransfer``` moves the status to ```InProcess```, which then prevents the _orderer_ to be able to cancel the requested transfer. This also can be used by the operator to freeze everything, e.g. in the case of a positive in AML screening

```
function processClearableTransfer(address orderer, string calldata operationId) external returns (bool);
```

* The ```executeClearableTransfer``` method allows the operator to approve the execution of the transfer, which effectively triggers the execution of the hold, which then moves the token from the ```from``` to the ```to```:

```
function executeClearableTransfer(address orderer, string calldata operationId) external returns (bool);
```

* The operator can also reject the transfer by calling the ```rejectClearableTransfer```. In this case a reason can be provided:

```
function rejectClearableTransfer(address orderer, string calldata operationId, string calldata reason) external returns (bool);
```

Some ```view``` methods are also provided :

```
function isApprovedToOrderClearableTransfer(address wallet, address orderer) external view returns (bool);
function retrieveClearableTransferData(address orderer, string calldata operationId) external view returns (address from, address to, uint256 amount, ClearableTransferStatusCode status );
```

A number of events are also casted on eventful transactions:

```
event ClearableTransferOrdered( address indexed orderer, string indexed operationId, address fromWallet, address toWallet, uint256 amount);
event ClearableTransferInProcess(address indexed orderer, string indexed operationId);
event ClearableTransferExecuted(address indexed orderer, string indexed operationId);
event ClearableTransferRejected(address indexed orderer, string indexed operationId, string reason);
event ClearableTransferCancelled(address indexed orderer, string indexed operationId);
event ApprovalToOrderClearableTransfer(address indexed wallet, address indexed orderer);
event RevokeApprovalToOrderClearableTransfer(address indexed wallet, address indexed orderer);
```

### _Funding_

Token wallet owners (or approved addresses) can order tokenization requests through the blockchain. This is done by calling the ```orderFunding``` or ```orderFundingFrom``` methods, which initiate the workflow for the token contract operator to either honor or reject the funding request. In this case, funding instructions are provided when submitting the request, which are used by the operator to determine the source of the funds to be debited in order to do fund the token wallet (through minting). In general, it is not advisable to place explicit routing instructions for debiting funds on a verbatim basis on the blockchain, and it is advised to use a private channel to do so (external to the blockchain ledger). Another (less desirable) possibility is to place these instructions on the instructions field on encrypted form.

A similar phillosophy to Clearable Transfers is applied to the case of funding requests, i.e.:

* A unique _operationId_ must be provided by the _orderer_
* A similar workflow is provided with similar status codes
* The operator can execute and reject the funding request

Status codes are self-explanatory:

```
enum FundingStatusCode { Nonexistent, Ordered, InProcess, Executed, Rejected, Cancelled }
```

Transactional methods are provided to manage the whole cycle of the funding request:

```
function approveToOrderFunding(address orderer) external returns (bool);
function revokeApprovalToOrderFunding(address orderer) external returns (bool) ;
function orderFunding(string calldata operationId, uint256 amount, string calldata instructions) external returns (bool);
function orderFundingFrom(string calldata operationId, address walletToFund, uint256 amount, string calldata instructions) external returns (bool);
function cancelFunding(string calldata operationId) external returns (bool);
function processFunding(address orderer, string calldata operationId) external returns (bool);
function executeFunding(address orderer, string calldata operationId) external returns (bool);
function rejectFunding(address orderer, string calldata operationId, string calldata reason) external returns (bool);
```

View methods are also provided:

```
function isApprovedToOrderFunding(address walletToFund, address orderer) external view returns (bool);
function retrieveFundingData(address orderer, string calldata operationId) external view returns (address walletToFund, uint256 amount, string memory instructions, FundingStatusCode status);
```

Events are to be sent on relevant transactions:

```
event FundingOrdered(address indexed orderer, string indexed operationId, address indexed walletToFund, uint256 amount, string instructions);
event FundingInProcess(address indexed orderer, string indexed operationId);
event FundingExecuted(address indexed orderer, string indexed operationId);
event FundingRejected(address indexed orderer, string indexed operationId, string reason);
event FundingCancelled(address indexed orderer, string indexed operationId);
event ApprovalToOrderFunding(address indexed walletToFund, address indexed orderer);
event RevokeApprovalToOrderFunding(address indexed walletToFund, address indexed orderer);
```

### _Payouts_

Similary to funding requests, token wallet owners (or approved addresses) can order payouts through the blockchain. This is done by calling the ```orderPayout``` or ```orderPayoutFrom``` methods, which initiate the workflow for the token contract operator to either honor or reject the request.

In this case, the following movement of tokens are done as the process progresses:

* Upon launch of the payout request, the appropriate amount of funds are placed on a hold with no notary (i.e. it is an internal hold that cannot be released), and the payout is placed into a ```Ordered``` state
* The operator then can put the payout request ```InProcess```, which prevents the _orderer_ of the payout from being able to cancel the payout request
* After checking the payout is actually possible the operator then executes the hold, which moves the funds to a suspense wallet and places the payout into the ```FundsInSuspense``` state
* The operator then moves the funds offchain from the omnibus account to the appropriate destination account, then burning the tokens from the suspense wallet and rendering the payout into the ```Executed``` state
* Either before or after placing the request ```InProcess```, the operator can also reject the payout, which returns the funds to the payer and eliminates the hold. The resulting end state of the payout is ```Rejected```
* When the payout is ```Ordered``` and before the operator places it into the ```InProcess``` state, the orderer of the payout can also cancel it, which frees up the hold and puts the payout into the final ```Cancelled``` state

Also in this case, payout instructions are provided when submitting the request, which are used by the operator to determine the desination of the funds to be transferred from the omnibus account. In general, it is not advisable to place explicit routing instructions for debiting funds on a verbatim basis on the blockchain, and it is advised to use a private channel to do so (external to the blockchain ledger). Another (less desirable) possibility is to place these instructions on the instructions field on encrypted form.

Status codes are as explained above:

```
enum PayoutStatusCode { Nonexistent, Ordered, InProcess, FundsInSuspense, Executed, Rejected, Cancelled }
```

Transactional methods are provided to manage the whole cycle of the payout request:

```
function approveToOrderPayout(address orderer) external returns (bool);
function revokeApprovalToOrderPayout(address orderer) external returns (bool);
function orderPayout(string calldata operationId, uint256 amount, string calldata instructions) external returns (bool);
function orderPayoutFrom(string calldata operationId, address walletToDebit, uint256 amount, string calldata instructions) external returns (bool);
function cancelPayout(string calldata operationId) external returns (bool);
function processPayout(address orderer, string calldata operationId) external returns (bool);
function putFundsInSuspenseInPayout(address orderer, string calldata operationId) external returns (bool);
function executePayout(address orderer, string calldata operationId) external returns (bool);
function rejectPayout(address orderer, string calldata operationId, string calldata reason) external returns (bool);
```

View methods are also provided:

```
function isApprovedToOrderPayout(address walletToDebit, address orderer) external view returns (bool);
function retrievePayoutData(address orderer, string calldata operationId) external view returns (address walletToDebit, uint256 amount, string memory instructions, PayoutStatusCode status);
```

Events are to be sent on relevant transactions:

```
event PayoutOrdered(address indexed orderer, string indexed operationId, address indexed walletToDebit, uint256 amount, string instructions);
event PayoutInProcess(address indexed orderer, string indexed operationId);
event PayoutFundsInSuspense(address indexed orderer, string indexed operationId);
event PayoutExecuted(address indexed orderer, string indexed operationId);
event PayoutRejected(address indexed orderer, string indexed operationId, string reason);
event PayoutCancelled(address indexed orderer, string indexed operationId);
event ApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);
event RevokeApprovalToOrderPayout(address indexed walletToDebit, address indexed orderer);
```

### _Compliance_

In EM Token, all user-initiated methods should be checked from a compliance point of view. To do this, a set of functions is provided that return an output code as per EIP 1066 (https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1066.md). These functions are ```view``` and can be called by the user, however the real transactional methods should ```require```these functions to return 0x01 (the ```Success``` status code as of EIP 1066) to avoid non-authorized transactions to go through

```
function canTransfer(address from, address to, uint256 value) external view returns (bytes32 status);
function canApprove(address allower, address spender, uint256 value) external view returns (bytes32 status);

function canHold(address from, address to, address notary, uint256 value) external view returns (bytes32 status);
function canApproveToHold(address from, address holder) external view returns (bytes32 status);

function canApproveToOrderClearableTransfer(address fromWallet, address orderer) external view returns (bytes32 status);
function canOrderClearableTransfer(address fromWallet, address toWallet, uint256 value) external view returns (bytes32 status);

function canApproveToOrderFunding(address walletToFund, address orderer) external view returns (bytes32 status);
function canOrderFunding(address walletToFund, address orderer, uint256 value) external view returns (bytes32 status);
    
function canApproveToOrderPayout(address walletToDebit, address orderer) external view returns (bytes32 status);
function canOrderPayout(address walletToDebit, address orderer, uint256 value) external view returns (bytes32 status);
```

### _Consolidated ledger_

The EM Token ledger is composed on the interaction of three main entries that determine the amount of available funds for transactions:

* **Token balances**, like the ones one would receive when calling the ```balanceOf``` method
* **Drawn overdrafts**, which are effectively negative balances
* **Balance on hold**, resulting from the active holds in each moment

The combination of these three determine the availability of funds in each mmoment. Two methods are given to know these amounts:

```
function availableFunds(address wallet) external view returns (uint256);
function netBalanceOf(address wallet) external view returns (int256);
function totalDrawnAmount() external view returns (uint256);
```

```availableFunds()``` is calculated as ```balanceOf()``` plus ```unsecuredOverdraftLimit()``` minus ```drawnAmount()``` minus ```balanceOnHold()```

```netBalanceOf()``` is calculated as ```balanceOf()``` minus ```drawnAmount()```, although it should be guaranteed that at least one of these two is zero at all times (i.e. one cannot have a positive token balance and a drawn overdraft at the same time)

```totalDrawnAmount()``` returns the total amount drawn from all overdraft lines in all wallets (analogous to the totalSupply() method)


## Implementation ##

A reference implementation is provided, as per the following diagram:

![EM Token example implementation](./diagrams/implmentation_structure.png?raw=true "EM Token example implementation")

Some highlights:

* Basic "ledger" contracts providing internal methods are used as the base (then consolidated in the ```ConsolidatedLedger``` contract), so then the top contracts can use these to do accounting with a holistic view (e.g. ```transfer``` taking into account balances on hold and overdraft limits)
* The ```Compliant``` contract only implements very bsaic compliance checks for all methods, namely whether the involved parties in the transaction are whitelisted (as per the ```Whitelistable``` contract). Other, more elaborated versions of this are based on the R-Token contract, which provides compliance check functions on a "regulator service" implemented on a external contract that is accessed through a registry
* A ```RoleControl``` contract is used to provide basic role management beyond ```Ownable```, i.e. to control roles for ledger operators, CROs, compliance officers, etc. And also to provide several addresses with the same role
* An eternal storage construct is used to facilitate migrations. Essentially, all the storage variables throughout the contracts are implemented as pointers to the actual storage, which is implemented in a separate ```EternalStorage``` contract. This way, new versions of the main contract can be deployed and directed to the same eternal storage (or even several contracts can be used at the same time over the same eternal storage)

These implementation details are not part of the standard, although they can be considered best practices

## Future work

* Interest in overdraft lines
* Ledger management utilities (i.e. direct methods to mint, burn, modify status of requests etc. by the operator
* Iteration utilities in some mappings (e.g. list of approved holders for a wallet)
* R-Token registry for compliance checks
* A ```requestWallet``` method to rquest whitelisting (so whitelisting can be honored on the basis of a request)

## To Do's:

* TO DO: Add state diagrams in all workflow type transactions (Holds, Clearable transfers, Funding, Payouts)
* TO DO: consider adding roles to the standard
* TO DO: Check out ERC777 and extend this to comply with it, if appropriate
