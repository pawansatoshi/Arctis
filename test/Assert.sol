// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract Assert {
    error AssertionFailed(string message);

    function _assertTrue(bool condition, string memory message) internal pure {
        if (!condition) revert AssertionFailed(message);
    }

    function _assertEq(address left, address right, string memory message) internal pure {
        if (left != right) revert AssertionFailed(message);
    }

    function _assertEq(uint256 left, uint256 right, string memory message) internal pure {
        if (left != right) revert AssertionFailed(message);
    }

    function _assertEq(bytes32 left, bytes32 right, string memory message) internal pure {
        if (left != right) revert AssertionFailed(message);
    }
}
