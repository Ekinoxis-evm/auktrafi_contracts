# 🏨 Auktrafi - Decentralized Hotel Booking Platform

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-3.x-yellow?logo=hardhat)
![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.4.0-purple?logo=ethereum)
![License](https://img.shields.io/badge/License-MIT-green)

**Revolutionary booking platform with auction system, citizen value distribution, and date-specific sub-vaults**

[🚀 Quick Start](#-quick-start) • [📖 Documentation](#-how-it-works) • [🏗️ Architecture](#️-architecture) • [🌐 Deployed Contracts](#-deployed-contracts)

</div>

---

## 🎯 What is Auktrafi?

Auktrafi is a **decentralized hotel booking platform** that transforms traditional reservations into an innovative auction system. Users can book properties, participate in auctions, and earn **citizen value** when they cede their reservations to higher bidders.

### ✨ Key Innovations

- 🏨 **Sub-Vault System**: Multiple users can book different dates for the same property simultaneously
- 🎯 **Auction Mechanism**: Competitive bidding system for popular dates
- 💰 **Citizen Value**: Original bookers earn rewards when ceding to higher bidders
- 🔑 **Master Access Codes**: Property owners control access codes
- 💳 **PYUSD Payments**: Stable transactions with PayPal USD
- 🌐 **Multi-chain**: Deployed on Ethereum and Arbitrum

---

## 🔄 How It Works

### 1. 🏨 Property Creation
Hotels create **Parent Vaults** for their properties with base prices and master access codes.

### 2. 📅 Date-Specific Booking
When users want to book specific dates, the system automatically creates **Sub-Vaults** for those dates.

### 3. 🎯 Auction System
- **First User**: Creates reservation with stake amount
- **Other Users**: Can place higher bids during auction period
- **Original Booker**: Can cede reservation to highest bidder (earning citizen value)

### 4. 🏠 Check-in & Access
- Winner checks in and receives the master access code
- Payments are distributed according to the citizen value model

---

## 💰 Payment Distribution

### 🔹 Standard Payment (No Cession)
When the original booker checks in without ceding:
```
Base Price Distribution:
├─ 95% → Hotel/Property Owner
└─ 5%  → Platform Fee
```

### 🔹 Citizen Value Distribution (With Cession)
When a reservation is ceded to a higher bidder, the **additional value** is distributed:

```
Additional Value = Final Bid - Original Stake

Distribution of Additional Value:
├─ 40% → Current Booker (who checks in)
├─ 30% → Last Booker (who ceded)
├─ 20% → Hotel/Property Owner
└─ 10% → Platform Fee
```

**Example:**
- Original stake: 1,000 PYUSD
- Winning bid: 1,500 PYUSD
- Additional value: 500 PYUSD

**Distribution:**
- Current booker gets: 200 PYUSD (40% of 500)
- Last booker gets: 150 PYUSD (30% of 500) ✨ **Citizen Value**
- Hotel gets: 100 PYUSD (20% of 500)
- Platform gets: 50 PYUSD (10% of 500)

---

## 🔑 Access Code System

### Master Access Codes
- **Property Owner Controlled**: Hotels define their own access codes during vault creation
- **Updatable**: Property owners can update codes anytime
- **Inherited**: All sub-vaults inherit the parent vault's master access code
- **Secure Storage**: Codes are stored privately and only accessible to authorized parties

### Access Code Lifecycle
1. **Creation**: Property owner sets master code (e.g., "HOTEL2024")
2. **Inheritance**: Sub-vaults automatically inherit this code
3. **Check-in**: Winner receives the master access code
4. **Update**: Property owner can update the master code anytime

---

## 🏗️ Architecture

### 📦 Smart Contracts

#### **DigitalHouseFactory.sol**
Main factory contract that manages all properties and creates sub-vaults.

**Key Functions:**
- `createVault()` - Create parent vault for property
- `getOrCreateDateVault()` - Create/get sub-vault for specific dates
- `isDateRangeAvailable()` - Check date availability
- `getDateVault()` - Get existing sub-vault
- `getParentVault()` - Get parent from sub-vault address

#### **DigitalHouseVault.sol**
Individual vault contracts for each date-specific reservation.

**Key Functions:**
- `createReservation()` - Make initial reservation
- `placeBid()` - Place higher bid in auction
- `cedeReservation()` - Cede to higher bidder
- `checkIn()` - Check in and receive access code
- `checkOut()` - Complete stay and reset vault

### 🔄 Sub-Vault System

```
🏨 HOTEL-MIAMI-001 (Parent Vault)
├── 📅 Dec 1-3: User A booked → Sub-Vault: HOTEL-MIAMI-001-1733011200-1733270400
├── 📅 Dec 5-7: User B checked in → Sub-Vault: HOTEL-MIAMI-001-1733443200-1733702400
├── 📅 Dec 10-12: Available → Sub-Vault: Not created yet
└── 📅 Dec 15-17: Available → Sub-Vault: Not created yet
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn
- Git

### 1. Clone and Install
```bash
git clone https://github.com/Ekinoxis-evm/auktrafi_contracts.git
cd auktrafi_contracts
npm install
```

### 2. Environment Setup
```bash
# Create .env file
cp .env.example .env

# Configure your .env:
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_api_key
DIGITAL_HOUSE_ADDRESS=your_multisig_address
```

### 3. Compile and Test
```bash
# Compile contracts
npx hardhat compile

# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Sub-Vault System"
```

### 4. Deploy
```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

---

## 🌐 Deployed Contracts

### ✅ Ethereum Sepolia
- **Factory**: [`0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F`](https://sepolia.etherscan.io/address/0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F#code)
- **PYUSD**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **Status**: ✅ Verified & Ready

### ✅ Arbitrum Sepolia
- **Factory**: [`0xC3f3B1192E938A22a79149bbFc6d8218B1bC0117`](https://sepolia.arbiscan.io/address/0xC3f3B1192E938A22a79149bbFc6d8218B1bC0117#code)
- **PYUSD**: `0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1`
- **Status**: ✅ Verified & Ready

---

## 📚 Usage Examples

### Creating a Property Vault
```javascript
const tx = await factory.createVault(
  "HOTEL-MIAMI-001",                    // Unique vault ID
  '{"city":"Miami","rooms":50}',        // Property details JSON
  ethers.parseUnits("1000", 6),         // Base price: 1000 PYUSD
  "0x123...abc",                        // Hotel owner address
  "MIAMI2024"                           // Master access code
);
```

### Booking Specific Dates
```javascript
// User wants to book Dec 1-3, 2024
const checkIn = 1733011200;  // Dec 1, 2024 timestamp
const checkOut = 1733270400; // Dec 3, 2024 timestamp

// Get or create sub-vault for these dates
const subVaultAddress = await factory.getOrCreateDateVault(
  "HOTEL-MIAMI-001", 
  checkIn, 
  checkOut
);

// Create reservation in the sub-vault
const subVault = new ethers.Contract(subVaultAddress, DigitalHouseVaultABI, signer);
await pyusd.approve(subVaultAddress, ethers.parseUnits("1000", 6));
await subVault.createReservation(
  ethers.parseUnits("1000", 6),
  checkIn,
  checkOut
);
```

### Checking Date Availability
```javascript
const isAvailable = await factory.isDateRangeAvailable(
  "HOTEL-MIAMI-001",
  1733875200,  // Dec 10, 2024
  1734134400   // Dec 12, 2024
);

console.log(isAvailable ? "✅ Available" : "❌ Booked");
```

---

## 🧪 Testing

The project includes comprehensive test suites:

```bash
# Run all tests (54 tests)
npm test

# Specific test suites
npm test -- --grep "Sub-Vault System"     # 16 tests
npm test -- --grep "Payment Distribution" # 3 tests
npm test -- --grep "Access Code"          # 19 tests
```

**Test Coverage:**
- ✅ Sub-vault creation and inheritance
- ✅ Date availability and booking conflicts
- ✅ Payment distribution scenarios
- ✅ Access code security and lifecycle
- ✅ Auction mechanics and cession
- ✅ Error handling and edge cases

---

## 🔒 Security Features

- **ReentrancyGuard**: Protection against reentrancy attacks
- **Access Control**: Ownable pattern for administrative functions
- **Input Validation**: Comprehensive parameter validation
- **Safe Transfers**: Secure PYUSD token transfers
- **Event Logging**: Complete audit trail
- **Date Validation**: Prevents invalid booking ranges

---

## 🛠️ Development

### Project Structure
```
contracts/
├── DigitalHouseFactory.sol      # Main factory contract
├── DigitalHouseVault.sol        # Individual vault logic
└── interfaces/                  # Contract interfaces

test/unit/
├── SubVaultSystem.test.ts       # Sub-vault functionality
├── PaymentDistribution.test.ts  # Payment logic
├── AccessCodeSecurity.test.ts   # Access code tests
└── ...

docs/diagrams/
├── digital-house-flow.mmd       # Main system flow
├── subvault-architecture.mmd    # Sub-vault architecture
└── README.md                    # Diagram documentation
```

### Tech Stack
- **Framework**: Hardhat 3.x
- **Language**: Solidity 0.8.20
- **Testing**: Mocha + Chai
- **Security**: OpenZeppelin 5.4.0
- **Token**: PYUSD (PayPal USD)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Repository**: [github.com/Ekinoxis-evm/auktrafi_contracts](https://github.com/Ekinoxis-evm/auktrafi_contracts)
- **Documentation**: [View Diagrams](docs/diagrams/)
- **Sepolia Explorer**: [View Contract](https://sepolia.etherscan.io/address/0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F#code)
- **Arbitrum Explorer**: [View Contract](https://sepolia.arbiscan.io/address/0xC3f3B1192E938A22a79149bbFc6d8218B1bC0117#code)

---

<div align="center">

**⭐ If you find this project useful, please give it a star! ⭐**

Made with ❤️ by the Auktrafi Team

</div>