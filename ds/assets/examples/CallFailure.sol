// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

// Isolated failure-semantics fixture, not deployment advice.
contract Child {
    uint256 public value;
    event Changed(uint256 value);
    function fail() external {
        value = 99;
        emit Changed(value);
        revert("child rejects");
    }
}

contract Parent {
    uint256 public value;
    event Continued(bool childSucceeded);
    function caught(address child) external {
        value = 1;
        (bool ok,) = child.call(abi.encodeWithSignature("fail()"));
        require(!ok, "expected fixture failure");
        value = 2;
        emit Continued(ok);
    }
    function propagated(address child) external {
        value = 1;
        Child(child).fail();
        value = 2;
    }
}
