# Digital House - Night-by-Night Booking System 🏨

A decentralized booking platform using smart contracts on Ethereum, enabling property owners to tokenize their real estate and manage night-by-night reservations with an auction-based pricing model.

## 🌐 Deployed Contracts

### ✅ Ethereum Sepolia
- **Factory**: [`0x9fc0bdDF5E230256C0eEa3DD9B23EA7c05369865`](https://sepolia.etherscan.io/address/0x9fc0bdDF5E230256C0eEa3DD9B23EA7c05369865)
- **PYUSD**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **Chain ID**: `11155111`
- **Status**: ✅ Deployed & Ready

### ✅ Arbitrum Sepolia
- **Factory**: [`0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F`](https://sepolia.arbiscan.io/address/0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F)
- **PYUSD**: `0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1`
- **Chain ID**: `421614`
- **Status**: ✅ Deployed & Ready

---

## 🎯 How It Works

### Simple Night Numbers
Instead of complex timestamps, we use simple sequential numbers:
- **Night 1, Night 2, Night 3**, etc.
- Frontend maps these to actual calendar dates
- No timezone complexity in contracts

### Three-Level Architecture

```
┌─────────────────────────────────────┐
│   DigitalHouseFactory               │
│   - Creates parent vaults           │
│   - Manages availability            │
│   - Tracks all bookings             │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Parent Vault (Property)           │
│   - Owner: Property owner           │
│   - Treasury: Collects payments     │
│   - Withdrawal: Owner withdraws     │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Night Sub-Vaults                  │
│   - One per night (1, 2, 3...)      │
│   - Handles reservations/auctions   │
│   - Routes payments to parent       │
└─────────────────────────────────────┘
```

---

## 🚀 Quick Start

> **Note**: This project follows [Hardhat 3 best practices](https://hardhat.org/docs/learn-more/deploying-contracts) using `npx hardhat` commands directly instead of npm scripts.

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Contracts
```bash
npx hardhat compile
```

### 3. Run Tests
```bash
npx hardhat test                                    # All tests
npx hardhat test test/unit/NightBookingSystem.test.ts  # Night booking tests
```

### 4. Deploy Contracts

You can deploy using either method:

#### **Method A: Custom Deploy Script (Recommended)**
```bash
# Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Arbitrum Sepolia  
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

#### **Method B: Hardhat Ignition** 
```bash
# Sepolia
DIGITAL_HOUSE_ADDRESS=0x854b298d922fDa553885EdeD14a84eb088355822 npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network sepolia

# Arbitrum Sepolia
DIGITAL_HOUSE_ADDRESS=0x854b298d922fDa553885EdeD14a84eb088355822 npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network arbitrumSepolia
```

> **Note**: Method A automatically updates local ABIs and addresses. Method B uses [Hardhat Ignition](https://hardhat.org/docs/learn-more/deploying-contracts) for deterministic deployments.

### 5. Verify Contracts
```bash
# Sepolia (use address from deploy output)
npx hardhat verify --network sepolia 0xYourFactoryAddress "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" "0x854b298d922fDa553885EdeD14a84eb088355822"

# Arbitrum Sepolia (use address from deploy output)
npx hardhat verify --network arbitrumSepolia 0xYourFactoryAddress "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1" "0x854b298d922fDa553885EdeD14a84eb088355822"
```

### 6. Update ABIs (after contract changes)
```bash
npx hardhat run scripts/update-abis.ts
```

### 7. Access Deployment Data
```bash
# View deployed addresses
cat deployments/addresses/sepolia.json
cat deployments/addresses/arbitrumSepolia.json

# View ABIs
cat deployments/abis/DigitalHouseFactory.json
cat deployments/abis/DigitalHouseVault.json
```

---

## 📊 System Architecture

For detailed system diagrams and contract flow documentation, see [`docs/README.md`](./docs/README.md).

---

## 📚 Usage Examples

### For Property Owners

#### 1. Create a Property Vault
```javascript
const tx = await factory.createVault(
  "HOTEL-MIAMI-001",                    // Unique vault ID
  '{"city":"Miami","rooms":50}',        // Property details JSON
  ethers.parseUnits("100", 6),          // 100 PYUSD per night
  "MIAMI2024"                           // Master access code
);
```

#### 2. Set Availability
```javascript
// Set nights 1-30 as available
await factory.setAvailabilityWindow(
  "HOTEL-MIAMI-001",
  1,      // Start night
  30,     // End night  
  30      // Night count
);

// Or set individual nights
await factory.setNightAvailability("HOTEL-MIAMI-001", 15, true);
```

#### 3. Withdraw Earnings
```javascript
const parentVault = await ethers.getContractAt(
  "DigitalHouseVault",
  parentVaultAddress
);

// Check balance
const earnings = await parentVault.getEarningsBalance();

// Withdraw
await parentVault.withdrawEarnings();
```

### For Guests

#### 1. Check Availability
```javascript
// Check if night 15 is available
const isAvailable = await factory.getNightAvailability("HOTEL-MIAMI-001", 15);

// Get all sub-vaults for a property
const subVaults = await factory.getNightSubVaultsInfo("HOTEL-MIAMI-001");
```

#### 2. Book a Night
```javascript
// Create sub-vault for night 15
const subVaultAddress = await factory.getOrCreateNightVault(
  "HOTEL-MIAMI-001",
  15,           // Night number
  "MIAMI2024"   // Access code
);

// Create reservation
const subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
const nightPrice = ethers.parseUnits("100", 6);

await pyusd.approve(subVaultAddress, nightPrice);
await subVault.createReservation(
  nightPrice,
  checkInTimestamp,
  checkOutTimestamp
);
```

#### 3. Place a Bid (During Auction)
```javascript
const bidAmount = ethers.parseUnits("150", 6);
await pyusd.approve(subVaultAddress, bidAmount);
await subVault.placeBid(bidAmount);
```

#### 4. Check In
```javascript
// On check-in day
const accessCode = await subVault.checkIn();
console.log("Access Code:", accessCode); // Returns master access code
```

---

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
npx hardhat test
```

**Test Results:**
```
Night-by-Night Booking System
  ✔ Night number system (simple integers)
  ✔ Availability management (owner controls)
  ✔ Sub-vault creation (per night)
  ✔ Parent vault treasury (centralized payments)
  ✔ State synchronization (factory tracking)
  ✔ Single-night bookings
  ✔ Ownership management

22 passing (615ms)
```

**Test Coverage:**
- Night number system
- Availability management (set/get/window)
- Sub-vault creation and properties
- Parent vault treasury functions
- State synchronization with factory
- Single-night booking validation
- Ownership and access control

---

## 🏗️ Contract Architecture

### DigitalHouseFactory.sol
Main factory contract for creating and managing property vaults.

**Key Functions:**
- `createVault()` - Create a new property vault
- `setNightAvailability()` - Set individual night availability
- `setAvailabilityWindow()` - Bulk set night availability
- `getNightAvailability()` - Check if a night is available
- `getOrCreateNightVault()` - Create sub-vault for a specific night
- `getNightSubVaultsInfo()` - Get all sub-vaults for a property
- `updateNightSubVaultState()` - Update sub-vault state (called by sub-vaults)

### DigitalHouseVault.sol
Individual vault contract for managing reservations and auctions.

**Key Functions:**
- `createReservation()` - Create initial reservation
- `placeBid()` - Place bid during auction
- `cedeReservation()` - Cede reservation to bidder
- `checkIn()` - Check in and receive access code
- `checkOut()` - Check out and reset vault
- `withdrawEarnings()` - Withdraw earnings (parent vaults only)
- `receivePayment()` - Receive payment from sub-vault

**States:**
- `FREE` - Available for booking
- `AUCTION` - Reservation exists, accepting bids
- `SETTLED` - Guest checked in

---

## 💰 Payment Distribution

### Base Price Distribution (95% / 5%)
- **95%** → Parent Vault (Property Owner)
- **5%** → Digital House Platform

### Additional Value Distribution (when bid > base price)
- **40%** → Current Booker (who checked in)
- **30%** → Last Booker (who ceded reservation)
- **20%** → Parent Vault (Property Owner)
- **10%** → Digital House Platform

### Centralized Treasury
- All payments route to parent vault contract
- Owner can withdraw anytime via `withdrawEarnings()`
- Transparent earnings tracking

---

## 🔒 Security Features

- **ReentrancyGuard**: Protection against reentrancy attacks
- **Ownable**: Access control for administrative functions
- **Input Validation**: Comprehensive parameter validation
- **Safe Transfers**: Secure PYUSD token transfers
- **Event Logging**: Complete audit trail
- **State Synchronization**: Real-time state updates to factory

---

## 🛠️ Development

### Project Structure
```
contracts/
├── DigitalHouseFactory.sol          # Main factory
├── DigitalHouseVault.sol            # Individual vaults
├── interfaces/
│   ├── IDigitalHouseFactory.sol     # Factory interface
│   └── IDigitalHouseVault.sol       # Vault interface
└── mocks/
    └── MockPYUSD.sol                # Mock PYUSD for testing

deployments/
├── abis/
│   ├── DigitalHouseFactory.json     # Pure Factory ABI
│   └── DigitalHouseVault.json       # Pure Vault ABI
└── addresses/
    ├── sepolia.json                 # Sepolia deployment addresses
    └── arbitrumSepolia.json         # Arbitrum Sepolia addresses

test/unit/
├── NightBookingSystem.test.ts       # Night booking tests (22 tests)
├── DigitalHouse.test.ts             # End-to-end tests
└── DigitalHouseFactory.test.ts      # Factory tests

scripts/
├── deploy.ts                        # Deployment script with ABI/address separation
└── verify.ts                        # Verification script
```

### Tech Stack
- **Framework**: Hardhat 3.x
- **Language**: Solidity 0.8.20
- **Testing**: Mocha + Chai + Ethers v6
- **Token**: PYUSD (ERC-20)

### Configuration
```typescript
// hardhat.config.ts
solidity: {
  version: "0.8.20",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1  // Optimized for contract size
    }
  }
}
```

### Deployment Structure
The project uses a **local-first** approach with clean separation between ABIs and addresses:

**ABIs (Pure Interface)**:
- `deployments/abis/DigitalHouseFactory.json` - Factory contract interface
- `deployments/abis/DigitalHouseVault.json` - Vault contract interface

**Addresses (Network-Specific)**:
- `deployments/addresses/sepolia.json` - Sepolia deployment info
- `deployments/addresses/arbitrumSepolia.json` - Arbitrum deployment info

**Automated Management**:
- 🔄 **Auto-update**: Deploy script automatically updates local ABIs and addresses
- 📦 **ABI Sync**: `npx hardhat run scripts/update-abis.ts` keeps ABIs in sync with compiled contracts
- 🔍 **Native Verification**: Uses Hardhat 3's built-in `npx hardhat verify` command
- 📁 **Local Focus**: No external dependencies - everything managed locally

**Benefits**:
- ✅ Clean separation of concerns
- ✅ Automatic local updates on deployment
- ✅ Version control friendly
- ✅ No external folder dependencies
- ✅ Sourcify issues handled gracefully
- ✅ Professional deployment tracking

---

## 📝 Key Features

### ✨ Night-by-Night System
- Simple sequential night numbers (no complex timestamps)
- Owner-controlled availability
- Single-night bookings only
- Individual night bidding

### 🏦 Centralized Treasury
- All payments route to parent vault
- Owner withdrawal on demand
- Transparent earnings tracking
- No separate real estate address needed

### 🎯 Auction Mechanism
- First booker sets initial stake
- Others can bid higher amounts
- Booker can cede to highest bidder
- Citizen value distribution on check-in

### 🔐 Access Control
- Master access code per property
- Owner can update access code
- Secure code storage
- Only authorized parties can view

---

## 🔗 Contract Verification

### Sepolia
```bash
npx hardhat verify --network sepolia \
  0x9fc0bdDF5E230256C0eEa3DD9B23EA7c05369865 \
  "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9" \
  "0x854b298d922fDa553885EdeD14a84eb088355822"
```

### Arbitrum Sepolia
```bash
npx hardhat verify --network arbitrumSepolia \
  0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F \
  "0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1" \
  "0x854b298d922fDa553885EdeD14a84eb088355822"
```

---

## 🌟 What's New (Latest Version)

### Simplified Night System
- ✅ Removed complex timestamp calculations
- ✅ Simple night numbers (1, 2, 3...)
- ✅ No timezone complexity
- ✅ Easier frontend integration

### Centralized Payments
- ✅ Parent vault acts as treasury
- ✅ Owner withdrawal functionality
- ✅ Removed separate real estate address
- ✅ Transparent earnings tracking

### Optimized Contracts
- ✅ Contract size: 24,576 bytes (exactly at limit)
- ✅ Shortened error messages for size optimization
- ✅ Ownership transfer to vault creator
- ✅ State synchronization with factory

### Availability Management
- ✅ Owner pre-sets available nights
- ✅ Bulk availability setting
- ✅ Prevents booking unavailable nights
- ✅ Individual night control

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Contact: [Your contact info]

---

**Built with ❤️ for decentralized hospitality**
