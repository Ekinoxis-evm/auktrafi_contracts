import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import hre from "hardhat";

async function main() {
  console.log("🧩 Compilando contratos...");
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Desplegando con:", deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // Get network-specific addresses
  const networkName = hre.network.name;
  let PYUSD_ADDRESS: string;
  
  if (networkName === "sepolia") {
    PYUSD_ADDRESS = process.env.PYUSD_SEPOLIA || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  } else if (networkName === "arbitrumSepolia") {
    PYUSD_ADDRESS = process.env.PYUSD_ARBITRUM_SEPOLIA || "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1";
  } else {
    // For localhost or other networks, use Sepolia PYUSD as default
    PYUSD_ADDRESS = process.env.PYUSD_SEPOLIA || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  }
  
  const DIGITAL_HOUSE_ADDRESS = process.env.DIGITAL_HOUSE_ADDRESS || "0x854b298d922fDa553885EdeD14a84eb088355822";

  console.log("🏭 Desplegando DigitalHouseFactory...");
  const Factory = await hre.ethers.getContractFactory("DigitalHouseFactory");
  const contract = await Factory.deploy(PYUSD_ADDRESS, DIGITAL_HOUSE_ADDRESS);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ Contrato desplegado en: ${address}`);

  const abi = Factory.interface.formatJson();
  const output = {
    contractName: "DigitalHouseFactory",
    address,
    abi: JSON.parse(abi)
  };

  const dir = path.resolve(__dirname, "../abi");
  if (!existsSync(dir)) mkdirSync(dir);
  const filePath = path.join(dir, "DigitalHouseFactory.json");

  writeFileSync(filePath, JSON.stringify(output, null, 2));
  console.log("📦 ABI y dirección exportados en:", filePath);

  // Log deployment details
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("🏭 DigitalHouseFactory:", address);
  console.log("💴 PYUSD Token:", PYUSD_ADDRESS);
  console.log("🏛️  Digital House Multisig:", DIGITAL_HOUSE_ADDRESS);
  console.log("📱 Deployer:", deployer.address);
  console.log("🌐 Network:", hre.network.name);

  console.log("\n🔍 Verificar contrato con:");
  console.log(`npx hardhat verify --network ${hre.network.name} ${address} "${PYUSD_ADDRESS}" "${DIGITAL_HOUSE_ADDRESS}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });