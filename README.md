# Auktrafi - Decentralized Property Booking Platform

A blockchain-based booking platform enabling property owners to tokenize real estate and manage night-by-night reservations with competitive auction-based pricing.

## Overview

Auktrafi solves traditional booking platform issues (high fees, centralized control, payment delays) by providing:

- **Decentralized ownership** - Property owners maintain full control
- **Auction-based pricing** - Market-driven price discovery
- **Instant PYUSD payments** - Immediate settlement on-chain
- **Night-by-night flexibility** - Individual night bookings
- **95/5 revenue split** - Fair distribution to property owners

## Architecture

**Three-tier system using EIP-1167 Clone Pattern:**

1. **DigitalHouseFactory** - Creates and manages all property vaults
2. **Parent Vaults** - Represent individual properties, collect payments
3. **Night Sub-Vaults** - Handle individual night bookings and auctions

**Booking Flow:**
1. Owner creates vault with nightly rate and access code
2. Guest books available nights (FREE → AUCTION state)
3. Optional competitive bidding from other guests
4. Check-in triggers payment distribution and access code release
5. Check-out returns night to available state

## Deployed Contracts

**Ethereum Sepolia** (Chain ID: 11155111)
- Factory: [`0x2B7399bce5fCa0715d98D0aD3FD4661AA261fD6E`](https://sepolia.etherscan.io/address/0x2B7399bce5fCa0715d98D0aD3FD4661AA261fD6E#code)
- Vault Implementation: [`0x847Fc56F9B339db4f977e3cC553f2159A3018F99`](https://sepolia.etherscan.io/address/0x847Fc56F9B339db4f977e3cC553f2159A3018F99#code)

**Arbitrum Sepolia** (Chain ID: 421614)  
- Factory: [`0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F`](https://sepolia.arbiscan.io/address/0xBdB8AcD5c9feA0C7bC5D3ec5F99E2C198526a58F#code)

## Development Setup

Built with **Hardhat v3** following modern best practices:

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run comprehensive test suite (60+ tests)
npx hardhat test

# Deploy to testnets
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/deploy.ts --network arbitrumSepolia

# Update ABIs and export to frontend
npm run update-all
```

## Technical Implementation

**EIP-1167 Clone Pattern** for gas efficiency:
- Factory contract: ~8KB (within 24KB limit)
- Each vault clone: ~55 bytes (99.7% gas savings)
- Deployment cost: ~45K gas per vault (vs 2.5M for full contracts)

**Technology Stack:**
- Solidity 0.8.20 with OpenZeppelin libraries
- Hardhat v3 development environment
- Comprehensive test coverage (60+ tests)
- PYUSD stablecoin integration
- Multi-network deployment (Ethereum & Arbitrum Sepolia)

**Security Features:**
- Ownable pattern for access control
- ReentrancyGuard protection
- State machine validation (FREE → AUCTION → SETTLED)
- On-chain verification of all transactions

## Payment Distribution

**Base Booking (95/5 split):**
- 95% → Property owner
- 5% → Platform

**Auction Premium (when final price > base price):**
- 40% → Current booker
- 30% → Previous booker  
- 20% → Property owner
- 10% → Platform

## Project Structure

```
contracts/
├── DigitalHouseFactory.sol      # Main factory contract
├── DigitalHouseVault.sol        # Vault implementation
└── interfaces/                  # Contract interfaces

scripts/
├── deploy.ts                    # Hardhat v3 deployment
├── update-deployments.ts        # ABI/address management
└── export-to-frontend.ts        # Frontend integration

test/unit/                       # Comprehensive test suite
├── NightBookingSystem.test.ts
├── PaymentDistribution.test.ts
└── [4 additional test files]

deployments/
├── abis/                        # Pure contract ABIs
└── addresses.json               # All network addresses
```

---

**Built with Hardhat v3, Solidity 0.8.20, and PYUSD**
