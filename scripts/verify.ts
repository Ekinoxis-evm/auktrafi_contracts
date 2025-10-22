import { run } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Verify environment variables are loaded
console.log("Environment check:");
console.log("- ETHERSCAN_API_KEY:", process.env.ETHERSCAN_API_KEY ? "SET" : "NOT SET");
console.log("- FACTORY_ADDRESS:", process.env.FACTORY_ADDRESS || "NOT SET");

/**
 * Contract verification script for block explorers
 *
 * Usage:
 * npx hardhat run scripts/verify.ts --network sepolia
 */
async function main() {
  // Replace with your deployed contract address
  const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "";

  if (!FACTORY_ADDRESS) {
    throw new Error("Please set FACTORY_ADDRESS in your .env file");
  }

  // Constructor arguments
  const pyusdToken = process.env.PYUSD_SEPOLIA || "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";
  const digitalHouseAddress = process.env.DIGITAL_HOUSE_ADDRESS || "0x854b298d922fDa553885EdeD14a84eb088355822";

  console.log("Verifying DigitalHouseFactory at:", FACTORY_ADDRESS);
  console.log("Constructor arguments:");
  console.log("- PYUSD Token:", pyusdToken);
  console.log("- Digital House Address:", digitalHouseAddress);

  try {
    await run("verify:verify", {
      address: FACTORY_ADDRESS,
      constructorArguments: [
        pyusdToken,
        digitalHouseAddress,
      ],
    });
    console.log("Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
