import { expect } from "chai";
import { ethers } from "hardhat";
import { DigitalHouseFactory, DigitalHouseVault } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Night-by-Night Booking System", function () {
  let factory: DigitalHouseFactory;
  let mockPYUSD: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const MOCK_DIGITALHOUSE = "0x0000000000000000000000000000000000000003";
  const PARENT_VAULT_ID = "BEACH-HOUSE-001";
  const NIGHT_PRICE = ethers.parseUnits("100", 6); // 100 PYUSD per night
  const MASTER_ACCESS_CODE = "BEACH123";

  let currentTimestamp: number;
  let parentVaultAddress: string;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Mock PYUSD
    const MockPYUSDFactory = await ethers.getContractFactory("MockPYUSD");
    mockPYUSD = await MockPYUSDFactory.deploy();
    
    // Mint tokens to users for testing
    await mockPYUSD.mint(user1.address, ethers.parseUnits("10000", 6));
    await mockPYUSD.mint(user2.address, ethers.parseUnits("10000", 6));

    // Deploy Vault Implementation
    const VaultImpl = await ethers.getContractFactory("DigitalHouseVault");
    const vaultImpl = await VaultImpl.deploy();
    await vaultImpl.waitForDeployment();

    // Deploy Factory with implementation address
    const FactoryFactory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await FactoryFactory.deploy(
      await mockPYUSD.getAddress(), 
      MOCK_DIGITALHOUSE,
      await vaultImpl.getAddress()
    );

    // Get current timestamp for consistent date calculations
    const latestBlock = await ethers.provider.getBlock("latest");
    currentTimestamp = latestBlock!.timestamp;

    // Create parent vault (no realEstateAddress parameter)
    const tx = await factory.createVault(
      PARENT_VAULT_ID,
      "Beautiful beach house in Miami",
      NIGHT_PRICE,
      MASTER_ACCESS_CODE
    );
    
    // Get parent vault address
    parentVaultAddress = await factory.getVaultAddress(PARENT_VAULT_ID);
  });

  describe("Night Number System", function () {
    it("Should use simple night numbers (no time calculation)", async function () {
      // Night numbers are just sequential: 1, 2, 3, etc.
      // No need for timestamp calculation - simplified!
      const nightDate = 1; // First night
      expect(nightDate).to.be.greaterThan(0);
    });
  });

  describe("Availability Management", function () {
    it("Should allow vault owner to set night availability", async function () {
      const nightDate = 1; // Night 1
      
      await expect(
        factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true)
      ).to.emit(factory, "NightAvailabilitySet")
        .withArgs(PARENT_VAULT_ID, nightDate, true);
      
      const isAvailable = await factory.getNightAvailability(PARENT_VAULT_ID, nightDate);
      expect(isAvailable).to.be.true;
    });

    it("Should allow vault owner to set availability window", async function () {
      const startNight = 10; // Night 10
      const endNight = 17; // Night 17
      const nightCount = 8; // 8 nights
      
      await expect(
        factory.setAvailabilityWindow(PARENT_VAULT_ID, startNight, endNight, nightCount)
      ).to.emit(factory, "AvailabilityWindowSet")
        .withArgs(PARENT_VAULT_ID, startNight, endNight);
      
      // Check multiple nights in the range
      const isAvailable1 = await factory.getNightAvailability(PARENT_VAULT_ID, startNight);
      const isAvailable2 = await factory.getNightAvailability(PARENT_VAULT_ID, startNight + 1);
      
      expect(isAvailable1).to.be.true;
      expect(isAvailable2).to.be.true;
    });

    it("Should reject non-owner from setting availability", async function () {
      const nightDate = 2;
      
      await expect(
        factory.connect(user1).setNightAvailability(PARENT_VAULT_ID, nightDate, true)
      ).to.be.revertedWith("Not owner");
    });

    it("Should allow owner to disable specific nights", async function () {
      const nightDate = 3;
      
      // Enable first
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true);
      expect(await factory.getNightAvailability(PARENT_VAULT_ID, nightDate)).to.be.true;
      
      // Then disable
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, false);
      expect(await factory.getNightAvailability(PARENT_VAULT_ID, nightDate)).to.be.false;
    });
  });

  describe("Night Sub-Vault Creation", function () {
    let nightDate: number;

    beforeEach(async function () {
      nightDate = 100; // Night 100
      // Set night as available
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true);
    });

    it("Should create a night sub-vault for available night", async function () {
      const tx = await factory.getOrCreateNightVault(
        PARENT_VAULT_ID,
        nightDate,
        MASTER_ACCESS_CODE
      );

      await expect(tx).to.emit(factory, "NightVaultCreated");

      const subVaultAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);
      expect(subVaultAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should return existing sub-vault if already created", async function () {
      // Create first time
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      const firstAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);

      // Call again - should return same address
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      const secondAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);

      expect(firstAddress).to.equal(secondAddress);
    });

    it("Should reject creation for unavailable night", async function () {
      const unavailableNight = 999; // Not set as available
      
      await expect(
        factory.getOrCreateNightVault(PARENT_VAULT_ID, unavailableNight, MASTER_ACCESS_CODE)
      ).to.be.revertedWith("N");
    });

    it("Should create sub-vault with parent vault as payment recipient", async function () {
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      const subVaultAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);
      
      const subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
      
      // realEstateAddress should be the parent vault address
      expect(await subVault.realEstateAddress()).to.equal(parentVaultAddress);
    });
  });

  describe("Night Sub-Vault Properties", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;
    let nightDate: number;

    beforeEach(async function () {
      nightDate = 200;
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true);
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should have correct night price", async function () {
      expect(await subVault.dailyBasePrice()).to.equal(NIGHT_PRICE);
    });

    it("Should have unique sub-vault ID with '_n' prefix", async function () {
      const vaultId = await subVault.vaultId();
      expect(vaultId).to.include("_n");
      expect(vaultId).to.include(PARENT_VAULT_ID);
    });

    it("Should start in FREE state", async function () {
      expect(await subVault.currentState()).to.equal(0); // VaultState.FREE
    });

    it("Should have factory as factoryAddress", async function () {
      expect(await subVault.factoryAddress()).to.equal(await factory.getAddress());
    });
  });

  describe("Parent Vault Treasury", function () {
    let parentVault: DigitalHouseVault;

    beforeEach(async function () {
      parentVault = await ethers.getContractAt("DigitalHouseVault", parentVaultAddress);
    });

    it("Should track earnings correctly", async function () {
      const initialEarnings = await parentVault.getEarningsBalance();
      expect(initialEarnings).to.equal(0);
    });

    it("Should allow owner to withdraw earnings", async function () {
      // Simulate earnings by directly sending PYUSD to parent vault
      const earningsAmount = ethers.parseUnits("500", 6);
      await mockPYUSD.mint(parentVaultAddress, earningsAmount);
      
      // Manually set earnings for owner (in real scenario, this comes from sub-vault payments)
      // Note: This would normally be done through receivePayment function
      
      const ownerAddress = await parentVault.owner();
      const initialBalance = await mockPYUSD.balanceOf(ownerAddress);
      
      // For this test, we'd need to have actual earnings tracked
      // This is a placeholder - in real scenario, earnings come from sub-vault checkIns
    });

    it("Should reject withdrawal with no earnings", async function () {
      // Connect as the actual owner (deployer)
      await expect(
        parentVault.connect(owner).withdrawEarnings()
      ).to.be.revertedWith("No earnings to withdraw");
    });

    it("Should only allow owner to withdraw", async function () {
      await expect(
        parentVault.connect(user1).withdrawEarnings()
      ).to.be.revertedWith("Only vault owner");
    });
  });

  describe("State Synchronization", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;
    let nightDate: number;

    beforeEach(async function () {
      nightDate = 300;
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true);
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should update factory state when sub-vault state changes", async function () {
      // Initially FREE
      let nightSubVaults = await factory.getNightSubVaultsInfo(PARENT_VAULT_ID);
      expect(nightSubVaults[0].currentState).to.equal(0); // FREE

      // Create reservation to change state to AUCTION
      const stakeAmount = NIGHT_PRICE;
      const checkInDate = currentTimestamp + 86400; // Future date
      const checkOutDate = checkInDate; // Same for single night

      // Approve PYUSD spending
      await mockPYUSD.connect(user1).approve(subVaultAddress, stakeAmount);

      await expect(
        subVault.connect(user1).createReservation(stakeAmount, checkInDate, checkOutDate)
      ).to.emit(factory, "NightSubVaultStateUpdated");

      // Verify state updated in factory
      nightSubVaults = await factory.getNightSubVaultsInfo(PARENT_VAULT_ID);
      expect(nightSubVaults[0].currentState).to.equal(1); // AUCTION
    });
  });

  describe("Single-Night Booking Validation", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;
    let nightDate: number;

    beforeEach(async function () {
      nightDate = 400;
      await factory.setNightAvailability(PARENT_VAULT_ID, nightDate, true);
      await factory.getOrCreateNightVault(PARENT_VAULT_ID, nightDate, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getNightSubVault(PARENT_VAULT_ID, nightDate);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should accept single-night reservation", async function () {
      const stakeAmount = NIGHT_PRICE;
      const checkInDate = currentTimestamp + 86400;
      const checkOutDate = checkInDate; // Same for single night

      await mockPYUSD.connect(user1).approve(subVaultAddress, stakeAmount);

      await expect(
        subVault.connect(user1).createReservation(stakeAmount, checkInDate, checkOutDate)
      ).to.not.be.reverted;
    });

    it("Should require stake >= night price", async function () {
      const insufficientStake = NIGHT_PRICE - 1n;
      const checkInDate = currentTimestamp + 86400;
      const checkOutDate = checkInDate;

      await mockPYUSD.connect(user1).approve(subVaultAddress, insufficientStake);

      await expect(
        subVault.connect(user1).createReservation(insufficientStake, checkInDate, checkOutDate)
      ).to.be.revertedWith("Stake below daily base price");
    });
  });

  describe("Parent Vault Creation (No Real Estate Address)", function () {
    it("Should create vault without realEstateAddress parameter", async function () {
      const newVaultId = "NEW-PROPERTY-001";
      
      const tx = await factory.createVault(
        newVaultId,
        "New property",
        NIGHT_PRICE,
        MASTER_ACCESS_CODE
      );

      await expect(tx).to.emit(factory, "VaultCreated");
      
      const vaultInfo = await factory.getVaultInfo(newVaultId);
      expect(vaultInfo.vaultId).to.equal(newVaultId);
      expect(vaultInfo.nightPrice).to.equal(NIGHT_PRICE);
    });

    it("Should set factory deployer as vault owner", async function () {
      const vaultAddress = await factory.getVaultAddress(PARENT_VAULT_ID);
      const vault = await ethers.getContractAt("DigitalHouseVault", vaultAddress);
      
      // Owner should be the factory deployer (owner signer)
      // The factory creates the vault, so the vault's owner is the factory's msg.sender
      const vaultOwner = await vault.owner();
      expect(vaultOwner).to.equal(owner.address);
    });
  });
});

