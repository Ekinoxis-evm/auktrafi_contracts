// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockPYUSD is ERC20 {
    constructor() ERC20("Mock PYUSD", "PYUSD") {
        // Mint 1 million tokens to deployer for testing
        _mint(msg.sender, 1000000 * 10**6); // 6 decimals like real PYUSD
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
