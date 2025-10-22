import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Hardhat Ignition Module for deploying DigitalHouseFactory
 *
 * Usage:
 * npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network sepolia
 * npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network arbitrumSepolia
 * 
 * Environment Variables Required:
 * - PYUSD_SEPOLIA or PYUSD_ARBITRUM_SEPOLIA (depending on network)
 * - DIGITAL_HOUSE_ADDRESS (Digital House multisig address)
 */
const DigitalHouseFactoryModule = buildModule("DigitalHouseFactoryModule", (m) => {

  // Get PYUSD address based on network - use hardcoded addresses as defaults
  const pyusdAddresses = {
    sepolia: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9",
    arbitrumSepolia: "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1",
  };
  
  // Try to get from environment variables, fallback to hardcoded
  const pyusdToken = m.getParameter(
    "pyusdToken", 
    process.env.PYUSD_SEPOLIA || 
    process.env.PYUSD_ARBITRUM_SEPOLIA || 
    pyusdAddresses.sepolia // Default to sepolia if no env var
  );

  // Digital House multisig address (same across networks)
  const digitalHouseAddress = m.getParameter(
    "digitalHouseAddress", 
    process.env.DIGITAL_HOUSE_ADDRESS || ""
  );

  // Validate required parameters
  if (!pyusdToken) {
    throw new Error("PYUSD token address is required");
  }
  
  if (!digitalHouseAddress) {
    throw new Error("Digital House address is required (DIGITAL_HOUSE_ADDRESS env var)");
  }

  // Deploy the Factory contract
  // Constructor: constructor(address _pyusdToken, address _digitalHouseAddress)
  const factory = m.contract("DigitalHouseFactory", [
    pyusdToken,
    digitalHouseAddress,
  ]);

  return { factory };
});

export default DigitalHouseFactoryModule;
