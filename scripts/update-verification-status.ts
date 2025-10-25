import { readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * Script to update verification status of deployed contracts
 * Run this after verifying contracts on block explorers
 */
async function updateVerificationStatus() {
  console.log("🔄 Actualizando estado de verificación...");
  
  const addressesDir = path.resolve(__dirname, "../deployments/addresses");
  const networks = ["sepolia", "arbitrumSepolia"];
  
  for (const network of networks) {
    const filePath = path.join(addressesDir, `${network}.json`);
    
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      
      // Update verification status for deployed contracts
      if (data.contracts.DigitalHouseVaultImplementation) {
        data.contracts.DigitalHouseVaultImplementation.verified = true;
      }
      
      if (data.contracts.DigitalHouseFactory) {
        data.contracts.DigitalHouseFactory.verified = true;
      }
      
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ ${network}.json actualizado`);
    } catch (error: any) {
      console.error(`❌ Error actualizando ${network}:`, error.message);
    }
  }
  
  console.log("\n🎉 Estado de verificación actualizado!");
}

// Run if called directly
if (require.main === module) {
  updateVerificationStatus()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error actualizando estado:", error);
      process.exit(1);
    });
}

export { updateVerificationStatus };

