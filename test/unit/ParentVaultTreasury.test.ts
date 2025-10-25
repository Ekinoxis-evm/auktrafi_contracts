import { expect } from "chai";
import { ethers } from "hardhat";

describe("🏦 Parent Vault Treasury Tests", function () {
  const PYUSD_DECIMALS = 6;
  const NIGHT_PRICE = ethers.parseUnits("100", PYUSD_DECIMALS); // 100 PYUSD per night
  const BID_AMOUNT = ethers.parseUnits("150", PYUSD_DECIMALS); // 150 PYUSD bid

  let pyusd: any;
  let factory: any;
  let parentVault: any;
  let nightSubVault: any;
  let owner: any, userA: any, userB: any, digitalHouse: any;
  const DH_WALLET = "0x854b298d922fDa553885EdeD14a84eb088355822";

  beforeEach(async () => {
    [owner, userA, userB, digitalHouse] = await ethers.getSigners();

    // Deploy Mock PYUSD
    const ERC20 = await ethers.getContractFactory("MockERC20");
    pyusd = await ERC20.deploy("PYUSD", "PYUSD", PYUSD_DECIMALS);
    await pyusd.waitForDeployment();

    // Mint tokens to test users
    for (const u of [owner, userA, userB]) {
      await pyusd.mint(await u.getAddress(), ethers.parseUnits("10000", PYUSD_DECIMALS));
    }

    // Deploy Vault Implementation
    const VaultImpl = await ethers.getContractFactory("DigitalHouseVault");
    const vaultImpl = await VaultImpl.deploy();
    await vaultImpl.waitForDeployment();

    // Deploy Factory with implementation address
    const Factory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await Factory.deploy(
      await pyusd.getAddress(), 
      DH_WALLET,
      await vaultImpl.getAddress()
    );
    await factory.waitForDeployment();

    // Create Parent Vault
    const tx = await factory.connect(owner).createVault(
      "HOTEL-001",
      '{"city":"Miami","rooms":10}',
      NIGHT_PRICE,
      "MASTER123"
    );
    const receipt = await tx.wait();
    const evt = receipt.logs.find((l: any) => l.fragment?.name === "VaultCreated");
    const parentVaultAddr = evt.args.vaultAddress;

    parentVault = await ethers.getContractAt("DigitalHouseVault", parentVaultAddr);

    // Set night 15 as available
    await factory.connect(owner).setNightAvailability("HOTEL-001", 15, true);

    // Create Night Sub-Vault
    const tx2 = await factory.getOrCreateNightVault("HOTEL-001", 15, "MASTER123");
    await tx2.wait();
    const subVaultAddr = await factory.getNightSubVault("HOTEL-001", 15);
    nightSubVault = await ethers.getContractAt("DigitalHouseVault", subVaultAddr);
  });

  describe("Payment Routing to Parent Vault", function () {
    it("Should route sub-vault payments to parent vault treasury", async function () {
      const nightDate = 15;

      // UserA creates reservation in sub-vault
      await pyusd.connect(userA).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userA).createReservation(
        NIGHT_PRICE,
        nightDate,
        nightDate
      );

      // Fast-forward to check-in time
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      // Get initial parent vault balance
      const initialParentBalance = await pyusd.balanceOf(await parentVault.getAddress());
      const initialOwnerEarnings = await parentVault.earnings(await owner.getAddress());

      // UserA checks in
      await nightSubVault.connect(userA).checkIn();

      // Verify parent vault received the payment
      const finalParentBalance = await pyusd.balanceOf(await parentVault.getAddress());
      const finalOwnerEarnings = await parentVault.earnings(await owner.getAddress());

      // Calculate expected amounts (95% of base price goes to parent vault)
      const expectedRealEstateAmount = (NIGHT_PRICE * 95n) / 100n;

      expect(finalParentBalance - initialParentBalance).to.be.greaterThan(0);
      expect(finalOwnerEarnings - initialOwnerEarnings).to.eq(expectedRealEstateAmount);
    });

    it("Should allow parent vault owner to withdraw accumulated earnings", async function () {
      const nightDate = 15;

      // UserA creates reservation and checks in
      await pyusd.connect(userA).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userA).createReservation(
        NIGHT_PRICE,
        nightDate,
        nightDate
      );

      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      await nightSubVault.connect(userA).checkIn();

      // Get owner's earnings balance
      const earningsBalance = await parentVault.earnings(await owner.getAddress());
      expect(earningsBalance).to.be.greaterThan(0);

      // Owner withdraws earnings
      const initialOwnerBalance = await pyusd.balanceOf(await owner.getAddress());
      await parentVault.connect(owner).withdrawEarnings();
      const finalOwnerBalance = await pyusd.balanceOf(await owner.getAddress());

      // Verify withdrawal
      expect(finalOwnerBalance - initialOwnerBalance).to.eq(earningsBalance);
      expect(await parentVault.earnings(await owner.getAddress())).to.eq(0);
    });

    it("Should handle multiple sub-vault payments to same parent vault", async function () {
      // Set night 16 as available
      await factory.connect(owner).setNightAvailability("HOTEL-001", 16, true);

      // Create second sub-vault
      const subVaultAddr2 = await factory.getOrCreateNightVault("HOTEL-001", 16, "MASTER123");
      const nightSubVault2 = await ethers.getContractAt("DigitalHouseVault", subVaultAddr2);

      // UserA books night 15
      await pyusd.connect(userA).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userA).createReservation(NIGHT_PRICE, 15, 15);

      // UserB books night 16
      await pyusd.connect(userB).approve(await nightSubVault2.getAddress(), NIGHT_PRICE);
      await nightSubVault2.connect(userB).createReservation(NIGHT_PRICE, 16, 16);

      // Fast-forward and check-in both
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      const initialTotalEarnings = await parentVault.totalEarnings();

      await nightSubVault.connect(userA).checkIn();
      await nightSubVault2.connect(userB).checkIn();

      const finalTotalEarnings = await parentVault.totalEarnings();

      // Verify total earnings increased by 2x base amount (95% each)
      const expectedPerNight = (NIGHT_PRICE * 95n) / 100n;
      expect(finalTotalEarnings - initialTotalEarnings).to.eq(expectedPerNight * 2n);
    });

    it("Should distribute additional value correctly when bid is higher than base price", async function () {
      const nightDate = 15;

      // UserA creates initial reservation
      await pyusd.connect(userA).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userA).createReservation(NIGHT_PRICE, nightDate, nightDate);

      // UserB places higher bid
      await pyusd.connect(userB).approve(await nightSubVault.getAddress(), BID_AMOUNT);
      await nightSubVault.connect(userB).placeBid(BID_AMOUNT);

      // UserA cedes to UserB
      await nightSubVault.connect(userA).cedeReservation(0);

      // Fast-forward to check-in
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);

      const initialParentEarnings = await parentVault.earnings(await owner.getAddress());
      const initialUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const initialUserBBalance = await pyusd.balanceOf(await userB.getAddress());

      // UserB checks in
      await nightSubVault.connect(userB).checkIn();

      const finalParentEarnings = await parentVault.earnings(await owner.getAddress());
      const finalUserABalance = await pyusd.balanceOf(await userA.getAddress());
      const finalUserBBalance = await pyusd.balanceOf(await userB.getAddress());

      // Calculate expected distributions
      const additionalValue = BID_AMOUNT - NIGHT_PRICE; // 50 PYUSD
      const baseRealEstateAmount = (NIGHT_PRICE * 95n) / 100n; // 95 PYUSD
      const additionalRealEstateAmount = (additionalValue * 20n) / 100n; // 10 PYUSD
      const lastBookerAmount = (additionalValue * 30n) / 100n; // 15 PYUSD
      const currentBookerAmount = (additionalValue * 40n) / 100n; // 20 PYUSD

      // Verify distributions
      expect(finalParentEarnings - initialParentEarnings).to.eq(
        baseRealEstateAmount + additionalRealEstateAmount
      ); // Parent vault gets base + additional
      expect(finalUserABalance - initialUserABalance).to.eq(lastBookerAmount); // UserA gets 30% of additional
      expect(finalUserBBalance - initialUserBBalance).to.eq(currentBookerAmount); // UserB gets 40% back
    });
  });

  describe("Edge Cases", function () {
    it("Should prevent non-owner from withdrawing earnings", async function () {
      await expect(
        parentVault.connect(userA).withdrawEarnings()
      ).to.be.revertedWith("Only vault owner");
    });

    it("Should revert withdrawal when no earnings available", async function () {
      await expect(
        parentVault.connect(owner).withdrawEarnings()
      ).to.be.revertedWith("No earnings to withdraw");
    });

    it("Should correctly track totalEarnings across multiple transactions", async function () {
      const nightDate = 15;

      // First booking
      await pyusd.connect(userA).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userA).createReservation(NIGHT_PRICE, nightDate, nightDate);
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);
      await nightSubVault.connect(userA).checkIn();

      const earningsAfterFirst = await parentVault.totalEarnings();
      expect(earningsAfterFirst).to.be.greaterThan(0);

      // Check-out and reset
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);
      await nightSubVault.connect(userA).checkOut();

      // Second booking (same sub-vault, now FREE again)
      await pyusd.connect(userB).approve(await nightSubVault.getAddress(), NIGHT_PRICE);
      await nightSubVault.connect(userB).createReservation(NIGHT_PRICE, nightDate, nightDate);
      await ethers.provider.send("evm_increaseTime", [86400 * 1]);
      await ethers.provider.send("evm_mine", []);
      await nightSubVault.connect(userB).checkIn();

      const earningsAfterSecond = await parentVault.totalEarnings();
      
      // Total earnings should be ~2x the first booking
      const expectedPerNight = (NIGHT_PRICE * 95n) / 100n;
      expect(earningsAfterSecond).to.be.closeTo(expectedPerNight * 2n, ethers.parseUnits("1", PYUSD_DECIMALS));
    });
  });
});

