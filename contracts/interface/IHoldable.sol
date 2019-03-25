pragma solidity ^0.5;

interface IHoldable {

    enum HoldStatusCode {
        Nonexistent,
        Ordered,
        ExecutedByNotary,
        ExecutedByOperator,
        ReleasedByNotary,
        ReleasedByPayee,
        ReleasedByOperator,
        ReleasedOnExpiration
    }

    event HoldCreated(
        address indexed holder,
        string  indexed operationId,
        address from,
        address to,
        address indexed notary,
        uint256 amount,
        bool    expires,
        uint256 expiration
    ); // By holder (which can be the payer as well)

    event HoldExecuted(address indexed holder, string indexed operationId, HoldStatusCode status); // By notary or by operator

    event HoldReleased(address indexed holder, string indexed operationId, HoldStatusCode status); // By notary, by payee, by operator, or due to expiration

    event HoldRenewed(address indexed holder, string indexed operationId, uint256 oldExpiration, uint256 newExpiration); // By holder

    /**
     * @notice This function allows wallet owners to approve other addresses to perform holds on their behalf
     * @dev It is similar to the "approve" method in ERC20, but in this case no allowance is given and this is treated
     * as a "yes or no" flag
     * @param holder The address to be approved as potential issuer of holds
     */
    function approveToHold(address holder) external returns (bool);

    /**
     * @notice This function allows wallet owners to revoke holding privileges from previously approved addresses
     * @param holder The address to be revoked as potential issuer of holds
     */
    function revokeApprovalToHold(address holder) external returns (bool);

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the payer, who is the sender of the transaction) in
     * favor of another wallet owner (the payee), and specifying a notary who will be responsable to either execute or
     * release the transfer
     * @param transactionId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same transactionId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param to The address of the payee, to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     */
    function hold(
        string calldata operationId,
        address to,
        address notary,
        uint256 amount,
        bool expires,
        uint256 timeToExpiration
    )
        external
        returns (bool);

    /**
     * @notice Function to perform a hold on behalf of a wallet owner (the payer, entered in the "from" address) in favor of
     * another wallet owner (the payee, entered in the "to" address), and specifying a notary who will be responsable to either
     * execute or release the transfer
     * @param transactionId An unique ID to identify the hold. Internally IDs will be stored together with the addresses
     * issuing the holds (on a mapping (address => mapping (string => XXX ))), so the same transactionId can be used by many
     * different holders. This is provided assuming that the hold functionality is a competitive resource
     * @param from The address of the payer, from which the tokens are to be taken (if the hold is executed)
     * @param to The address of the payee, to which the tokens are to be paid (if the hold is executed)
     * @param notary The address of the notary who is going to determine whether the hold is to be executed or released
     * @param amount The amount to be transferred
     * @param expires A flag specifying whether the hold can expire or not
     * @param timeToExpiration (only relevant when expires==true) The time to be added to the currrent block.timestamp to
     * establish the expiration time for the hold. After the expiration time anyone can actually trigger the release of the hold
     */
    function holdFrom(
        string calldata operationId,
        address from,
        address to,
        address notary,
        uint256 amount,
        bool expires,
        uint256 timeToExpiration
    )
        external
        returns (bool);

    /**
     * @notice Function to release a hold (if at all possible)
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     */
    function releaseHold(address holder, string calldata operationId) external returns (bool);
    
    /**
     * @notice Function to execute a hold (if at all possible)
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     * @dev Holds that are expired can still be executed by the notary or the operator (as well as released by anyone)
     */
    function executeHold(address holder, string calldata operationId) external returns (bool);

    /**
     * @notice Function to renew a hold (added time from now)
     * @param transactionId The ID of the hold in question
     * @dev Only the issuer can renew a hold
     * @dev Non closed holds can be renewed, including holds that are already expired
     */
    function renewHold(string calldata operationId, uint256 timeToExpirationFromNow) external returns (bool);

    /**
     * @notice Returns whether an address is approved to submit holds on behalf of other wallets
     * @param wallet The wallet on which the holds would be performed (i.e. the payer)
     * @param holder The address approved to hold on behalf of the wallet owner
     * @return Whether the holder is approved or not to hold on behalf of the wallet owner
     */
    function isApprovedToHold(address wallet, address holder) external view returns (bool);

    /**
     * @notice Function to retrieve all the information available for a particular hold
     * @param issuer The address of the original sender of the hold
     * @param transactionId The ID of the hold in question
     * @return from: the wallet from which the tokens will be taken if the hold is executed
     * @return to: the wallet to which the tokens will be transferred if the hold is executed
     * @return notary: the address that will be executing or releasing the hold
     * @return amount: the amount that will be transferred
     * @return expires: a flag indicating whether the hold expires or not
     * @return expiration: (only relevant in case expires==true) the absolute time (block.timestamp) by which the hold will
     * expire (after that time the hold can be released by anyone)
     * @return status: the current status of the hold
     * @dev issuer and transactionId are needed to index a hold. This is provided so different issuers can use the same transactionId,
     * as holding is a competitive resource
     */
    function retrieveHoldData(address holder, string calldata operationId)
        external view
        returns (
            address from,
            address to,
            address notary,
            uint256 amount,
            bool expires,
            uint256 expiration,
            HoldStatusCode status
        );

    /**
     * @dev Function to know how much is locked on hold from a particular wallet
     * @param wallet The address of the wallet
     * @return The balance on hold for a particular wallet
     */
    function balanceOnHold(address wallet) external view returns (uint256);

    /**
     * @dev Function to know how much is locked on hold for all accounts
     * @return The total amount in balances on hold from all wallets
     */
    function totalSupplyOnHold() external view returns (uint256);
    
}