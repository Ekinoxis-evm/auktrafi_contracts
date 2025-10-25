# Auktrafi - Decentralized Property Booking Platform 🏨

A blockchain-based booking platform that enables property owners to tokenize their real estate and manage night-by-night reservations with competitive auction-based pricing.

---

## 🎯 The Problem We Solve

Traditional booking platforms have several issues:
- **High Platform Fees**: 15-20% commission on every booking
- **Centralized Control**: Platforms can change rules, freeze accounts, or block properties
- **No Price Discovery**: Fixed pricing doesn't reflect real market demand
- **Payment Delays**: Owners wait weeks to receive their money
- **Limited Transparency**: Hidden fees and unclear payment distribution

## 💡 Our Solution

Auktrafi uses blockchain technology to create a **decentralized, transparent, and fair booking system**:

✅ **Zero Platform Fees** - Only 5% goes to platform maintenance, 95% to property owners  
✅ **Auction-Based Pricing** - Market determines fair prices through competitive bidding  
✅ **Instant Payments** - PYUSD stablecoin payments settled immediately on-chain  
✅ **Full Transparency** - All transactions and rules visible on blockchain  
✅ **Owner Control** - You control availability, pricing, and access codes  
✅ **Night-by-Night Flexibility** - Book individual nights, not just full weeks  

---

## 🌟 Key Features

### For Property Owners
- 🏠 **Tokenize Properties** - Create vaults representing your real estate
- 💰 **Set Nightly Rates** - Define base price per night
- 📅 **Manage Availability** - Block or open specific nights
- 💵 **Withdraw Earnings** - Direct PYUSD payments to your wallet
- 🔐 **Master Access Codes** - Set and update property access codes
- 📊 **Track Revenue** - Real-time earnings dashboard

### For Guests
- 🗓️ **Visual Calendar** - See availability by night with color-coded states
- 💸 **Competitive Pricing** - Bid on popular dates or book instantly
- 🎯 **Flexible Booking** - Reserve single nights or multiple consecutive nights
- 🔑 **Digital Access** - Receive access codes after check-in
- 💳 **PYUSD Payments** - Stable, predictable pricing in USD

---

## 🏗️ How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  DigitalHouseFactory                        │
│  - Creates parent vaults (properties)                       │
│  - Manages night availability                               │
│  - Tracks all bookings across platform                      │
│  - Uses EIP-1167 Clone Pattern for gas efficiency          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Parent Vault (Your Property)                   │
│  - Owner: Property owner's wallet                           │
│  - Treasury: Collects all booking payments                  │
│  - Nightly Rate: Base price per night                       │
│  - Master Code: Property access code                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           Night Sub-Vaults (Individual Bookings)            │
│  - One sub-vault per night (Night 1, 2, 3...)              │
│  - States: FREE → AUCTION → SETTLED                         │
│  - Routes payments to parent vault treasury                 │
│  - Handles reservations and competitive bidding            │
└─────────────────────────────────────────────────────────────┘
```

### Booking Flow

```
1. Owner Creates Vault
   └─> Sets nightly rate ($100 PYUSD)
   └─> Defines master access code
   └─> Opens specific nights for booking

2. Guest Selects Nights
   └─> Views calendar (Night 15, 16, 17)
   └─> Sees total: $300 PYUSD (3 nights × $100)

3. First Booking (Instant)
   └─> Guest approves PYUSD
   └─> Creates reservation
   └─> State: FREE → AUCTION

4. Competitive Bidding (Optional)
   └─> Other guests can bid higher
   └─> Original booker can cede to highest bidder
   └─> Bidder pays difference, original gets stake back

5. Check-In Day
   └─> Guest performs check-in transaction
   └─> Receives master access code
   └─> Payment distributed:
       • 95% to property owner
       • 5% to platform
       • If auction: additional value split 40/30/20/10

6. Check-Out
   └─> Guest checks out
   └─> Night becomes available again
```

---

## 🌐 Deployed Contracts

> **Note**: Uses **EIP-1167 Minimal Proxy (Clone) Pattern** for gas-efficient deployment

### ✅ Ethereum Sepolia
- **Vault Implementation**: [`0x847Fc56F9B339db4f977e3cC553f2159A3018F99`](https://sepolia.etherscan.io/address/0x847Fc56F9B339db4f977e3cC553f2159A3018F99#code)
- **Factory**: [`0x2B7399bce5fCa0715d98D0aD3FD4661AA261fD6E`](https://sepolia.etherscan.io/address/0x2B7399bce5fCa0715d98D0aD3FD4661AA261fD6E#code)
- **PYUSD**: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
- **Chain ID**: `11155111`
- **Status**: ✅ Deployed & Verified

### ✅ Arbitrum Sepolia
- **Vault Implementation**: [`0x6BB856e23f60CeBda2360ba9E1559249535b98f0`](https://sepolia.arbiscan.io/address/0x6BB856e23f60CeBda2360ba9E1559249535b98f0#code)
- **Factory**: [`0x3d948AEE9A3eC7760e05A09797691079dE6B4E59`](https://sepolia.arbiscan.io/address/0x3d948AEE9A3eC7760e05A09797691079dE6B4E59#code)
- **PYUSD**: `0x637A1259C6afd7E3AdF63993cA7E58BB438aB1B1`
- **Chain ID**: `421614`
- **Status**: ✅ Deployed & Verified

---

## 🚀 Quick Start

> **Note**: This project follows [Hardhat 3 best practices](https://hardhat.org/docs) using `npx hardhat` commands directly.

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
# Add your private key and API keys to .env
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Run Tests
```bash
npx hardhat test                                    # All tests (60+ passing)
npx hardhat test test/unit/NightBookingSystem.test.ts  # Night booking tests
npx hardhat test test/unit/PaymentDistribution.test.ts # Payment tests
```

### 5. Deploy to Testnet

**Method A: Custom Deploy Script (Recommended)**
```bash
# Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Arbitrum Sepolia  
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

**Method B: Hardhat Ignition** 
```bash
# Sepolia
npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network sepolia

# Arbitrum Sepolia
npx hardhat ignition deploy ignition/modules/DigitalHouseFactory.ts --network arbitrumSepolia
```

### 6. Verify Contracts

**Vault Implementation (no constructor args):**
```bash
npx hardhat verify --network sepolia 0xYourVaultImplementationAddress
```

**Factory (with constructor args):**
```bash
npx hardhat verify --network sepolia 0xYourFactoryAddress \
  "0xPYUSDAddress" \
  "0xDigitalHouseMultisig" \
  "0xVaultImplementationAddress"
```

### 7. Update ABIs
```bash
npx hardhat run scripts/update-abis.ts
```

---

## ⚡ Clone Pattern Benefits

This project implements **EIP-1167 Minimal Proxy Pattern** for maximum efficiency:

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| **Factory Size** | 25,699 bytes | ~8,000 bytes | 67% ↓ |
| **Each Vault** | ~20,000 bytes | ~55 bytes | 99.7% ↓ |
| **Gas per Vault** | ~2.5M gas | ~45K gas | 98% ↓ |

**How it works:**
1. Deploy one `DigitalHouseVault` implementation per network
2. Factory creates cheap clones (proxies) that delegate to implementation
3. Each clone is initialized with specific vault data
4. Full functionality preserved - clones behave identically to full contracts

---

## 📁 Project Structure

```
digitalhouse_contracts/
├── contracts/
│   ├── DigitalHouseFactory.sol       # Main factory (creates vaults)
│   ├── DigitalHouseVault.sol         # Vault implementation
│   ├── interfaces/
│   │   ├── IDigitalHouseFactory.sol
│   │   └── IDigitalHouseVault.sol
│   └── mockerc20.sol                 # For testing
├── scripts/
│   ├── deploy.ts                     # Two-step deployment
│   ├── update-abis.ts                # Export ABIs
│   └── update-verification-status.ts # Update verification flags
├── test/unit/
│   ├── NightBookingSystem.test.ts    # Core booking tests
│   ├── PaymentDistribution.test.ts   # Payment logic tests
│   ├── ParentVaultTreasury.test.ts   # Treasury tests
│   ├── DigitalHouseFactory.test.ts   # Factory tests
│   ├── DigitalHouse.test.ts          # Integration tests
│   └── AccessCodeSecurity.test.ts    # Security tests
├── deployments/
│   ├── abis/                         # Contract ABIs
│   │   ├── DigitalHouseFactory.json
│   │   └── DigitalHouseVault.json
│   └── addresses/                    # Deployed addresses
│       ├── sepolia.json
│       └── arbitrumSepolia.json
├── ignition/modules/
│   └── DigitalHouseFactory.ts        # Ignition deployment module
├── hardhat.config.ts                 # Hardhat configuration
├── package.json
└── README.md
```

---

## 🧪 Testing

Comprehensive test suite with **60+ tests passing**:

```bash
npx hardhat test
```

**Test Coverage:**
- ✅ Night-by-night booking system
- ✅ Availability management (owner controls)
- ✅ Sub-vault creation and lifecycle
- ✅ Parent vault treasury (centralized payments)
- ✅ Payment distribution (95/5 split + auction bonuses)
- ✅ Access code generation and security
- ✅ Auction bidding and cession
- ✅ Check-in/check-out flows
- ✅ State synchronization
- ✅ Edge cases and error handling

---

## 💰 Payment Distribution

### Base Price (No Auction)
When a guest books at base price:
- **95%** → Property owner (parent vault treasury)
- **5%** → Platform (Auktrafi)

### With Auction (Competitive Bidding)
When final price exceeds base price, the **additional value** is split:
- **40%** → Current booker (who checks in)
- **30%** → Last booker (who ceded the reservation)
- **20%** → Property owner
- **10%** → Platform (Auktrafi)

**Example:**
```
Base Price: $100/night
Final Bid: $150/night
Additional Value: $50

Distribution:
- Property Owner: $95 (base) + $10 (20% of $50) = $105
- Current Booker: $20 (40% of $50)
- Last Booker: $15 (30% of $50)
- Platform: $5 (base) + $5 (10% of $50) = $10
```

---

## 🔐 Security Features

- **Ownable Pattern** - Only property owners can manage their vaults
- **ReentrancyGuard** - Protection against reentrancy attacks
- **Access Control** - Master codes visible only to owner and current guest
- **State Machine** - Strict state transitions (FREE → AUCTION → SETTLED)
- **PYUSD Payments** - Stablecoin eliminates volatility risk
- **On-chain Verification** - All bookings immutably recorded

---

## 🛠️ Technology Stack

- **Smart Contracts**: Solidity 0.8.20
- **Development**: Hardhat 3
- **Testing**: Hardhat + Ethers.js v6
- **Libraries**: OpenZeppelin (Ownable, ReentrancyGuard, Clones)
- **Token**: PYUSD (PayPal USD Stablecoin)
- **Networks**: Ethereum Sepolia, Arbitrum Sepolia

---

## 📊 Key Metrics

- **Factory Contract**: ~8KB (within 24KB limit)
- **Vault Clones**: ~55 bytes each
- **Gas per Booking**: ~200K gas
- **Gas per Vault Creation**: ~45K gas
- **Test Coverage**: 60+ tests passing
- **Networks Deployed**: 2 (Sepolia, Arbitrum Sepolia)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Before submitting:**
- ✅ Run tests: `npx hardhat test`
- ✅ Check compilation: `npx hardhat compile`
- ✅ Update documentation if needed

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Links

- **Frontend Repository**: [digitalhouse-frontend](https://github.com/your-org/digitalhouse-frontend)
- **Sepolia Explorer**: https://sepolia.etherscan.io
- **Arbitrum Sepolia Explorer**: https://sepolia.arbiscan.io
- **PYUSD Documentation**: https://paxos.com/pyusd
- **Hardhat Documentation**: https://hardhat.org/docs

---

## 📞 Support

For questions or issues:
- Open an issue on GitHub
- Contact: your-email@example.com
- Discord: [Your Discord Server]

---

Built with ❤️ using Hardhat, Solidity, and PYUSD
