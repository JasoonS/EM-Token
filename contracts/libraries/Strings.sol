pragma solidity ^0.5;

library Strings {

    function toHash(string memory _s) internal pure returns (bytes32) {
        return keccak256(abi.encode(_s));
    }

    function toHash(bytes32 _s) internal pure returns (bytes32) {
        return keccak256(abi.encode(_s));
    }

    function concat(string memory _s1, string memory _s2) internal pure returns (string memory) {
        return string(abi.encodePacked(_s1, _s2));
    }

    function concat(string memory _s1, bytes32 _s2) internal pure returns (string memory) {
        return string(abi.encodePacked(_s1, _s2));
    }

    function concatAndHash(string memory _s1, string memory _s2) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_s1, _s2));
    }

    function equals(string memory _s1, string memory _s2) internal pure returns (bool) {
        return keccak256(abi.encode(_s1)) == keccak256(abi.encode(_s2));
    }

}
