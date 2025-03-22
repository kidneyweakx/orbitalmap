import hre from 'hardhat';
import 'dotenv/config';
import { Address, getAddress } from 'viem';
import fs from 'fs';
import path from 'path';

// 從 deploy.ts 複製的部署記錄管理程式碼
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

// 部署記錄文件的路徑
const DEPLOYMENTS_DIR = path.join(__dirname, '../deployments');
const DEPLOYMENTS_FILE = path.join(DEPLOYMENTS_DIR, 'contracts.json');

// 加載現有的部署記錄
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

// 從部署記錄中獲取合約地址
function getContractAddress(network: string, contract: string): string | null {
  const records = loadDeploymentRecords();
  if (!records.networks[network] || !records.networks[network].contracts[contract]) {
    return null;
  }
  return records.networks[network].contracts[contract];
}

async function main() {
  const isDryRun = process.env.DRY_RUN === 'true';
  if (isDryRun) {
    console.log('Running in DRY RUN mode - no transactions will be sent');
  }
  
  console.log('Updating L1 contract with L2 contract address...');

  const { viem } = hre;
  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  
  const deployerAddress = deployer.account.address;
  console.log(`Updating from address: ${deployerAddress}`);
  
  // 從部署記錄中獲取 L1 合約地址
  const l1ContractAddress = getContractAddress('sepolia', 'L1POIMarketplace') as Address;
  if (!l1ContractAddress) {
    console.error('L1POIMarketplace contract address not found in deployment records.');
    console.error('Please deploy the L1 contract first on Sepolia.');
    process.exit(1);
  }
  
  // 從部署記錄中獲取 L2 合約地址
  const l2ContractAddress = getContractAddress('t1', 'L2POIAuction') as Address;
  if (!l2ContractAddress) {
    console.error('L2POIAuction contract address not found in deployment records.');
    console.error('Please deploy the L2 contract first on T1.');
    process.exit(1);
  }
  
  console.log(`L1 Contract: ${l1ContractAddress}`);
  console.log(`L2 Contract: ${l2ContractAddress}`);
  
  // 也允許通過環境變量覆蓋地址
  const envL1Address = process.env.L1_CONTRACT_ADDRESS as Address;
  const envL2Address = process.env.L2_CONTRACT_ADDRESS as Address;
  
  const finalL1Address = envL1Address || l1ContractAddress;
  const finalL2Address = envL2Address || l2ContractAddress;
  
  if (envL1Address) {
    console.log(`Using L1 address from environment: ${envL1Address}`);
  }
  
  if (envL2Address) {
    console.log(`Using L2 address from environment: ${envL2Address}`);
  }
  
  try {
    // 獲取 L1POIMarketplace ABI
    const { abi } = await hre.artifacts.readArtifact('contracts/L1POIMarketplace.sol:L1POIMarketplace');
    
    // 讀取當前的 L2 合約地址
    const currentL2 = await publicClient.readContract({
      address: finalL1Address,
      abi,
      functionName: 'l2DestinationContract',
      args: []
    });
    
    console.log(`Current L2 contract in L1: ${currentL2}`);
    
    if (getAddress(currentL2 as string) === getAddress(finalL2Address)) {
      console.log('L1 contract already has correct L2 address. No update needed.');
      return;
    }
    
    console.log('Updating L1 contract with new L2 address...');
    
    if (isDryRun) {
      console.log('DRY RUN: Would update L2 address to', finalL2Address);
      console.log('Transaction not sent due to DRY_RUN=true');
      return;
    }
    
    // 更新 L2 合約地址
    const hash = await deployer.writeContract({
      address: finalL1Address,
      abi,
      functionName: 'updateL2Contract',
      args: [finalL2Address]
    });
    
    console.log(`Transaction hash: ${hash}`);
    console.log('Waiting for transaction to be mined...');
    
    // 等待交易被挖掘
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('L1 contract updated successfully!');
      
      // 驗證更新
      const newL2 = await publicClient.readContract({
        address: finalL1Address,
        abi,
        functionName: 'l2DestinationContract',
        args: []
      });
      
      console.log(`New L2 contract in L1: ${newL2}`);
      
      if (getAddress(newL2 as string) === getAddress(finalL2Address)) {
        console.log('Update verified successfully.');
      } else {
        console.log('Warning: Update verification failed. Please check manually.');
      }
    } else {
      console.log('Transaction failed. Please try again.');
    }
  } catch (error) {
    console.error('Error updating L1 contract:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 