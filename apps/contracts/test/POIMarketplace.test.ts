import { expect } from "chai";
import hre from "hardhat";
import { parseEther, zeroAddress, type Address, type Block } from "viem";

describe("POI Marketplace Contracts", function () {
  let l1ContractAddress: Address;
  let l2ContractAddress: Address;
  let owner: any;
  let validator: any;
  let user: any;
  let publicClient: any;
  
  // Helper function to mine blocks and advance time
  async function advanceTime(seconds: number) {
    await publicClient.setNextBlockTimestamp(
      await publicClient.getBlock({ blockTag: 'latest' }).then((b: Block) => BigInt(b.timestamp) + BigInt(seconds))
    );
    await publicClient.mine({ blocks: 1 });
  }
  
  beforeEach(async function () {
    // Get clients and accounts
    const { viem } = hre;
    publicClient = await viem.getPublicClient();
    const [ownerClient, validatorClient, userClient] = await viem.getWalletClients();
    
    owner = ownerClient.account;
    validator = validatorClient.account;
    user = userClient.account;
    
    // Deploy L1 contract with placeholder L2 address
    const l1Contract = await hre.viem.deployContract("contracts/L1POIMarketplace.sol:L1POIMarketplace", [
      zeroAddress,
      BigInt(31337) // Hardhat network chainId
    ]);
    
    l1ContractAddress = l1Contract.address;
    
    // Deploy L2 contract
    const l2Contract = await hre.viem.deployContract("contracts/L2POIAuction.sol:L2POIAuction", [
      l1ContractAddress,
      BigInt(31337)
    ]);
    
    l2ContractAddress = l2Contract.address;
    
    // Update L1 with actual L2 address
    await l1Contract.write.updateL2Contract([l2ContractAddress]);
  });
  
  describe("L1POIMarketplace", function () {
    it("should set the owner correctly", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const contractOwner = await l1Contract.read.owner();
      expect(contractOwner).to.equal(owner.address);
    });
    
    it("should have initial state values set correctly", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const l2DestinationContract = await l1Contract.read.l2DestinationContract();
      const l2ChainId = await l1Contract.read.l2ChainId();
      const totalPOIs = await l1Contract.read.totalPOIs();
      const challengeDuration = await l1Contract.read.challengeDuration();
      const validatorRewardPercentage = await l1Contract.read.validatorRewardPercentage();
      
      expect(l2DestinationContract).to.equal(l2ContractAddress);
      expect(l2ChainId).to.equal(BigInt(31337));
      expect(totalPOIs).to.equal(BigInt(0));
      expect(challengeDuration).to.equal(BigInt(3 * 24 * 60 * 60)); // 3 days
      expect(validatorRewardPercentage).to.equal(BigInt(30));
    });
    
    it("should update L2 contract address", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const newAddress = "0x0000000000000000000000000000000000001234" as Address;
      await l1Contract.write.updateL2Contract([newAddress]);
      const updatedL2Contract = await l1Contract.read.l2DestinationContract();
      expect(updatedL2Contract.toLowerCase()).to.equal(newAddress.toLowerCase());
    });
    
    it("should not allow non-owner to update L2 contract address", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const newAddress = "0x0000000000000000000000000000000000001234" as Address;
      
      // Try to update with non-owner account (should fail)
      try {
        await l1Contract.write.updateL2Contract([newAddress], { account: user });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Only owner can call this function");
      }
      
      // Check that the address didn't change
      const l2DestinationContract = await l1Contract.read.l2DestinationContract();
      expect(l2DestinationContract).to.equal(l2ContractAddress);
    });
    
    it("should register a new POI", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      
      // Register a POI
      await l1Contract.write.registerPOI([poiName, stakeAmount], { 
        account: user,
        value: stakeAmount
      });
      
      // Check POI was registered
      const poi = await l1Contract.read.getPOI([BigInt(0)]);
      // Since we're getting a structured tuple, we need to access it by index
      expect(poi[0]).to.equal(poiName); // name
      expect(poi[1]).to.equal(user.address); // owner
      expect(poi[2]).to.equal(stakeAmount); // stakeAmount
      expect(poi[3]).to.equal(false); // verified
      expect(poi[9]).to.equal(BigInt(1)); // state = VerificationState.Verifying
    });
    
    it("should not allow registering a POI with insufficient stake", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      const insufficientValue = parseEther("0.5");
      
      // Try to register with insufficient value (should fail)
      try {
        await l1Contract.write.registerPOI([poiName, stakeAmount], { 
          account: user,
          value: insufficientValue
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Insufficient stake amount");
      }
      
      // Check no POI was registered
      const totalPOIs = await l1Contract.read.totalPOIs();
      expect(totalPOIs).to.equal(BigInt(0));
    });
    
    it("should not allow registering a POI with empty name", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const emptyName = "";
      const stakeAmount = parseEther("1");
      
      // Try to register with empty name (should fail)
      try {
        await l1Contract.write.registerPOI([emptyName, stakeAmount], { 
          account: user,
          value: stakeAmount
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Name cannot be empty");
      }
      
      // Check no POI was registered
      const totalPOIs = await l1Contract.read.totalPOIs();
      expect(totalPOIs).to.equal(BigInt(0));
    });
    
    it("should successfully resolve POI verification", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      
      // Register a POI
      await l1Contract.write.registerPOI([poiName, stakeAmount], { 
        account: user,
        value: stakeAmount
      });
      
      // Initial validator balance
      const initialValidatorBalance = await publicClient.getBalance({ address: validator.address });
      
      // Resolve the POI with a mock proof
      const mockProof = "0x1234";
      await l1Contract.write.resolvePOI([BigInt(0), validator.address, mockProof], { 
        account: owner
      });
      
      // Check POI was verified
      const poi = await l1Contract.read.getPOI([BigInt(0)]);
      expect(poi[3]).to.equal(true); // verified
      expect(poi[4]).to.equal(validator.address); // validator
      expect(poi[9]).to.equal(BigInt(2)); // state = VerificationState.Verified
      
      // Check validator received reward (30% of stake)
      const expectedReward = (stakeAmount * BigInt(30)) / BigInt(100);
      const finalValidatorBalance = await publicClient.getBalance({ address: validator.address });
      expect(finalValidatorBalance - initialValidatorBalance).to.equal(expectedReward);
    });
    
    it("should allow challenging a verified POI", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      // Register and verify a POI first
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      
      await l1Contract.write.registerPOI([poiName, stakeAmount], { 
        account: user,
        value: stakeAmount
      });
      
      const mockProof = "0x1234";
      await l1Contract.write.resolvePOI([BigInt(0), validator.address, mockProof], { 
        account: owner
      });
      
      // Challenge the POI
      const challengeDeposit = parseEther("0.1");
      await l1Contract.write.challengePOI([BigInt(0)], { 
        account: validator,
        value: challengeDeposit
      });
      
      // Check POI state changed to challenged
      const poi = await l1Contract.read.getPOI([BigInt(0)]);
      expect(poi[7]).to.equal(true); // challenged
      expect(poi[9]).to.equal(BigInt(3)); // state = VerificationState.Challenged
    });
    
    it("should resolve a POI challenge (verify)", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      // Register, verify, and challenge a POI first
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      
      await l1Contract.write.registerPOI([poiName, stakeAmount], { 
        account: user,
        value: stakeAmount
      });
      
      const mockProof = "0x1234";
      await l1Contract.write.resolvePOI([BigInt(0), validator.address, mockProof], { 
        account: owner
      });
      
      const challengeDeposit = parseEther("0.1");
      await l1Contract.write.challengePOI([BigInt(0)], { 
        account: validator,
        value: challengeDeposit
      });
      
      // Advance time by 3 days (challenge duration)
      await advanceTime(3 * 24 * 60 * 60);
      
      // Resolve the challenge (POI is verified)
      await l1Contract.write.resolvePOIChallenge([BigInt(0), true], { 
        account: owner
      });
      
      // Check POI state returned to verified
      const poi = await l1Contract.read.getPOI([BigInt(0)]);
      expect(poi[7]).to.equal(false); // challenged = false
      expect(poi[9]).to.equal(BigInt(2)); // state = VerificationState.Verified
    });
    
    it("should resolve a POI challenge (reject)", async function () {
      const l1Contract = await hre.viem.getContractAt("contracts/L1POIMarketplace.sol:L1POIMarketplace", l1ContractAddress);
      // Register, verify, and challenge a POI first
      const poiName = "Test POI";
      const stakeAmount = parseEther("1");
      
      await l1Contract.write.registerPOI([poiName, stakeAmount], { 
        account: user,
        value: stakeAmount
      });
      
      const mockProof = "0x1234";
      await l1Contract.write.resolvePOI([BigInt(0), validator.address, mockProof], { 
        account: owner
      });
      
      const challengeDeposit = parseEther("0.1");
      await l1Contract.write.challengePOI([BigInt(0)], { 
        account: validator,
        value: challengeDeposit
      });
      
      // Get user's initial balance
      const initialUserBalance = await publicClient.getBalance({ address: user.address });
      
      // Advance time by 3 days (challenge duration)
      await advanceTime(3 * 24 * 60 * 60);
      
      // Resolve the challenge (POI is rejected)
      await l1Contract.write.resolvePOIChallenge([BigInt(0), false], { 
        account: owner
      });
      
      // Check POI state changed to rejected
      const poi = await l1Contract.read.getPOI([BigInt(0)]);
      expect(poi[3]).to.equal(false); // verified = false
      expect(poi[9]).to.equal(BigInt(4)); // state = VerificationState.Rejected
      
      // Check user received refund (minus validator reward)
      const validatorReward = (stakeAmount * BigInt(30)) / BigInt(100);
      const refundAmount = stakeAmount - validatorReward;
      const finalUserBalance = await publicClient.getBalance({ address: user.address });
      
      expect(finalUserBalance - initialUserBalance).to.equal(refundAmount);
    });
  });
  
  describe("L2POIAuction", function () {
    it("should set the constructor parameters correctly", async function () {
      const l2Contract = await hre.viem.getContractAt("contracts/L2POIAuction.sol:L2POIAuction", l2ContractAddress);
      const l1OriginContract = await l2Contract.read.l1OriginContract();
      const l1ChainId = await l2Contract.read.l1ChainId();
      const auctionDuration = await l2Contract.read.auctionDuration();
      const minValidatorReputation = await l2Contract.read.minValidatorReputation();
      const minValidatorStake = await l2Contract.read.minValidatorStake();
      const totalValidators = await l2Contract.read.totalValidators();
      
      expect(l1OriginContract).to.equal(l1ContractAddress);
      expect(l1ChainId).to.equal(BigInt(31337));
      expect(auctionDuration).to.equal(BigInt(24 * 60 * 60)); // 1 day
      expect(minValidatorReputation).to.equal(BigInt(100));
      expect(minValidatorStake).to.equal(parseEther("0.5"));
      expect(totalValidators).to.equal(BigInt(0));
    });
    
    it("should register a validator", async function () {
      const l2Contract = await hre.viem.getContractAt("contracts/L2POIAuction.sol:L2POIAuction", l2ContractAddress);
      const stakeAmount = parseEther("1");
      
      // Register a validator
      await l2Contract.write.registerValidator(["0x"], { 
        account: validator,
        value: stakeAmount
      });
      
      // Check validator was registered
      const validatorInfo = await l2Contract.read.validators([validator.address]);
      expect(validatorInfo[0]).to.equal(true); // isRegistered
      expect(validatorInfo[1]).to.equal(BigInt(0)); // totalVerified
      expect(validatorInfo[2]).to.equal(BigInt(100)); // reputation
      expect(validatorInfo[3]).to.equal(stakeAmount); // stakedAmount
      
      const totalValidators = await l2Contract.read.totalValidators();
      expect(totalValidators).to.equal(BigInt(1));
    });
    
    it("should register validator with higher reputation when proof provided", async function () {
      const l2Contract = await hre.viem.getContractAt("contracts/L2POIAuction.sol:L2POIAuction", l2ContractAddress);
      const stakeAmount = parseEther("1");
      const reputationProof = "0x1234"; // Some mock proof
      
      // Register a validator with reputation proof
      await l2Contract.write.registerValidator([reputationProof], { 
        account: validator,
        value: stakeAmount
      });
      
      // Check validator was registered with higher reputation
      const validatorInfo = await l2Contract.read.validators([validator.address]);
      expect(validatorInfo[0]).to.equal(true); // isRegistered
      expect(validatorInfo[2]).to.equal(BigInt(200)); // reputation (higher because proof provided)
    });
    
    it("should not allow registering with insufficient stake", async function () {
      const l2Contract = await hre.viem.getContractAt("contracts/L2POIAuction.sol:L2POIAuction", l2ContractAddress);
      const insufficientStake = parseEther("0.4"); // Less than minValidatorStake (0.5)
      
      // Try to register with insufficient stake (should fail)
      try {
        await l2Contract.write.registerValidator(["0x"], { 
          account: validator,
          value: insufficientStake
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Insufficient stake amount");
      }
      
      // Check validator was not registered
      const validatorInfo = await l2Contract.read.validators([validator.address]);
      expect(validatorInfo[0]).to.equal(false); // isRegistered
      
      const totalValidators = await l2Contract.read.totalValidators();
      expect(totalValidators).to.equal(BigInt(0));
    });
    
    it("should not allow registering the same validator twice", async function () {
      const l2Contract = await hre.viem.getContractAt("contracts/L2POIAuction.sol:L2POIAuction", l2ContractAddress);
      const stakeAmount = parseEther("1");
      
      // Register validator once
      await l2Contract.write.registerValidator(["0x"], { 
        account: validator,
        value: stakeAmount
      });
      
      // Try to register the same validator again (should fail)
      try {
        await l2Contract.write.registerValidator(["0x"], { 
          account: validator,
          value: stakeAmount
        });
        expect.fail("Should have thrown an error");
      } catch (error: any) {
        expect(error.message).to.include("Already registered as validator");
      }
      
      // Check validator count is still 1
      const totalValidators = await l2Contract.read.totalValidators();
      expect(totalValidators).to.equal(BigInt(1));
    });
    
    // In a real implementation we would test the auction mechanics more thoroughly
    // But since we don't have a way to simulate the cross-chain communication easily in a local test,
    // we'll test the basic validator functionality
  });
}); 