import { writeFileSync, readFileSync, existsSync } from "fs";
import path from "path";

interface DeploymentResult {
  chainId: number;
  name: string;
  contracts: {
    [contractName: string]: {
      address: string;
      deployedAt: string;
      deployer: string;
      verified: boolean;
      external?: boolean;
    };
  };
}

/**
 * Script to update deployment addresses with correct multisig and ensure consistency
 */
async function updateAddresses() {
  console.log("🔄 Actualizando addresses en deployments...");

  const deploymentsDir = path.resolve(__dirname, "../deployments/addresses");
  const STANDARD_MULTISIG = "0x854b298d922fDa553885EdeD14a84eb088355822";
  
  // Network configurations
  const networks = [
    {
      file: "sepolia.json",
      chainId: 11155111,
      name: "sepolia",
      pyusdAddress: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
    },
    {
      file: "arbitrumSepolia.json", 
      chainId: 421614,
      name: "arbitrumSepolia",
      pyusdAddress: "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1"
    }
  ];

  for (const network of networks) {
    const filePath = path.join(deploymentsDir, network.file);
    
    if (existsSync(filePath)) {
      try {
        const existingData: DeploymentResult = JSON.parse(readFileSync(filePath, 'utf8'));
        
        // Update multisig address to be consistent
        if (existingData.contracts.DigitalHouseMultisig) {
          existingData.contracts.DigitalHouseMultisig.address = STANDARD_MULTISIG;
        }
        
        // Ensure PYUSD address is correct
        if (existingData.contracts.PYUSD) {
          existingData.contracts.PYUSD.address = network.pyusdAddress;
        }
        
        // Ensure chainId and name are correct
        existingData.chainId = network.chainId;
        existingData.name = network.name;
        
        writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        console.log(`✅ ${network.file} actualizado`);
        console.log(`   - Multisig: ${STANDARD_MULTISIG}`);
        console.log(`   - PYUSD: ${network.pyusdAddress}`);
        
      } catch (error: any) {
        console.error(`❌ Error actualizando ${network.file}:`, error.message);
      }
    } else {
      console.log(`⚠️  ${network.file} no existe, saltando...`);
    }
  }
  
  console.log("\n🎉 Addresses actualizados!");
  console.log(`📍 Multisig estándar: ${STANDARD_MULTISIG}`);
}

// Run if called directly
if (require.main === module) {
  updateAddresses()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error actualizando addresses:", error);
      process.exit(1);
    });
}

export { updateAddresses };
