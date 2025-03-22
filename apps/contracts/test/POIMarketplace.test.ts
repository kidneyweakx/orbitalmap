import { expect } from "chai";
import { ethers } from "hardhat";

describe("POI Marketplace Contracts", function () {
  let l1Contract: any;
  let l2Contract: any;
  let owner: any;
  let validator: any;
  let user: any;
  
  beforeEach(async function () {
    // Get signers
    [owner, validator, user] = await ethers.getSigners();
    
    // Deploy L1 contract with placeholder L2 address
    const L1POIMarketplace = await ethers.getContractFactory("L1POIMarketplace");
    l1Contract = await L1POIMarketplace.deploy(ethers.ZeroAddress, 31337); // Use Hardhat network chainId
    
    // Deploy L2 contract
    const L2POIAuction = await ethers.getContractFactory("L2POIAuction");
    l2Contract = await L2POIAuction.deploy(await l1Contract.getAddress(), 31337);
    
    // Update L1 with actual L2 address
    await l1Contract.updateL2Contract(await l2Contract.getAddress());
  });
  
  describe("L1POIMarketplace", function () {
    it("should set the owner correctly", async function () {
      expect(await l1Contract.owner()).to.equal(owner.address);
    });
    
    it("should update L2 contract address", async function () {
      const newAddress = "0x0000000000000000000000000000000000001234";
      await l1Contract.updateL2Contract(newAddress);
      expect(await l1Contract.l2DestinationContract()).to.equal(newAddress);
    });
    
    it("should register a new POI", async function () {
      const poiName = "Test POI";
      const stakeAmount = ethers.parseEther("1");
      
      // Register a POI
      await l1Contract.connect(user).registerPOI(poiName, stakeAmount, { value: stakeAmount });
      
      // Check POI was registered
      const poi = await l1Contract.getPOI(0);
      expect(poi.name).to.equal(poiName);
      expect(poi.owner).to.equal(user.address);
      expect(poi.stakeAmount).to.equal(stakeAmount);
      expect(poi.state).to.equal(1); // VerificationState.Verifying
    });
  });
  
  describe("L2POIAuction", function () {
    it("should register a validator", async function () {
      const stakeAmount = ethers.parseEther("1");
      
      // Register a validator
      await l2Contract.connect(validator).registerValidator("0x", { value: stakeAmount });
      
      // Check validator was registered
      const validatorInfo = await l2Contract.validators(validator.address);
      expect(validatorInfo.isRegistered).to.be.true;
      expect(validatorInfo.stakedAmount).to.equal(stakeAmount);
      expect(await l2Contract.totalValidators()).to.equal(1);
    });
    
    // Add more tests for auction mechanics, proof submission, etc.
  });
  
  // In a real implementation, we would add tests for the cross-chain mechanics
  // This would require mocking the cross-chain messaging protocol
}); 