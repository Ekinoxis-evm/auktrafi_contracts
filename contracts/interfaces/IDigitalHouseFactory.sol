// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDigitalHouseFactory
 * @dev Interface for DigitalHouseFactory contract
 */
interface IDigitalHouseFactory {
    /**
     * @dev Update night sub-vault state (called by sub-vault contracts)
     * @param subVaultAddress Address of the sub-vault
     * @param newState New state as uint8 (0=FREE, 1=AUCTION, 2=SETTLED)
     */
    function updateNightSubVaultState(address subVaultAddress, uint8 newState) external;
}