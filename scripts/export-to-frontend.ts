import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
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
 * Script to export ABIs and addresses to frontend
 * Creates combined files for easy frontend consumption
 */
async function exportToFrontend() {
  console.log("🚀 Exportando ABIs y addresses al frontend...");

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  const abisDir = path.join(deploymentsDir, "abis");
  const addressesDir = path.join(deploymentsDir, "addresses");
  
  // Try to find frontend directory
  const possibleFrontendPaths = [
    path.resolve(__dirname, "../../digitalhouse-frontend/src/contracts"),
    path.resolve(__dirname, "../frontend/src/contracts"),
    path.resolve(__dirname, "../../frontend/src/contracts")
  ];
  
  let frontendDir: string | null = null;
  for (const dir of possibleFrontendPaths) {
    if (existsSync(path.dirname(dir))) {
      frontendDir = dir;
      break;
    }
  }
  
  if (!frontendDir) {
    console.log("⚠️  Frontend directory not found. Creating local export...");
    frontendDir = path.join(deploymentsDir, "frontend-export");
  }
  
  // Ensure frontend directory exists
  if (!existsSync(frontendDir)) {
    mkdirSync(frontendDir, { recursive: true });
  }

  // Read ABIs
  const factoryAbiPath = path.join(abisDir, "DigitalHouseFactory.json");
  const vaultAbiPath = path.join(abisDir, "DigitalHouseVault.json");
  
  if (!existsSync(factoryAbiPath) || !existsSync(vaultAbiPath)) {
    throw new Error("ABIs not found. Run 'npx ts-node scripts/update-abis.ts' first");
  }
  
  const factoryAbi = JSON.parse(readFileSync(factoryAbiPath, 'utf8'));
  const vaultAbi = JSON.parse(readFileSync(vaultAbiPath, 'utf8'));

  // Read addresses for each network
  const networks = ["sepolia", "arbitrumSepolia"];
  const deploymentData: { [network: string]: DeploymentResult } = {};
  
  for (const network of networks) {
    const addressFile = path.join(addressesDir, `${network}.json`);
    if (existsSync(addressFile)) {
      deploymentData[network] = JSON.parse(readFileSync(addressFile, 'utf8'));
    }
  }

  // Create combined factory file
  const factoryExport = {
    contractName: "DigitalHouseFactory",
    abi: factoryAbi,
    networks: Object.fromEntries(
      Object.entries(deploymentData).map(([network, data]) => [
        network,
        {
          chainId: data.chainId,
          address: data.contracts.DigitalHouseFactory?.address,
          verified: data.contracts.DigitalHouseFactory?.verified || false
        }
      ])
    )
  };

  // Create combined vault file  
  const vaultExport = {
    contractName: "DigitalHouseVault",
    abi: vaultAbi,
    networks: Object.fromEntries(
      Object.entries(deploymentData).map(([network, data]) => [
        network,
        {
          chainId: data.chainId,
          // Vault implementation address (for reference)
          implementationAddress: data.contracts.DigitalHouseVaultImplementation?.address,
          verified: data.contracts.DigitalHouseVaultImplementation?.verified || false
        }
      ])
    )
  };

  // Create addresses export
  const addressesExport = {
    networks: deploymentData,
    multisig: "0x854b298d922fDa553885EdeD14a84eb088355822",
    contracts: {
      factory: Object.fromEntries(
        Object.entries(deploymentData).map(([network, data]) => [
          network,
          data.contracts.DigitalHouseFactory?.address
        ])
      ),
      pyusd: Object.fromEntries(
        Object.entries(deploymentData).map(([network, data]) => [
          network,
          data.contracts.PYUSD?.address
        ])
      )
    }
  };

  // Write files to frontend
  const files = [
    { name: "DigitalHouseFactory.json", content: factoryExport },
    { name: "DigitalHouseVault.json", content: vaultExport },
    { name: "addresses.json", content: addressesExport }
  ];

  // Export to frontend
  for (const file of files) {
    const filePath = path.join(frontendDir, file.name);
    writeFileSync(filePath, JSON.stringify(file.content, null, 2));
    console.log(`✅ ${file.name} exportado al frontend`);
  }

  // Also create combined files in deployments directory
  const deploymentsCombinedDir = path.join(deploymentsDir, "combined");
  if (!existsSync(deploymentsCombinedDir)) {
    mkdirSync(deploymentsCombinedDir, { recursive: true });
  }

  for (const file of files) {
    const filePath = path.join(deploymentsCombinedDir, file.name);
    writeFileSync(filePath, JSON.stringify(file.content, null, 2));
    console.log(`✅ ${file.name} exportado a deployments/combined`);
  }

  console.log("\n🎉 Exportación completada!");
  console.log("📁 Ubicación:", frontendDir);
  console.log("\n📋 Archivos creados:");
  console.log("├── DigitalHouseFactory.json (ABI + addresses)");
  console.log("├── DigitalHouseVault.json (ABI + implementation addresses)");
  console.log("└── addresses.json (todas las addresses por network)");
  
  console.log("\n🔧 Para el frontend, usa:");
  console.log("- Factory address en Sepolia:", deploymentData.sepolia?.contracts.DigitalHouseFactory?.address);
  console.log("- Factory address en Arbitrum Sepolia:", deploymentData.arbitrumSepolia?.contracts.DigitalHouseFactory?.address);
  console.log("- Multisig (todas las networks):", "0x854b298d922fDa553885EdeD14a84eb088355822");
}

// Run if called directly
if (require.main === module) {
  exportToFrontend()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error exportando al frontend:", error);
      process.exit(1);
    });
}

export { exportToFrontend };
