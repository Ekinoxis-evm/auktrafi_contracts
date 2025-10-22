import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("🔍 Environment Variables Debug:");
console.log("├─ NODE_ENV:", process.env.NODE_ENV);
console.log("├─ PRIVATE_KEY exists:", !!process.env.PRIVATE_KEY);
console.log("├─ PRIVATE_KEY length:", process.env.PRIVATE_KEY?.length || 0);
console.log("├─ PRIVATE_KEY starts with 0x:", process.env.PRIVATE_KEY?.startsWith('0x'));
console.log("├─ DIGITAL_HOUSE_ADDRESS exists:", !!process.env.DIGITAL_HOUSE_ADDRESS);
console.log("├─ DIGITAL_HOUSE_ADDRESS:", process.env.DIGITAL_HOUSE_ADDRESS);
console.log("├─ ETHERSCAN_API_KEY exists:", !!process.env.ETHERSCAN_API_KEY);
console.log("└─ PYUSD_SEPOLIA:", process.env.PYUSD_SEPOLIA);

// Test private key format
if (process.env.PRIVATE_KEY) {
  const pk = process.env.PRIVATE_KEY;
  const formatted = `0x${pk.replace(/^0x/, '')}`;
  console.log("\n🔧 Private Key Formatting:");
  console.log("├─ Original:", pk.substring(0, 10) + "...");
  console.log("└─ Formatted:", formatted.substring(0, 10) + "...");
}
