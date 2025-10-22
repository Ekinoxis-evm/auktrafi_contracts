import { expect } from "chai";
import { ethers } from "hardhat";
import { DigitalHouseFactory } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DigitalHouseFactory", function () {
  let factory: DigitalHouseFactory;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const MOCK_PYUSD = "0x0000000000000000000000000000000000000001";
  const MOCK_DIGITALHOUSE = "0x0000000000000000000000000000000000000003";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const FactoryFactory = await ethers.getContractFactory("DigitalHouseFactory");
    factory = await FactoryFactory.deploy(
      MOCK_PYUSD,
      MOCK_DIGITALHOUSE
    );
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should set correct addresses", async function () {
      expect(await factory.pyusdToken()).to.equal(MOCK_PYUSD);
      expect(await factory.digitalHouseAddress()).to.equal(MOCK_DIGITALHOUSE);
    });
  });

  describe("Vault Creation", function () {
    it("Should create a new vault", async function () {
      const vaultId = "VAULT-001";
      const propertyDetails = "Apartment in Miami";
      const basePrice = ethers.parseUnits("1000", 6); // 1000 PYUSD

      await expect(factory.createVault(vaultId, propertyDetails, basePrice, addr1.address))
        .to.emit(factory, "VaultCreated");

      const vaultInfo = await factory.getVaultInfo(vaultId);
      expect(vaultInfo.vaultId).to.equal(vaultId);
      expect(vaultInfo.propertyDetails).to.equal(propertyDetails);
      expect(vaultInfo.basePrice).to.equal(basePrice);
      expect(vaultInfo.isActive).to.be.true;
    });

    it("Should reject duplicate vault IDs", async function () {
      const vaultId = "VAULT-001";
      const propertyDetails = "Apartment in Miami";
      const basePrice = ethers.parseUnits("1000", 6);

      await factory.createVault(vaultId, propertyDetails, basePrice, addr1.address);

      await expect(
        factory.createVault(vaultId, propertyDetails, basePrice, addr1.address)
      ).to.be.revertedWith("Vault ID already exists");
    });

    it("Should reject empty vault ID", async function () {
      await expect(
        factory.createVault("", "Property", ethers.parseUnits("1000", 6), addr1.address)
      ).to.be.revertedWith("Vault ID required");
    });

    it("Should reject zero base price", async function () {
      await expect(
        factory.createVault("VAULT-001", "Property", 0, addr1.address)
      ).to.be.revertedWith("Base price must be > 0");
    });
  });

  describe("Vault Management", function () {
    beforeEach(async function () {
      await factory.createVault("VAULT-001", "Property 1", ethers.parseUnits("1000", 6), addr1.address);
    });

    it("Should get vault address", async function () {
      const address = await factory.getVaultAddress("VAULT-001");
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("Should get all vault IDs", async function () {
      await factory.createVault("VAULT-002", "Property 2", ethers.parseUnits("2000", 6), addr2.address);

      const vaultIds = await factory.getAllVaultIds();
      expect(vaultIds.length).to.equal(2);
      expect(vaultIds[0]).to.equal("VAULT-001");
      expect(vaultIds[1]).to.equal("VAULT-002");
    });

    it("Should deactivate vault (only owner)", async function () {
      await expect(factory.deactivateVault("VAULT-001"))
        .to.emit(factory, "VaultDeactivated")
        .withArgs("VAULT-001");

      const vaultInfo = await factory.getVaultInfo("VAULT-001");
      expect(vaultInfo.isActive).to.be.false;
    });
  });
});
