import { ethers } from "hardhat";

async function main() {
  console.log('Deploying POI Marketplace contracts...');

  // Deploy L1 contract first (demo purposes - normally L1 and L2 would be on different networks)
  // For testing, we'll use placeholder addresses and chain IDs
  const l2ChainId = 10121; // Placeholder for T1 chain ID
  const placeholderL2Address = '0x0000000000000000000000000000000000000001'; // Temporary placeholder

  // Deploy L1 contract with placeholder L2 address
  const L1POIMarketplace = await ethers.getContractFactory('L1POIMarketplace');
  const l1Contract = await L1POIMarketplace.deploy(placeholderL2Address, l2ChainId);
  await l1Contract.waitForDeployment();

  console.log(`L1POIMarketplace deployed to: ${await l1Contract.getAddress()}`);

  // Now deploy L2 contract with real L1 address
  const l1ChainId = 11155111; // Sepolia chain ID
  const L2POIAuction = await ethers.getContractFactory('L2POIAuction');
  const l2Contract = await L2POIAuction.deploy(await l1Contract.getAddress(), l1ChainId);
  await l2Contract.waitForDeployment();

  console.log(`L2POIAuction deployed to: ${await l2Contract.getAddress()}`);

  // Now that we have the real L2 address, update the L1 contract
  // Add this function to L1POIMarketplace if needed
  if (typeof l1Contract.updateL2Contract === 'function') {
    const tx = await l1Contract.updateL2Contract(await l2Contract.getAddress());
    await tx.wait();
    console.log('Updated L1 contract with correct L2 address');
  } else {
    console.log('Note: L1 contract does not have an updateL2Contract function');
  }

  console.log('Deployment complete!');

  // Verification instructions
  console.log('\nTo verify the contracts on Etherscan:');
  console.log(`npx hardhat verify --network sepolia ${await l1Contract.getAddress()} ${placeholderL2Address} ${l2ChainId}`);
  console.log(`npx hardhat verify --network t1 ${await l2Contract.getAddress()} ${await l1Contract.getAddress()} ${l1ChainId}`);
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 