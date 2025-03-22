import { createPublicClient, http, createWalletClient, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

// Contract addresses record management
interface DeploymentRecord {
  networks: {
    [network: string]: {
      contracts: {
        [contract: string]: string;
      };
      deploymentTime: string;
    };
  };
}

// Path to the deployment records file
const DEPLOYMENTS_DIR = path.join(__dirname, '../deployments');
const DEPLOYMENTS_FILE = path.join(DEPLOYMENTS_DIR, 'contracts.json');

// Function to load existing deployment records
function loadDeploymentRecords(): DeploymentRecord {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DEPLOYMENTS_FILE)) {
    return { networks: {} };
  }
  
  try {
    const content = fs.readFileSync(DEPLOYMENTS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Error reading deployments file, creating a new one');
    return { networks: {} };
  }
}

// Function to save deployment records
function saveDeploymentRecords(records: DeploymentRecord) {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(records, null, 2));
  console.log(`Deployment records saved to ${DEPLOYMENTS_FILE}`);
}

// Function to get contract address from deployment records
function getContractAddress(network: string, contract: string): string | null {
  const records = loadDeploymentRecords();
  if (!records.networks[network] || !records.networks[network].contracts[contract]) {
    return null;
  }
  return records.networks[network].contracts[contract];
}

// Function to save contract address to deployment records
function saveContractAddress(network: string, contract: string, address: string) {
  const records = loadDeploymentRecords();
  
  if (!records.networks[network]) {
    records.networks[network] = {
      contracts: {},
      deploymentTime: new Date().toISOString()
    };
  }
  
  records.networks[network].contracts[contract] = address;
  records.networks[network].deploymentTime = new Date().toISOString();
  
  saveDeploymentRecords(records);
}

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
  
  // Save contract address to deployment records
  saveContractAddress('sepolia', 'L1POIMarketplace', l1POIMarketplaceAddress);
  
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
  
  console.log("\n------------------------------------------------------");
  console.log("Next steps:");
  console.log("1. Deploy the L2 contract on T1 using `bun run deploy:t1`");
  console.log("2. Update the L1 contract with the L2 address using `bun run update:l1`");
  console.log("------------------------------------------------------\n");
}

async function deployL2Contracts(viem: any, deployer: any, publicClient: any) {
  console.log('Deploying L2 POI Auction on T1...');
  
  // Set L1 chain ID for Sepolia
  const l1ChainId = 11155111;
  
  // Get the L1 contract address from deployment records
  const l1ContractAddress = getContractAddress('sepolia', 'L1POIMarketplace');
  if (!l1ContractAddress) {
    console.error('L1POIMarketplace contract address not found in deployment records.');
    console.error('Please deploy the L1 contract first on Sepolia.');
    process.exit(1);
  }
  
  console.log(`Using L1 contract address: ${l1ContractAddress}`);
  
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
  
  // Save contract address to deployment records
  saveContractAddress('t1', 'L2POIAuction', l2POIAuctionAddress);
  
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
  
  console.log("\n------------------------------------------------------");
  console.log("Next steps:");
  console.log("1. Update the L1 contract with the L2 address using `bun run update:l1`");
  console.log("------------------------------------------------------\n");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 