// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

// Teaching example: unrestricted increments, not a production asset contract.
contract Counter {
    event Increased(uint256 oldValue, address cause);

    address public immutable deployer;
    uint256 public value;

    constructor() {
        deployer = msg.sender; // records identity; does not restrict inc()
    }

    function inc(uint256 times) external {
        for (uint256 i = 0; i < times; i++) {
            emit Increased(value, msg.sender);
            value += 1; // checked arithmetic in Solidity 0.8.x
        }
    }
}
