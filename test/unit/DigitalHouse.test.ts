import { expect } from "chai";
import { ethers } from "hardhat";

describe("🏠 Digital House end-to-end", function () {
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

    // Deploy Factory
    const Factory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await Factory.deploy(await pyusd.getAddress(), DH_WALLET);
    await factory.waitForDeployment();

    // Create Vault for hotel
    const tx = await factory.createVault(
      "APT-BOG-101-2025",
      '{"city":"Bogota","room":"101"}',
      FLOOR_PRICE,
      await hotel.getAddress()
    );
    const receipt = await tx.wait();
    const evt = receipt.logs.find((l: any) => l.fragment.name === "VaultCreated");
    const vaultAddr = evt.args.vaultAddress;

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
    // Después de la cesión, el stakeAmount vuelve al valor original (1000)
    // porque el valor adicional (500) ya se distribuyó como valor ciudadano
    expect(newRes.stakeAmount).to.eq(FLOOR_PRICE); // 1000 PYUSD, no 1500

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
});