import { parseEther, createWalletClient, http, defineChain, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Type for contract artifacts
interface ContractArtifact {
  abi: any[];
  bytecode: string;
  // other properties...
}

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

  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  // Format private key correctly with 0x prefix if needed
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  try {
    // Create wallet client with private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const deployerAddress = account.address;
    console.log(`Deploying contracts from address: ${deployerAddress}`);
    
    // Get network config from hardhat
    const { network } = hre;
    console.log(`Deploying on network: ${network.name}`);

    // Set up client based on network
    let rpcUrl: string;
    let chainId: number;
    
    if (network.name === 'sepolia') {
      rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://1rpc.io/sepolia';
      chainId = 11155111; // Sepolia chain ID
    } else if (network.name === 't1') {
      rpcUrl = process.env.T1_RPC_URL || 'https://rpc.v006.t1protocol.com';
      chainId = 299792; // T1 chain ID
    } else {
      throw new Error(`Unsupported network: ${network.name}. Please use sepolia or t1.`);
    }
    
    // Define the chain with required properties
    const chain = defineChain({
      id: chainId,
      name: network.name,
      nativeCurrency: {
        decimals: 18,
        name: network.name === 'sepolia' ? 'Sepolia Ether' : 'T1 Ether',
        symbol: 'ETH',
      },
      rpcUrls: {
        default: { http: [rpcUrl] }
      }
    });
    
    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl)
    });
    
    // Deploy contracts based on the current chain/network
    if (network.name === 'sepolia') {
      // Deploying on Sepolia (L1)
      await deployL1Contracts(walletClient, chain, rpcUrl);
    } else if (network.name === 't1') {
      // Deploying on T1 (L2)
      await deployL2Contracts(walletClient, chain, rpcUrl);
    }
  } catch (error) {
    console.error('Deployment error:', error);
    process.exit(1);
  }
}

async function deployL1Contracts(walletClient: any, chain: any, rpcUrl: string) {
  console.log('Deploying L1 POI Marketplace on Sepolia...');
  
  // Set L2 chain ID for T1
  const l2ChainId = 299792;
  
  // Use a placeholder L2 address (can be updated later)
  const placeholderL2Address = zeroAddress;
  
  try {
    // Get contract artifact
    const L1POIMarketplaceArtifact = await hre.artifacts.readArtifact('contracts/L1POIMarketplace.sol:L1POIMarketplace') as ContractArtifact;
    
    // Deploy L1POIMarketplace contract
    console.log("Deploying L1POIMarketplace contract...");
    
    // Send deployment transaction
    const deployHash = await walletClient.deployContract({
      abi: L1POIMarketplaceArtifact.abi,
      bytecode: L1POIMarketplaceArtifact.bytecode as `0x${string}`,
      args: [placeholderL2Address, BigInt(l2ChainId)]
    });
    
    console.log(`L1POIMarketplace deployment transaction sent: ${deployHash}`);
    
    // Create a public client to wait for transaction
    const { createPublicClient } = await import('viem');
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });
    
    console.log('Waiting for transaction receipt...');
    // Wait for transaction receipt
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    
    if (!txReceipt.contractAddress) {
      throw new Error("Contract address not found in transaction receipt");
    }
    
    const l1POIMarketplaceAddress = txReceipt.contractAddress;
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
  } catch (error) {
    console.error('Error deploying L1 contract:', error);
    process.exit(1);
  }
}

async function deployL2Contracts(walletClient: any, chain: any, rpcUrl: string) {
  console.log('Deploying L2 POI Auction on T1...');
  
  // Set L1 chain ID for Sepolia
  const l1ChainId = 11155111;
  
  // Get the L1 contract address from environment or deployment records
  let l1ContractAddress = process.env.L1_CONTRACT_ADDRESS || '';
  
  // If not in environment, try to get from deployment records
  if (!l1ContractAddress) {
    const recordAddress = getContractAddress('sepolia', 'L1POIMarketplace');
    if (!recordAddress) {
      console.error('L1POIMarketplace contract address not found in deployment records or environment.');
      console.error('Please deploy the L1 contract first on Sepolia or set L1_CONTRACT_ADDRESS in .env file.');
      process.exit(1);
    }
    l1ContractAddress = recordAddress;
  }
  
  console.log(`Using L1 contract address: ${l1ContractAddress}`);
  
  try {
    // Get contract artifact
    const L2POIAuctionArtifact = await hre.artifacts.readArtifact('L2POIAuction') as ContractArtifact;
    
    // Deploy L2POIAuction contract
    console.log("Deploying L2POIAuction contract...");
    
    // Send deployment transaction
    const deployHash = await walletClient.deployContract({
      abi: L2POIAuctionArtifact.abi,
      bytecode: L2POIAuctionArtifact.bytecode as `0x${string}`,
      args: [l1ContractAddress, BigInt(l1ChainId)]
    });
    
    console.log(`L2POIAuction deployment transaction sent: ${deployHash}`);
    
    // Create a public client to wait for transaction
    const { createPublicClient } = await import('viem');
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });
    
    console.log('Waiting for transaction receipt...');
    // Wait for transaction receipt
    const txReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    
    if (!txReceipt.contractAddress) {
      throw new Error("Contract address not found in transaction receipt");
    }
    
    const l2POIAuctionAddress = txReceipt.contractAddress;
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
  } catch (error) {
    console.error('Error deploying L2 contract:', error);
    process.exit(1);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 