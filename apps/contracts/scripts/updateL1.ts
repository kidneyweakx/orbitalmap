import hre from 'hardhat';
import 'dotenv/config';
import { Address, getAddress } from 'viem';

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
  
  // Get L1 contract address
  const l1ContractAddress = process.env.L1_CONTRACT_ADDRESS as Address;
  if (!l1ContractAddress) {
    console.error('L1_CONTRACT_ADDRESS not set in .env file');
    process.exit(1);
  }
  
  // Get L2 contract address
  const l2ContractAddress = process.env.L2_CONTRACT_ADDRESS as Address;
  if (!l2ContractAddress) {
    console.error('L2_CONTRACT_ADDRESS not set in .env file');
    process.exit(1);
  }
  
  console.log(`L1 Contract: ${l1ContractAddress}`);
  console.log(`L2 Contract: ${l2ContractAddress}`);
  
  try {
    // Get L1POIMarketplace ABI
    const { abi } = await hre.artifacts.readArtifact('contracts/L1POIMarketplace.sol:L1POIMarketplace');
    
    // Read current L2 contract address
    const currentL2 = await publicClient.readContract({
      address: l1ContractAddress,
      abi,
      functionName: 'l2DestinationContract',
      args: []
    });
    
    console.log(`Current L2 contract in L1: ${currentL2}`);
    
    if (getAddress(currentL2 as string) === getAddress(l2ContractAddress)) {
      console.log('L1 contract already has correct L2 address. No update needed.');
      return;
    }
    
    console.log('Updating L1 contract with new L2 address...');
    
    if (isDryRun) {
      console.log('DRY RUN: Would update L2 address to', l2ContractAddress);
      console.log('Transaction not sent due to DRY_RUN=true');
      return;
    }
    
    // Update L2 contract address
    const hash = await deployer.writeContract({
      address: l1ContractAddress,
      abi,
      functionName: 'updateL2Contract',
      args: [l2ContractAddress]
    });
    
    console.log(`Transaction hash: ${hash}`);
    console.log('Waiting for transaction to be mined...');
    
    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('L1 contract updated successfully!');
      
      // Verify the update
      const newL2 = await publicClient.readContract({
        address: l1ContractAddress,
        abi,
        functionName: 'l2DestinationContract',
        args: []
      });
      
      console.log(`New L2 contract in L1: ${newL2}`);
      
      if (getAddress(newL2 as string) === getAddress(l2ContractAddress)) {
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