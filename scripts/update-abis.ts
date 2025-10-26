import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import hre from "hardhat";

/**
 * Script to automatically update ABIs from compiled contracts
 * Run this after compilation to keep ABIs in sync
 */
async function updateABIs() {
  console.log("🔄 Actualizando ABIs desde contratos compilados...");
  
  // Ensure compilation is up to date
  await hre.run("compile");
  
  // Create deployment directories
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  const abisDir = path.join(deploymentsDir, "abis");
  
  [deploymentsDir, abisDir].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  // Contract names to export
  const contracts = [
    "DigitalHouseFactory",
    "DigitalHouseVault"
  ];
  
  // Note: DigitalHouseVaultImplementation uses the same ABI as DigitalHouseVault
  // since it's the same contract, just deployed as implementation

  console.log("📦 Exportando ABIs actualizados...");
  
  for (const contractName of contracts) {
    try {
      const ContractFactory = await hre.ethers.getContractFactory(contractName);
      const abi = JSON.parse(ContractFactory.interface.formatJson());
      
      const abiPath = path.join(abisDir, `${contractName}.json`);
      writeFileSync(abiPath, JSON.stringify(abi, null, 2));
      
      console.log(`✅ ${contractName}.json actualizado`);
    } catch (error: any) {
      console.error(`❌ Error actualizando ${contractName}:`, error.message);
    }
  }
  
  console.log("\n🎉 ABIs actualizados exitosamente!");
  console.log("📁 Ubicación:", abisDir);
}

// Run if called directly
if (require.main === module) {
  updateABIs()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error actualizando ABIs:", error);
      process.exit(1);
    });
}

export { updateABIs };
