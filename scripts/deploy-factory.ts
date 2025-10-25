import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting DigitalHouseFactory deployment...");

  // Get the signer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Get deployment parameters
  const pyusdToken = process.env.PYUSD_SEPOLIA || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  const digitalHouseAddress = process.env.DIGITAL_HOUSE_ADDRESS;

  // Validate parameters
  if (!digitalHouseAddress) {
    throw new Error("❌ DIGITAL_HOUSE_ADDRESS environment variable is required");
  }

  console.log("🏦 PYUSD Token Address:", pyusdToken);
  console.log("🏠 Auktrafi Address:", digitalHouseAddress);

  // Deploy the contract
  console.log("⏳ Deploying DigitalHouseFactory...");
  const DigitalHouseFactory = await ethers.getContractFactory("DigitalHouseFactory");
  const factory = await DigitalHouseFactory.deploy(pyusdToken, digitalHouseAddress);

  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();

  console.log("✅ DigitalHouseFactory deployed to:", factoryAddress);

  // Verification info
  console.log("\n📋 Contract Details:");
  console.log("├─ Network: Sepolia (11155111)");
  console.log("├─ Factory Address:", factoryAddress);
  console.log("├─ PYUSD Token:", pyusdToken);
  console.log("├─ Auktrafi:", digitalHouseAddress);
  console.log("└─ Deployer:", deployer.address);

  console.log("\n🔍 Verification Command:");
  console.log(`npx hardhat verify --network sepolia ${factoryAddress} "${pyusdToken}" "${digitalHouseAddress}"`);

  return {
    factory: factoryAddress,
    pyusdToken,
    digitalHouseAddress,
    deployer: deployer.address
  };
}

main()
  .then((result) => {
    console.log("✨ Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
