import { createPublicClient, http, createWalletClient, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import hre from 'hardhat';

async function main() {
  console.log('Deploying POI Marketplace contracts...');

  const { network, viem } = hre;
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  
  const deployerAddress = deployer.account.address;
  console.log(`Deploying contracts from address: ${deployerAddress}`);
  
  // L1 (Sepolia) chain ID = 11155111
  // L2 (T1) chain ID = 299792
  
  // Get current chain
  const currentChainId = await publicClient.getChainId();
  console.log(`Current chain ID: ${currentChainId}`);
  
  if (currentChainId !== 11155111 && currentChainId !== 299792) {
    console.log('Please deploy to either Sepolia or T1 network');
    return;
  }
  
  // Deploy contracts based on the current chain
  if (currentChainId === 11155111) {
    // Deploying on Sepolia (L1)
    await deployL1Contracts(viem, deployer, publicClient);
  } else {
    // Deploying on T1 (L2)
    await deployL2Contracts(viem, deployer, publicClient);
  }
}

async function deployL1Contracts(viem: any, deployer: any, publicClient: any) {
  console.log('Deploying L1 POI Marketplace on Sepolia...');
  
  // Set L2 chain ID for T1
  const l2ChainId = 299792;
  
  // Use a placeholder L2 address (can be updated later)
  const placeholderL2Address = '0x0000000000000000000000000000000000000001';
  
  // Deploy L1POIMarketplace contract
  const L1POIMarketplaceFactory = await viem.getContractFactory('L1POIMarketplace');
  const l1POIMarketplace = await L1POIMarketplaceFactory.deploy(
    placeholderL2Address,
    BigInt(l2ChainId),
    { account: deployer.account }
  );
  
  // Wait for deployment to complete
  const l1POIMarketplaceAddress = await l1POIMarketplace.waitForDeployment();
  console.log(`L1POIMarketplace deployed to: ${l1POIMarketplaceAddress}`);
  
  // Save deployment info to file for future reference
  const deploymentInfo = {
    network: "sepolia",
    l1Contract: l1POIMarketplaceAddress,
    deploymentTime: new Date().toISOString()
  };
  
  console.log("Waiting for block confirmations before verification...");
  // Wait for several block confirmations to ensure the contract is properly deployed
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
  
  // Verify the contract
  try {
    console.log("Verifying contract on Etherscan...");
    
    await hre.run("verify:verify", {
      address: l1POIMarketplaceAddress,
      constructorArguments: [
        placeholderL2Address,
        l2ChainId
      ],
      network: "sepolia"
    });
    
    console.log("Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified");
    } else {
      console.log("Error verifying contract:", error);
      console.log("\nTo manually verify the contract on Etherscan:");
      console.log(`npx hardhat verify --network sepolia ${l1POIMarketplaceAddress} ${placeholderL2Address} ${l2ChainId}`);
    }
  }
  
  // Instructions for updating with the actual L2 contract address
  console.log('\nAfter deploying the L2 contract, update the L1 contract with:');
  console.log(`L1POIMarketplace at ${l1POIMarketplaceAddress}.updateL2Contract(YOUR_L2_CONTRACT_ADDRESS)`);
}

async function deployL2Contracts(viem: any, deployer: any, publicClient: any) {
  console.log('Deploying L2 POI Auction on T1...');
  
  // Set L1 chain ID for Sepolia
  const l1ChainId = 11155111;
  
  // Get the L1 contract address (input from the user)
  const l1ContractAddress = process.env.L1_CONTRACT_ADDRESS;
  if (!l1ContractAddress) {
    console.error('Please set L1_CONTRACT_ADDRESS in your environment variables');
    process.exit(1);
  }
  
  // Deploy L2POIAuction contract
  const L2POIAuctionFactory = await viem.getContractFactory('L2POIAuction');
  const l2POIAuction = await L2POIAuctionFactory.deploy(
    l1ContractAddress,
    BigInt(l1ChainId),
    { account: deployer.account }
  );
  
  // Wait for deployment to complete
  const l2POIAuctionAddress = await l2POIAuction.waitForDeployment();
  console.log(`L2POIAuction deployed to: ${l2POIAuctionAddress}`);
  
  // Save deployment info to file for future reference
  const deploymentInfo = {
    network: "t1",
    l2Contract: l2POIAuctionAddress,
    l1Contract: l1ContractAddress,
    deploymentTime: new Date().toISOString()
  };
  
  console.log("Waiting for block confirmations before verification...");
  // Wait for several block confirmations to ensure the contract is properly deployed
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
  
  // Verify the contract
  try {
    console.log("Verifying contract on T1 Explorer...");
    
    await hre.run("verify:verify", {
      address: l2POIAuctionAddress,
      constructorArguments: [
        l1ContractAddress,
        l1ChainId
      ],
      network: "t1"
    });
    
    console.log("Contract verified successfully!");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract already verified");
    } else {
      console.log("Error verifying contract:", error);
      console.log("\nTo manually verify the contract on T1 Explorer:");
      console.log(`npx hardhat verify --network t1 ${l2POIAuctionAddress} ${l1ContractAddress} ${l1ChainId}`);
    }
  }
  
  // Instructions for updating the L1 contract with this L2 address
  console.log('\nUpdate your L1 contract with this L2 address:');
  console.log(`Call updateL2Contract(${l2POIAuctionAddress}) on your L1 contract at ${l1ContractAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 