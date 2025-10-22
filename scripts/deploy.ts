import { ethers } from "hardhat";

async function main() {
  console.log("🏗️  Deploying DigitalHouse contracts to Sepolia...");

  // Contract addresses
  const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  const DIGITAL_HOUSE_MULTISIG = "0x854b298d922fDa553885EdeD14a84eb088355822";

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📱 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy DigitalHouseFactory
  console.log("\n🏭 Deploying DigitalHouseFactory...");
  const DigitalHouseFactory = await ethers.getContractFactory("DigitalHouseFactory");
  const factory = await DigitalHouseFactory.deploy(
    PYUSD_SEPOLIA,
    DIGITAL_HOUSE_MULTISIG
  );

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ DigitalHouseFactory deployed to:", factoryAddress);

  // Log deployment details
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("🏭 DigitalHouseFactory:", factoryAddress);
  console.log("💴 PYUSD Token:", PYUSD_SEPOLIA);
  console.log("🏛️  Digital House Multisig:", DIGITAL_HOUSE_MULTISIG);
  console.log("📱 Deployer:", deployer.address);
  console.log("🌐 Network: Sepolia");

  // Save deployment addresses
  const deploymentInfo = {
    network: "sepolia",
    factory: factoryAddress,
    pyusd: PYUSD_SEPOLIA,
    digitalHouse: DIGITAL_HOUSE_MULTISIG,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  console.log("\n💾 Deployment info saved:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🔍 Verify contract with:");
  console.log(`npx hardhat verify --network sepolia ${factoryAddress} "${PYUSD_SEPOLIA}" "${DIGITAL_HOUSE_MULTISIG}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });