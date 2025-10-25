import { expect } from "chai";
import { ethers } from "hardhat";

describe("🏠 Auktrafi end-to-end", function () {
  const PYUSD_DECIMALS = 6;
  const FLOOR_PRICE = ethers.parseUnits("1000", PYUSD_DECIMALS);

  let pyusd: any;
  let factory: any;
  let vault: any;
  let deployer: any, hotel: any, userA: any, userB: any, userC: any;
  const DH_WALLET = "0x854b298d922fDa553885EdeD14a84eb088355822";

  beforeEach(async () => {
    [deployer, hotel, userA, userB, userC] = await ethers.getSigners();

    // Mock PYUSD (ERC20)
    const ERC20 = await ethers.getContractFactory("MockERC20");
    pyusd = await ERC20.deploy("PYUSD", "PYUSD", PYUSD_DECIMALS);
    await pyusd.waitForDeployment();

    // Mint tokens to test users
    for (const u of [hotel, userA, userB, userC])
      await pyusd.mint(await u.getAddress(), ethers.parseUnits("10000", PYUSD_DECIMALS));

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

    // Create Vault for hotel
    const tx = await factory.connect(hotel).createVault(
      "APT-BOG-101-2025",
      '{"city":"Bogota","room":"101"}',
      FLOOR_PRICE,
      "HOTEL123" // Master access code
    );
    const receipt = await tx.wait();
    const evt = receipt.logs.find((l: any) => l.fragment?.name === "VaultCreated");
    const vaultAddr = evt!.args.vaultAddress;

    vault = await ethers.getContractAt("DigitalHouseVault", vaultAddr);
  });

  it("Full reservation flow", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
    const checkOut = checkIn + 86400 * 2;

    // Approve PYUSD
    await pyusd.connect(userA).approve(await vault.getAddress(), FLOOR_PRICE);

    // Create reservation
    await vault.connect(userA).createReservation(FLOOR_PRICE, checkIn, checkOut);

    const res = await vault.getCurrentReservation();
    expect(res.booker).to.eq(await userA.getAddress());
    expect(await vault.currentState()).to.eq(1); // AUCTION

    // userB places higher bid
    const BID = ethers.parseUnits("1500", PYUSD_DECIMALS);
    await pyusd.connect(userB).approve(await vault.getAddress(), BID);
    await vault.connect(userB).placeBid(BID);

    // Simulate cedeReservation by userA (must be within 24hrs before check-in)
    await ethers.provider.send("evm_increaseTime", [86400 * 2]); // fast-forward 2 days (1 day before check-in)
    await ethers.provider.send("evm_mine", []);

    await vault.connect(userA).cedeReservation(0);

    const newRes = await vault.getCurrentReservation();
    expect(newRes.booker).to.eq(await userB.getAddress());
    // Con la nueva lógica, después de la cesión el stakeAmount es el monto completo del bid
    // La distribución del valor adicional se hace en checkIn(), no en cedeReservation()
    expect(newRes.stakeAmount).to.eq(BID); // 1500 PYUSD (monto completo del bid)

    // Check-in by new booker (advance to check-in time)
    await ethers.provider.send("evm_increaseTime", [86400 * 1]); // advance 1 more day to reach check-in
    await ethers.provider.send("evm_mine", []);
    const tx = await vault.connect(userB).checkIn();
    const receipt = await tx.wait();
    // El código de acceso se emite en el evento CheckInCompleted

    // Check-out after 2 days
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine", []);
    await vault.connect(userB).checkOut();

    expect(await vault.currentState()).to.eq(0); // FREE again
  });

  it("Should track originalBooker and lastBooker correctly", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
    const checkOut = checkIn + 86400 * 2;

    // UserA creates initial reservation
    await pyusd.connect(userA).approve(await vault.getAddress(), FLOOR_PRICE);
    await vault.connect(userA).createReservation(FLOOR_PRICE, checkIn, checkOut);

    // Verify originalBooker is set
    expect(await vault.originalBooker()).to.eq(await userA.getAddress());
    expect(await vault.lastBooker()).to.eq(ethers.ZeroAddress); // No cession yet

    // UserB places bid and userA cedes
    const BID = ethers.parseUnits("1500", PYUSD_DECIMALS);
    await pyusd.connect(userB).approve(await vault.getAddress(), BID);
    await vault.connect(userB).placeBid(BID);

    // Fast-forward to cession time
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine", []);

    await vault.connect(userA).cedeReservation(0);

    // Verify lastBooker is set after cession
    expect(await vault.originalBooker()).to.eq(await userA.getAddress()); // Still userA
    expect(await vault.lastBooker()).to.eq(await userA.getAddress()); // UserA ceded
  });

  it("Should store and retrieve access codes securely", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
    const checkOut = checkIn + 86400 * 2;

    // Create reservation and check-in
    await pyusd.connect(userA).approve(await vault.getAddress(), FLOOR_PRICE);
    await vault.connect(userA).createReservation(FLOOR_PRICE, checkIn, checkOut);

    // Fast-forward to check-in time
    await ethers.provider.send("evm_increaseTime", [86400 * 3]);
    await ethers.provider.send("evm_mine", []);

    const tx = await vault.connect(userA).checkIn();
    const receipt = await tx.wait();

    // Access code should be retrievable by authorized users
    const accessCode = await vault.connect(userA).getCurrentAccessCode();
    expect(accessCode).to.eq("HOTEL123"); // Should be the master access code

    // Hotel owner should also be able to access the code
    const accessCodeFromHotel = await vault.connect(hotel).getCurrentAccessCode();
    expect(accessCodeFromHotel).to.eq(accessCode);

    // Unauthorized user should not be able to access
    await expect(vault.connect(userC).getCurrentAccessCode()).to.be.revertedWith("Not authorized to view access code");

    // After check-out, access code should be invalidated
    await ethers.provider.send("evm_increaseTime", [86400 * 2]);
    await ethers.provider.send("evm_mine", []);
    await vault.connect(userA).checkOut();

    await expect(vault.connect(userA).getCurrentAccessCode()).to.be.revertedWith("No active access code");
  });

  it("Should use master access code defined by vault owner", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
    const checkOut = checkIn + 86400 * 2;

    // Verify master access code is set
    const masterCode = await vault.connect(hotel).getMasterAccessCode();
    expect(masterCode).to.eq("HOTEL123");

    // Create reservation and check-in
    await pyusd.connect(userA).approve(await vault.getAddress(), FLOOR_PRICE);
    await vault.connect(userA).createReservation(FLOOR_PRICE, checkIn, checkOut);

    // Fast-forward to check-in time
    await ethers.provider.send("evm_increaseTime", [86400 * 3]);
    await ethers.provider.send("evm_mine", []);

    const tx = await vault.connect(userA).checkIn();
    const receipt = await tx.wait();

    // The access code returned should be the master code
    const event = receipt.logs.find((log: any) => log.fragment?.name === "CheckInCompleted");
    expect(event.args.accessCode).to.eq("HOTEL123");

    // Verify access code can be retrieved
    const accessCode = await vault.connect(userA).getCurrentAccessCode();
    expect(accessCode).to.eq("HOTEL123");
  });

  it("Should allow vault owner to update master access code", async function () {
    // Hotel owner updates the master access code
    await vault.connect(hotel).updateMasterAccessCode("NEWCODE456");

    // Verify the code was updated
    const updatedCode = await vault.connect(hotel).getMasterAccessCode();
    expect(updatedCode).to.eq("NEWCODE456");

    // Test with a new reservation
    const latestBlock = await ethers.provider.getBlock("latest");
    const checkIn = (latestBlock?.timestamp || 0) + 86400 * 3;
    const checkOut = checkIn + 86400 * 2;

    await pyusd.connect(userB).approve(await vault.getAddress(), FLOOR_PRICE);
    await vault.connect(userB).createReservation(FLOOR_PRICE, checkIn, checkOut);

    await ethers.provider.send("evm_increaseTime", [86400 * 3]);
    await ethers.provider.send("evm_mine", []);

    const tx = await vault.connect(userB).checkIn();
    const receipt = await tx.wait();

    // Should use the updated master code
    const event = receipt.logs.find((log: any) => log.fragment?.name === "CheckInCompleted");
    expect(event.args.accessCode).to.eq("NEWCODE456");
  });
});