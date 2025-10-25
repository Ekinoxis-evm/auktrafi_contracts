import { expect } from "chai";
import { ethers } from "hardhat";
import { DigitalHouseFactory, DigitalHouseVault } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Daily Sub-Vault System", function () {
  let factory: DigitalHouseFactory;
  let mockPYUSD: any;
  let owner: SignerWithAddress;
  let realEstate: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const MOCK_DIGITALHOUSE = "0x0000000000000000000000000000000000000003";
  const PARENT_VAULT_ID = "BEACH-HOUSE-001";
  const DAILY_BASE_PRICE = ethers.parseUnits("100", 6); // 100 PYUSD per day
  const MASTER_ACCESS_CODE = "BEACH123";

  let currentTimestamp: number;

  beforeEach(async function () {
    [owner, realEstate, user1, user2] = await ethers.getSigners();

    // Deploy Mock PYUSD
    const MockPYUSDFactory = await ethers.getContractFactory("MockPYUSD");
    mockPYUSD = await MockPYUSDFactory.deploy();
    
    // Mint tokens to users for testing
    await mockPYUSD.mint(user1.address, ethers.parseUnits("10000", 6));
    await mockPYUSD.mint(user2.address, ethers.parseUnits("10000", 6));

    // Deploy Factory
    const FactoryFactory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await FactoryFactory.deploy(await mockPYUSD.getAddress(), MOCK_DIGITALHOUSE);

    // Get current timestamp for consistent date calculations
    const latestBlock = await ethers.provider.getBlock("latest");
    currentTimestamp = latestBlock!.timestamp;

    // Create parent vault
    await factory.createVault(
      PARENT_VAULT_ID,
      "Beautiful beach house in Miami",
      DAILY_BASE_PRICE,
      realEstate.address,
      MASTER_ACCESS_CODE
    );
  });

  describe("Daily Sub-Vault Creation", function () {
    it("Should create a daily sub-vault for a specific day", async function () {
      const dayTimestamp = currentTimestamp + 86400; // Tomorrow

      const tx = await factory.getOrCreateDailyVault(
        PARENT_VAULT_ID,
        dayTimestamp,
        MASTER_ACCESS_CODE
      );

      await expect(tx)
        .to.emit(factory, "DailyVaultCreated");

      // Verify sub-vault was created
      const subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);
      expect(subVaultAddress).to.not.equal(ethers.ZeroAddress);

      // Verify sub-vault info
      const dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults.length).to.equal(1);
      expect(dailySubVaults[0].date).to.equal(dayTimestamp);
      expect(dailySubVaults[0].dailyPrice).to.equal(DAILY_BASE_PRICE);
      expect(dailySubVaults[0].currentState).to.equal(0); // VaultState.FREE
    });

    it("Should return existing sub-vault if already created", async function () {
      const dayTimestamp = currentTimestamp + 86400;

      // Create first time
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      const firstAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);

      // Call again - should return same address
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      const secondAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);

      expect(firstAddress).to.equal(secondAddress);

      // Should still have only 1 sub-vault
      const dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults.length).to.equal(1);
    });

    it("Should create multiple daily sub-vaults for different days", async function () {
      const day1 = currentTimestamp + 86400; // Tomorrow
      const day2 = currentTimestamp + 172800; // Day after tomorrow
      const day3 = currentTimestamp + 259200; // 3 days from now

      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, day1, MASTER_ACCESS_CODE);
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, day2, MASTER_ACCESS_CODE);
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, day3, MASTER_ACCESS_CODE);

      const dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults.length).to.equal(3);

      // Verify each day has different sub-vault
      const addr1 = await factory.getDailySubVault(PARENT_VAULT_ID, day1);
      const addr2 = await factory.getDailySubVault(PARENT_VAULT_ID, day2);
      const addr3 = await factory.getDailySubVault(PARENT_VAULT_ID, day3);

      expect(addr1).to.not.equal(addr2);
      expect(addr2).to.not.equal(addr3);
      expect(addr1).to.not.equal(addr3);
    });

    it("Should reject past dates", async function () {
      const pastTimestamp = currentTimestamp - 86400; // Yesterday

      await expect(
        factory.getOrCreateDailyVault(PARENT_VAULT_ID, pastTimestamp, MASTER_ACCESS_CODE)
      ).to.be.revertedWith("Cannot create vault for past dates");
    });

    it("Should reject invalid parent vault", async function () {
      const dayTimestamp = currentTimestamp + 86400;

      await expect(
        factory.getOrCreateDailyVault("NON-EXISTENT", dayTimestamp, MASTER_ACCESS_CODE)
      ).to.be.revertedWith("Parent vault not active");
    });
  });

  describe("Multi-Day Reservation Creation", function () {
    it("Should create multiple sub-vaults for a date range", async function () {
      const day1 = currentTimestamp + 86400;
      const day2 = currentTimestamp + 172800;
      const day3 = currentTimestamp + 259200;
      const dayTimestamps = [day1, day2, day3];

      const tx = await factory.createMultiDayReservation(
        PARENT_VAULT_ID,
        dayTimestamps,
        MASTER_ACCESS_CODE
      );

      // Should create 3 sub-vaults
      const dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults.length).to.equal(3);

      // Verify each day has a sub-vault
      for (const day of dayTimestamps) {
        const subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, day);
        expect(subVaultAddress).to.not.equal(ethers.ZeroAddress);
      }
    });

    it("Should handle mixed existing and new days", async function () {
      const day1 = currentTimestamp + 86400;
      const day2 = currentTimestamp + 172800;
      const day3 = currentTimestamp + 259200;

      // Pre-create day1
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, day1, MASTER_ACCESS_CODE);

      // Create multi-day reservation including existing day
      const dayTimestamps = [day1, day2, day3];
      await factory.createMultiDayReservation(PARENT_VAULT_ID, dayTimestamps, MASTER_ACCESS_CODE);

      // Should still have 3 sub-vaults total
      const dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults.length).to.equal(3);
    });

    it("Should reject empty day array", async function () {
      await expect(
        factory.createMultiDayReservation(PARENT_VAULT_ID, [], MASTER_ACCESS_CODE)
      ).to.be.revertedWith("No days specified");
    });

    it("Should reject too many days", async function () {
      const manyDays = Array.from({ length: 366 }, (_, i) => currentTimestamp + (i + 1) * 86400);

      await expect(
        factory.createMultiDayReservation(PARENT_VAULT_ID, manyDays, MASTER_ACCESS_CODE)
      ).to.be.revertedWith("Too many days");
    });
  });

  describe("Daily Sub-Vault Properties", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;

    beforeEach(async function () {
      const dayTimestamp = currentTimestamp + 86400;
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should inherit parent vault properties", async function () {
      const parentVaultInfo = await factory.getVaultInfo(PARENT_VAULT_ID);

      // Check inherited properties
      expect(await subVault.dailyBasePrice()).to.equal(DAILY_BASE_PRICE);
      expect(await subVault.realEstateAddress()).to.equal(realEstate.address);
      expect(await subVault.propertyDetails()).to.equal("Beautiful beach house in Miami");
      expect(await subVault.masterAccessCode()).to.equal(MASTER_ACCESS_CODE);
    });

    it("Should have unique sub-vault ID", async function () {
      const dayTimestamp = currentTimestamp + 86400;
      const expectedSubVaultId = `${PARENT_VAULT_ID}_day_${dayTimestamp}`;

      expect(await subVault.vaultId()).to.equal(expectedSubVaultId);
    });

    it("Should start in FREE state", async function () {
      expect(await subVault.currentState()).to.equal(0); // VaultState.FREE
    });

    it("Should have factory as owner", async function () {
      expect(await subVault.factoryAddress()).to.equal(await factory.getAddress());
    });
  });

  describe("State Synchronization", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;
    let dayTimestamp: number;

    beforeEach(async function () {
      dayTimestamp = currentTimestamp + 86400;
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should update factory state when sub-vault state changes", async function () {
      // Initially FREE
      let dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults[0].currentState).to.equal(0); // FREE

      // Create reservation to change state to AUCTION
      const stakeAmount = DAILY_BASE_PRICE;
      const checkInDate = dayTimestamp;
      const checkOutDate = dayTimestamp; // Same day for daily sub-vault

      // Approve PYUSD spending
      await mockPYUSD.connect(user1).approve(subVaultAddress, stakeAmount);

      await expect(
        subVault.connect(user1).createReservation(stakeAmount, checkInDate, checkOutDate)
      ).to.emit(factory, "DailySubVaultStateUpdated")
        .withArgs(PARENT_VAULT_ID, subVaultAddress, dayTimestamp, 1); // AUCTION

      // Verify state updated in factory
      dailySubVaults = await factory.getDailySubVaultsInfo(PARENT_VAULT_ID);
      expect(dailySubVaults[0].currentState).to.equal(1); // AUCTION
    });
  });

  describe("Parent-Child Relationship", function () {
    it("Should correctly map sub-vault to parent", async function () {
      const dayTimestamp = currentTimestamp + 86400;
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      const subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);

      const parentVaultId = await factory.subVaultToParent(subVaultAddress);
      expect(parentVaultId).to.equal(PARENT_VAULT_ID);
    });

    it("Should handle multiple parent vaults", async function () {
      const PARENT_VAULT_2 = "MOUNTAIN-CABIN-002";
      
      // Create second parent vault
      await factory.createVault(
        PARENT_VAULT_2,
        "Cozy mountain cabin",
        DAILY_BASE_PRICE,
        realEstate.address,
        "MOUNTAIN123"
      );

      const dayTimestamp = currentTimestamp + 86400;

      // Create sub-vaults for both parents on same day
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      await factory.getOrCreateDailyVault(PARENT_VAULT_2, dayTimestamp, "MOUNTAIN123");

      const subVault1 = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);
      const subVault2 = await factory.getDailySubVault(PARENT_VAULT_2, dayTimestamp);

      // Should be different sub-vaults
      expect(subVault1).to.not.equal(subVault2);

      // Should map to correct parents
      expect(await factory.subVaultToParent(subVault1)).to.equal(PARENT_VAULT_ID);
      expect(await factory.subVaultToParent(subVault2)).to.equal(PARENT_VAULT_2);
    });
  });

  describe("Daily Pricing Validation", function () {
    let subVaultAddress: string;
    let subVault: DigitalHouseVault;

    beforeEach(async function () {
      const dayTimestamp = currentTimestamp + 86400;
      await factory.getOrCreateDailyVault(PARENT_VAULT_ID, dayTimestamp, MASTER_ACCESS_CODE);
      subVaultAddress = await factory.getDailySubVault(PARENT_VAULT_ID, dayTimestamp);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should require stake >= daily base price", async function () {
      const checkInDate = currentTimestamp + 86400;
      const checkOutDate = currentTimestamp + 86400; // Same day
      const insufficientStake = DAILY_BASE_PRICE - 1n;

      await expect(
        subVault.connect(user1).createReservation(insufficientStake, checkInDate, checkOutDate)
      ).to.be.revertedWith("Stake below daily base price");
    });

    it("Should accept stake >= daily base price", async function () {
      const checkInDate = currentTimestamp + 86400;
      const checkOutDate = currentTimestamp + 86400; // Same day
      const validStake = DAILY_BASE_PRICE;

      // Approve PYUSD spending
      await mockPYUSD.connect(user1).approve(subVaultAddress, validStake);

      await expect(
        subVault.connect(user1).createReservation(validStake, checkInDate, checkOutDate)
      ).to.not.be.reverted;
    });

    it("Should allow higher stakes for premium bookings", async function () {
      const checkInDate = currentTimestamp + 86400;
      const checkOutDate = currentTimestamp + 86400; // Same day
      const premiumStake = DAILY_BASE_PRICE * 2n; // 2x daily price

      // Approve PYUSD spending
      await mockPYUSD.connect(user1).approve(subVaultAddress, premiumStake);

      await expect(
        subVault.connect(user1).createReservation(premiumStake, checkInDate, checkOutDate)
      ).to.not.be.reverted;

      const reservation = await subVault.getCurrentReservation();
      expect(reservation.stakeAmount).to.equal(premiumStake);
    });
  });
});
