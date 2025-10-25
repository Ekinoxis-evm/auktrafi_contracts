import { expect } from "chai";
import { ethers } from "hardhat";

describe("💰 Payment Distribution Tests", function () {
  const PYUSD_DECIMALS = 6;
  const BASE_PRICE = ethers.parseUnits("1000", PYUSD_DECIMALS); // 1000 PYUSD
  const BID_AMOUNT = ethers.parseUnits("2500", PYUSD_DECIMALS); // 2500 PYUSD
  const ADDITIONAL_VALUE = BID_AMOUNT - BASE_PRICE; // 1500 PYUSD

  let pyusd: any;
  let factory: any;
  let vault: any;
  let deployer: any, hotel: any, userA: any, userB: any, digitalHouse: any;
  const DH_WALLET = "0x854b298d922fDa553885EdeD14a84eb088355822";

  beforeEach(async () => {
    [deployer, hotel, userA, userB, digitalHouse] = await ethers.getSigners();

    // Mock PYUSD (ERC20)
    const ERC20 = await ethers.getContractFactory("MockERC20");
    pyusd = await ERC20.deploy("PYUSD", "PYUSD", PYUSD_DECIMALS);
    await pyusd.waitForDeployment();

    // Mint tokens to test users
    for (const u of [hotel, userA, userB, digitalHouse]) {
      await pyusd.mint(await u.getAddress(), ethers.parseUnits("50000", PYUSD_DECIMALS));
    }

    // Deploy Factory
    const Factory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await Factory.deploy(await pyusd.getAddress(), DH_WALLET);
    await factory.waitForDeployment();

    // Create Vault for hotel
    const tx = await factory.createVault(
      "TEST-VAULT-001",
      '{"city":"Test City","room":"101"}',
      BASE_PRICE,
      await hotel.getAddress(),
      "TESTCODE123" // Master access code
    );
    const receipt = await tx.wait();
    const evt = receipt.logs.find((l: any) => l.fragment.name === "VaultCreated");
    const vaultAddr = evt.args.vaultAddress;

    vault = await ethers.getContractAt("DigitalHouseVault", vaultAddr);
  });

  describe("Base Price Only Distribution (No Cession)", function () {
    it("Should distribute base price correctly: 95% real estate, 5% platform", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
      const checkOut = checkIn + 86400 * 2;

      // Get initial balances
      const initialHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const initialPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      // UserA creates reservation with base price
      await pyusd.connect(userA).approve(await vault.getAddress(), BASE_PRICE);
      await vault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // Fast-forward to check-in time
      await ethers.provider.send("evm_increaseTime", [86400 * 3]);
      await ethers.provider.send("evm_mine", []);

      // Check-in
      await vault.connect(userA).checkIn();

      // Verify distribution
      const finalHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const finalPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      const expectedHotelAmount = (BASE_PRICE * 95n) / 100n; // 95% of 1000 = 950
      const expectedPlatformAmount = (BASE_PRICE * 5n) / 100n; // 5% of 1000 = 50

      expect(finalHotelBalance - initialHotelBalance).to.eq(expectedHotelAmount);
      expect(finalPlatformBalance - initialPlatformBalance).to.eq(expectedPlatformAmount);
    });
  });

  describe("Additional Value Distribution (With Cession)", function () {
    it("Should distribute additional value correctly: 40% current, 30% last, 20% real estate, 10% platform", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
      const checkOut = checkIn + 86400 * 2;

      // Get initial balances
      const initialUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const initialUserBBalance = await pyusd.balanceOf(await userB.getAddress());
      const initialHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const initialPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      // UserA creates initial reservation
      await pyusd.connect(userA).approve(await vault.getAddress(), BASE_PRICE);
      await vault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // UserB places higher bid
      await pyusd.connect(userB).approve(await vault.getAddress(), BID_AMOUNT);
      await vault.connect(userB).placeBid(BID_AMOUNT);

      // Fast-forward to cession time (24h before check-in)
      await ethers.provider.send("evm_increaseTime", [86400 * 2]);
      await ethers.provider.send("evm_mine", []);

      // UserA cedes to UserB
      await vault.connect(userA).cedeReservation(0);

      // Verify UserA got their original stake back
      const balanceAfterCession = await pyusd.balanceOf(await userA.getAddress());
      expect(balanceAfterCession - initialUserABalance).to.eq(0); // Got back what they put in

      // Fast-forward to check-in time
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      // UserB checks in
      await vault.connect(userB).checkIn();

      // Get final balances
      const finalUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const finalUserBBalance = await pyusd.balanceOf(await userB.getAddress());
      const finalHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const finalPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      // Calculate expected distributions
      // Base price distribution (1000 PYUSD): 95% hotel + 5% platform
      const baseHotelAmount = (BASE_PRICE * 95n) / 100n; // 950
      const basePlatformAmount = (BASE_PRICE * 5n) / 100n; // 50

      // Additional value distribution (1500 PYUSD): 40% + 30% + 20% + 10%
      const currentBookerAmount = (ADDITIONAL_VALUE * 40n) / 100n; // 600 to UserB
      const lastBookerAmount = (ADDITIONAL_VALUE * 30n) / 100n; // 450 to UserA
      const additionalHotelAmount = (ADDITIONAL_VALUE * 20n) / 100n; // 300 to hotel
      const additionalPlatformAmount = (ADDITIONAL_VALUE * 10n) / 100n; // 150 to platform

      // Verify distributions
      expect(finalUserABalance - initialUserABalance).to.eq(lastBookerAmount); // UserA gets 30% of additional value
      expect(initialUserBBalance - finalUserBBalance).to.eq(BID_AMOUNT - currentBookerAmount); // UserB paid bid minus 40% back
      expect(finalHotelBalance - initialHotelBalance).to.eq(baseHotelAmount + additionalHotelAmount); // Hotel gets base + additional
      expect(finalPlatformBalance - initialPlatformBalance).to.eq(basePlatformAmount + additionalPlatformAmount); // Platform gets base + additional
    });

    it("Should handle case when no lastBooker exists (no cession)", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
      const checkOut = checkIn + 86400 * 2;

      // UserA creates reservation with higher amount (simulating direct high stake)
      await pyusd.connect(userA).approve(await vault.getAddress(), BID_AMOUNT);
      await vault.connect(userA).createReservation(BID_AMOUNT, checkIn, checkOut);

      // Get initial balances
      const initialUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const initialHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const initialPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      // Fast-forward to check-in time
      await ethers.provider.send("evm_increaseTime", [86400 * 3]);
      await ethers.provider.send("evm_mine", []);

      // UserA checks in
      await vault.connect(userA).checkIn();

      // Get final balances
      const finalUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const finalHotelBalance = await pyusd.balanceOf(await hotel.getAddress());
      const finalPlatformBalance = await pyusd.balanceOf(DH_WALLET);

      // Calculate expected distributions
      const baseHotelAmount = (BASE_PRICE * 95n) / 100n;
      const basePlatformAmount = (BASE_PRICE * 5n) / 100n;
      const currentBookerAmount = (ADDITIONAL_VALUE * 40n) / 100n;
      const lastBookerAmount = (ADDITIONAL_VALUE * 30n) / 100n; // Should go to hotel since no lastBooker
      const additionalHotelAmount = (ADDITIONAL_VALUE * 20n) / 100n;
      const additionalPlatformAmount = (ADDITIONAL_VALUE * 10n) / 100n;

      // Verify distributions
      expect(finalUserABalance - initialUserABalance).to.eq(currentBookerAmount); // UserA gets 40% back
      expect(finalHotelBalance - initialHotelBalance).to.eq(baseHotelAmount + additionalHotelAmount + lastBookerAmount); // Hotel gets base + additional + lastBooker share
      expect(finalPlatformBalance - initialPlatformBalance).to.eq(basePlatformAmount + additionalPlatformAmount);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple cessions correctly", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const checkIn = (latestBlock?.timestamp || 0) + 86400 * 5; // More time for multiple cessions
      const checkOut = checkIn + 86400 * 2;

      const [, , , , userC] = await ethers.getSigners();
      await pyusd.mint(await userC.getAddress(), ethers.parseUnits("50000", PYUSD_DECIMALS));

      // UserA creates initial reservation
      await pyusd.connect(userA).approve(await vault.getAddress(), BASE_PRICE);
      await vault.connect(userA).createReservation(BASE_PRICE, checkIn, checkOut);

      // UserB places bid
      const bid1 = ethers.parseUnits("1500", PYUSD_DECIMALS);
      await pyusd.connect(userB).approve(await vault.getAddress(), bid1);
      await vault.connect(userB).placeBid(bid1);

      // UserC places higher bid
      const bid2 = ethers.parseUnits("2000", PYUSD_DECIMALS);
      await pyusd.connect(userC).approve(await vault.getAddress(), bid2);
      await vault.connect(userC).placeBid(bid2);

      // Fast-forward to first cession time
      await ethers.provider.send("evm_increaseTime", [86400 * 4]);
      await ethers.provider.send("evm_mine", []);

      // UserA cedes to UserC (highest bidder)
      await vault.connect(userA).cedeReservation(1); // Index 1 is UserC's bid

      // Verify lastBooker is UserA
      expect(await vault.lastBooker()).to.eq(await userA.getAddress());

      // Fast-forward to check-in
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      const initialUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const initialUserCBalance = await pyusd.balanceOf(await userC.getAddress());

      // UserC checks in
      await vault.connect(userC).checkIn();

      const finalUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const finalUserCBalance = await pyusd.balanceOf(await userC.getAddress());

      // UserA should get 30% of additional value (2000 - 1000 = 1000, so 300)
      const additionalValue = bid2 - BASE_PRICE;
      const expectedUserAAmount = (additionalValue * 30n) / 100n;
      const expectedUserCAmount = (additionalValue * 40n) / 100n;

      expect(finalUserABalance - initialUserABalance).to.eq(expectedUserAAmount);
      expect(finalUserCBalance - initialUserCBalance).to.eq(expectedUserCAmount);
    });
  });
});
