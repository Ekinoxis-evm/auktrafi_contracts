import { expect } from "chai";
import { ethers } from "hardhat";

describe("🏨 Sub-Vault System Tests", function () {
  const PYUSD_DECIMALS = 6;
  const BASE_PRICE = ethers.parseUnits("1000", PYUSD_DECIMALS);

  let pyusd: any;
  let factory: any;
  let parentVault: any;
  let deployer: any, hotel: any, userA: any, userB: any, userC: any;
  const DH_WALLET = "0x854b298d922fDa553885EdeD14a84eb088355822";
  const PARENT_VAULT_ID = "HOTEL-MIAMI-001";

  beforeEach(async () => {
    [deployer, hotel, userA, userB, userC] = await ethers.getSigners();

    // Mock PYUSD (ERC20)
    const ERC20 = await ethers.getContractFactory("MockERC20");
    pyusd = await ERC20.deploy("PYUSD", "PYUSD", PYUSD_DECIMALS);
    await pyusd.waitForDeployment();

    // Mint tokens to test users
    for (const u of [hotel, userA, userB, userC]) {
      await pyusd.mint(await u.getAddress(), ethers.parseUnits("50000", PYUSD_DECIMALS));
    }

    // Deploy Factory
    const Factory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await Factory.deploy(await pyusd.getAddress(), DH_WALLET);
    await factory.waitForDeployment();

    // Create Parent Vault
    const tx = await factory.createVault(
      PARENT_VAULT_ID,
      '{"city":"Miami","property":"Luxury Hotel","rooms":50}',
      BASE_PRICE,
      await hotel.getAddress(),
      "MIAMI2024" // Master access code
    );
    const receipt = await tx.wait();
    const evt = receipt.logs.find((l: any) => l.fragment.name === "VaultCreated");
    const parentVaultAddr = evt.args.vaultAddress;

    parentVault = await ethers.getContractAt("DigitalHouseVault", parentVaultAddr);
  });

  describe("Sub-Vault Creation", function () {
    it("Should create sub-vault for specific dates", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 7; // 7 days from now
      const checkOut = checkIn + 86400 * 3; // 3 days stay

      // Create sub-vault
      await expect(factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut))
        .to.emit(factory, "DateVaultCreated");

      // Get the created sub-vault address
      const subVaultAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      expect(subVaultAddress).to.not.eq(ethers.ZeroAddress);
    });

    it("Should return existing sub-vault if dates already exist", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      // Create sub-vault first time
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      const firstAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);

      // Try to create again - should return same address
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      const secondAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);

      expect(firstAddress).to.eq(secondAddress);
    });

    it("Should inherit parent vault properties", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      // Create sub-vault
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      const subVaultAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      
      const subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);

      // Verify inherited properties
      expect(await subVault.basePrice()).to.eq(BASE_PRICE);
      expect(await subVault.realEstateAddress()).to.eq(await hotel.getAddress());
      expect(await subVault.masterAccessCode()).to.eq("MIAMI2024");
      
      const propertyDetails = await subVault.propertyDetails();
      expect(propertyDetails).to.include("Miami");
      expect(propertyDetails).to.include("Luxury Hotel");
    });

    it("Should generate unique sub-vault IDs", async function () {
      const checkIn1 = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut1 = checkIn1 + 86400 * 3;
      
      const checkIn2 = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 14;
      const checkOut2 = checkIn2 + 86400 * 2;

      // Create two sub-vaults
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn1, checkOut1);
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn2, checkOut2);

      const subVault1Address = await factory.getDateVault(PARENT_VAULT_ID, checkIn1, checkOut1);
      const subVault2Address = await factory.getDateVault(PARENT_VAULT_ID, checkIn2, checkOut2);

      expect(subVault1Address).to.not.eq(subVault2Address);

      // Verify different vault IDs
      const subVault1 = await ethers.getContractAt("DigitalHouseVault", subVault1Address);
      const subVault2 = await ethers.getContractAt("DigitalHouseVault", subVault2Address);

      const vaultId1 = await subVault1.vaultId();
      const vaultId2 = await subVault2.vaultId();

      expect(vaultId1).to.not.eq(vaultId2);
      expect(vaultId1).to.include(PARENT_VAULT_ID);
      expect(vaultId2).to.include(PARENT_VAULT_ID);
    });
  });

  describe("Date Availability", function () {
    it("Should check date availability correctly", async function () {
      const checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      // Initially available
      expect(await factory.isDateRangeAvailable(PARENT_VAULT_ID, checkIn, checkOut)).to.be.true;

      // Create sub-vault (should mark as unavailable)
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      
      // Should still be available (sub-vault exists but no reservation yet)
      expect(await factory.isDateRangeAvailable(PARENT_VAULT_ID, checkIn, checkOut)).to.be.false;
    });

    it("Should allow different date ranges simultaneously", async function () {
      const checkIn1 = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut1 = checkIn1 + 86400 * 3;
      
      const checkIn2 = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 14;
      const checkOut2 = checkIn2 + 86400 * 2;

      // Both should be available initially
      expect(await factory.isDateRangeAvailable(PARENT_VAULT_ID, checkIn1, checkOut1)).to.be.true;
      expect(await factory.isDateRangeAvailable(PARENT_VAULT_ID, checkIn2, checkOut2)).to.be.true;

      // Create both sub-vaults
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn1, checkOut1);
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn2, checkOut2);

      // Both should have sub-vaults
      const subVault1 = await factory.getDateVault(PARENT_VAULT_ID, checkIn1, checkOut1);
      const subVault2 = await factory.getDateVault(PARENT_VAULT_ID, checkIn2, checkOut2);

      expect(subVault1).to.not.eq(ethers.ZeroAddress);
      expect(subVault2).to.not.eq(ethers.ZeroAddress);
      expect(subVault1).to.not.eq(subVault2);
    });
  });

  describe("Sub-Vault Reservations", function () {
    let subVaultAddress: string;
    let subVault: any;
    let checkIn: number;
    let checkOut: number;

    beforeEach(async function () {
      checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      checkOut = checkIn + 86400 * 3;

      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      subVaultAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      subVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddress);
    });

    it("Should allow reservations in sub-vaults", async function () {
      // Approve and create reservation
      await pyusd.connect(userA).approve(subVaultAddress, BASE_PRICE);
      await subVault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // Verify reservation
      const reservation = await subVault.getCurrentReservation();
      expect(reservation.booker).to.eq(await userA.getAddress());
      expect(reservation.stakeAmount).to.eq(BASE_PRICE);
      expect(await subVault.currentState()).to.eq(1); // AUCTION
    });

    it("Should allow multiple users to bid in sub-vault auction", async function () {
      // UserA creates reservation
      await pyusd.connect(userA).approve(subVaultAddress, BASE_PRICE);
      await subVault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // UserB places bid
      const bidAmount = ethers.parseUnits("1500", PYUSD_DECIMALS);
      await pyusd.connect(userB).approve(subVaultAddress, bidAmount);
      await subVault.connect(userB).placeBid(bidAmount);

      // Verify bid
      const bids = await subVault.getAuctionBids();
      expect(bids.length).to.eq(1);
      expect(bids[0].bidder).to.eq(await userB.getAddress());
      expect(bids[0].amount).to.eq(bidAmount);
    });

    it("Should complete full reservation cycle in sub-vault", async function () {
      // Create reservation
      await pyusd.connect(userA).approve(subVaultAddress, BASE_PRICE);
      await subVault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // Fast-forward to check-in time
      await ethers.provider.send("evm_setNextBlockTimestamp", [checkIn]);
      await ethers.provider.send("evm_mine", []);

      // Check-in
      const tx = await subVault.connect(userA).checkIn();
      const receipt = await tx.wait();

      // Verify access code is from parent vault
      const event = receipt.logs.find((log: any) => log.fragment?.name === "CheckInCompleted");
      expect(event.args.accessCode).to.eq("MIAMI2024");

      // Fast-forward to check-out time
      await ethers.provider.send("evm_setNextBlockTimestamp", [checkOut]);
      await ethers.provider.send("evm_mine", []);

      // Check-out
      await subVault.connect(userA).checkOut();
      expect(await subVault.currentState()).to.eq(0); // FREE
    });
  });

  describe("Parent-Child Relationship", function () {
    it("Should correctly identify parent vault", async function () {
      const checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      const subVaultAddress = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);

      const parentId = await factory.getParentVault(subVaultAddress);
      expect(parentId).to.eq(PARENT_VAULT_ID);
    });

    it("Should return empty string for non-sub-vault addresses", async function () {
      const parentId = await factory.getParentVault(await userA.getAddress());
      expect(parentId).to.eq("");
    });
  });

  describe("Error Handling", function () {
    it("Should reject invalid date ranges", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 7;
      const checkOut = checkIn - 86400; // Invalid: check-out before check-in

      await expect(factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut))
        .to.be.revertedWith("Invalid date range");
    });

    it("Should reject past check-in dates", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) - 86400; // Yesterday
      const checkOut = checkIn + 86400 * 3;

      await expect(factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut))
        .to.be.revertedWith("Check-in must be in future");
    });

    it("Should reject inactive parent vaults", async function () {
      const checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      // Deactivate parent vault
      await factory.deactivateVault(PARENT_VAULT_ID);

      await expect(factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut))
        .to.be.revertedWith("Parent vault not active");
    });

    it("Should reject non-existent parent vaults", async function () {
      const checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      await expect(factory.getOrCreateDateVault("NON-EXISTENT", checkIn, checkOut))
        .to.be.revertedWith("Parent vault not active");
    });
  });

  describe("Multiple Properties Scenario", function () {
    let secondParentVault: any;
    const SECOND_VAULT_ID = "HOTEL-NYC-002";

    beforeEach(async function () {
      // Create second parent vault
      const tx = await factory.createVault(
        SECOND_VAULT_ID,
        '{"city":"New York","property":"Boutique Hotel","rooms":25}',
        ethers.parseUnits("1500", PYUSD_DECIMALS),
        await hotel.getAddress(),
        "NYC2024"
      );
      const receipt = await tx.wait();
      const evt = receipt.logs.find((l: any) => l.fragment.name === "VaultCreated");
      const secondParentVaultAddr = evt.args.vaultAddress;

      secondParentVault = await ethers.getContractAt("DigitalHouseVault", secondParentVaultAddr);
    });

    it("Should handle multiple properties with same dates", async function () {
      const checkIn = (await ethers.provider.getBlock("latest"))!.timestamp + 86400 * 7;
      const checkOut = checkIn + 86400 * 3;

      // Create sub-vaults for same dates in different properties
      await factory.getOrCreateDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      await factory.getOrCreateDateVault(SECOND_VAULT_ID, checkIn, checkOut);

      const subVault1 = await factory.getDateVault(PARENT_VAULT_ID, checkIn, checkOut);
      const subVault2 = await factory.getDateVault(SECOND_VAULT_ID, checkIn, checkOut);

      expect(subVault1).to.not.eq(ethers.ZeroAddress);
      expect(subVault2).to.not.eq(ethers.ZeroAddress);
      expect(subVault1).to.not.eq(subVault2);

      // Verify different properties
      const vault1 = await ethers.getContractAt("DigitalHouseVault", subVault1);
      const vault2 = await ethers.getContractAt("DigitalHouseVault", subVault2);

      expect(await vault1.basePrice()).to.eq(BASE_PRICE);
      expect(await vault2.basePrice()).to.eq(ethers.parseUnits("1500", PYUSD_DECIMALS));
      expect(await vault1.masterAccessCode()).to.eq("MIAMI2024");
      expect(await vault2.masterAccessCode()).to.eq("NYC2024");
    });
  });
});
