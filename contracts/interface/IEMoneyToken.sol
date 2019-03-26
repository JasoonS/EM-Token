pragma solidity ^0.5;

/**
 * @title IEmoneyToken
 * @notice This is the interface that must be implemented to comply with the EM Token standard
 * @dev This includes only the functions that ensure interoperability, regardless of the actual implementation
 * and general management / admin functions
 */
interface IEMoneyToken {

    event Created(string indexed name, string indexed symbol, string indexed currency, uint8 decimals, string version);

    // /**
    //  * @notice Show the name of the tokenizer entity
    //  * @return the name of the token.
    //  */
    // function name() external view returns (string memory);

    // /**
    //  * @notice Show the symbol of the token
    //  * @return the symbol of the token.
    //  */
    // function symbol() external view returns (string memory);

    // /**
    //  * @notice Show the currency that backs the token
    //  * @return the currency of the token.
    //  */
    // function currency() external view returns (string memory);

    // /**
    //  * @notice Show the number of decimals of the token (remember, this is just for information purposes)
    //  * @return the number of decimals of the token.
    //  */
    // function decimals() external view returns (uint8);

    // /**
    //  * @notice Show the current version
    //  * @return the version of the smart contract.
    //  */
    // function version() external pure returns (string memory);

}