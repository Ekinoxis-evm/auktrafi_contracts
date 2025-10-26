import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import hre from "hardhat";

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
 * Script to update deployments/ directory with the same structure as frontend
 * Creates: ABIs per contract + 1 combined addresses file with all chains
 */
async function updateDeployments() {
  console.log("🔄 Actualizando estructura de deployments...");

  // Ensure compilation is up to date
  await hre.run("compile");

  const deploymentsDir = path.resolve(__dirname, "../deployments");
  const abisDir = path.join(deploymentsDir, "abis");
  
  // Ensure directories exist
  [deploymentsDir, abisDir].forEach(dir => {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  });

  // 1. UPDATE ABIs (separate files per contract)
  console.log("📦 Actualizando ABIs...");
  
  const contracts = ["DigitalHouseFactory", "DigitalHouseVault"];
  
  for (const contractName of contracts) {
    try {
      const ContractFactory = await hre.ethers.getContractFactory(contractName);
      const abi = JSON.parse(ContractFactory.interface.formatJson());
      
      const abiPath = path.join(abisDir, `${contractName}.json`);
      writeFileSync(abiPath, JSON.stringify(abi, null, 2));
      
      console.log(`✅ ${contractName}.json ABI actualizado`);
    } catch (error: any) {
      console.error(`❌ Error actualizando ABI ${contractName}:`, error.message);
    }
  }

  // 2. CREATE DEPLOYMENT DATA (hardcoded addresses)
  console.log("📍 Creando datos de deployment...");
  
  const deploymentData: { [network: string]: DeploymentResult } = {
    sepolia: {
      chainId: 11155111,
      name: "sepolia",
      contracts: {
        DigitalHouseFactory: {
          address: "0x2B7399bce5fCa0715d98D0aD3FD4661AA261fD6E",
          deployedAt: "2025-10-25T12:49:01.864Z",
          deployer: "0x854b298d922fDa553885EdeD14a84eb088355822",
          verified: true
        },
        PYUSD: {
          address: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9",
          deployedAt: "N/A",
          deployer: "N/A",
          verified: true,
          external: true
        },
        DigitalHouseMultisig: {
          address: "0x854b298d922fDa553885EdeD14a84eb088355822",
          deployedAt: "N/A",
          deployer: "N/A",
          verified: true,
          external: true
        },
        DigitalHouseVaultImplementation: {
          address: "0x847Fc56F9B339db4f977e3cC553f2159A3018F99",
          deployedAt: "2025-10-25T12:49:01.864Z",
          deployer: "0x854b298d922fDa553885EdeD14a84eb088355822",
          verified: false
        }
      }
    },
    arbitrumSepolia: {
      chainId: 421614,
      name: "arbitrumSepolia",
      contracts: {
        DigitalHouseFactory: {
          address: "0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F",
          deployedAt: "2024-12-28T10:35:00Z",
          deployer: "0x854b298d922fDa553885EdeD14a84eb088355822",
          verified: true
        },
        PYUSD: {
          address: "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1",
          deployedAt: "N/A",
          deployer: "N/A",
          verified: true,
          external: true
        },
        DigitalHouseMultisig: {
          address: "0x854b298d922fDa553885EdeD14a84eb088355822",
          deployedAt: "N/A",
          deployer: "N/A",
          verified: true,
          external: true
        }
      }
    }
  };
  
  console.log("✅ Datos de deployment creados");

  // 3. CREATE COMBINED ADDRESSES FILE (like frontend)
  console.log("🔗 Creando archivo combinado de addresses...");
  
  const combinedAddresses = {
    networks: deploymentData,
    multisig: "0x854b298d922fDa553885EdeD14a84eb088355822",
    contracts: {
      factory: Object.fromEntries(
        Object.entries(deploymentData).map(([network, data]) => [
          network,
          data.contracts.DigitalHouseFactory?.address
        ])
      ),
      vaultImplementation: Object.fromEntries(
        Object.entries(deploymentData).map(([network, data]) => [
          network,
          data.contracts.DigitalHouseVaultImplementation?.address
        ])
      ),
      pyusd: Object.fromEntries(
        Object.entries(deploymentData).map(([network, data]) => [
          network,
          data.contracts.PYUSD?.address
        ])
      )
    },
    summary: {
      totalNetworks: Object.keys(deploymentData).length,
      availableContracts: ["DigitalHouseFactory", "DigitalHouseVaultImplementation", "PYUSD", "DigitalHouseMultisig"],
      lastUpdated: new Date().toISOString()
    }
  };

  // Write combined addresses file
  const combinedAddressesPath = path.join(deploymentsDir, "addresses.json");
  writeFileSync(combinedAddressesPath, JSON.stringify(combinedAddresses, null, 2));
  console.log("✅ addresses.json combinado creado");

  console.log("\n🎉 Estructura de deployments actualizada!");
  console.log("📁 Estructura súper limpia:");
  console.log("deployments/");
  console.log("├── abis/");
  console.log("│   ├── DigitalHouseFactory.json     # ABI puro");
  console.log("│   └── DigitalHouseVault.json       # ABI puro");
  console.log("└── addresses.json                   # TODAS las addresses (todos los networks)");
  
  console.log("\n🔧 Addresses disponibles:");
  console.log("- Factory Sepolia:", deploymentData.sepolia?.contracts.DigitalHouseFactory?.address);
  console.log("- Factory Arbitrum Sepolia:", deploymentData.arbitrumSepolia?.contracts.DigitalHouseFactory?.address);
  console.log("- Multisig (todas las networks):", "0x854b298d922fDa553885EdeD14a84eb088355822");
}

// Run if called directly
if (require.main === module) {
  updateDeployments()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Error actualizando deployments:", error);
      process.exit(1);
    });
}

export { updateDeployments };
