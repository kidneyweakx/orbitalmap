# POI Marketplace Contracts

This project implements a Trusted POI (Point of Interest) Marketplace using ERC-7683 for cross-chain bidding and verification between L1 (Sepolia) and L2 (T1).

## Features

- POI Registration with staking on L1
- Cross-chain validator auction on L2
- TEE+ZK Proof for POI verification
- Challenge mechanism for incorrect POIs
- Reward distribution for validators
- Deployment scripts for L1 and L2 contracts
- Automated contract verification

## Project Structure

```
contracts/
├── contracts/            # Smart contract source files
│   ├── L1POIMarketplace.sol    # L1 contract for POI registration
│   ├── L2POIAuction.sol        # L2 contract for validator auctions
│   └── interfaces/            # Interface definitions
├── scripts/              # Deployment and utility scripts
├── test/                 # Test files
├── deployments/          # Deployment records (contract addresses)
└── .env.example          # Environment variable template
```

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the environment template and add your private key and API keys:

```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - `PRIVATE_KEY`: Your wallet private key for deployment
   - `ETHERSCAN_API_KEY`: For contract verification on Sepolia

## Testing

Run the test suite:

```bash
bun run test
```

## Deployment

The deployment process uses a JSON file (`deployments/contracts.json`) to store and track deployed contract addresses across networks. This eliminates the need to manually manage contract addresses in environment variables.

### Deploy L1 Contract (Sepolia)

```bash
bun run deploy:sepolia
```

This will:
1. Deploy the L1POIMarketplace contract to Sepolia
2. Save the contract address to the deployments file
3. Automatically verify the contract on Etherscan

### Deploy L2 Contract (T1)

```bash
bun run deploy:t1
```

This will:
1. Read the L1 contract address from the deployments file
2. Deploy the L2POIAuction contract to T1
3. Save the contract address to the deployments file
4. Automatically verify the contract on T1 Explorer

### Update L1 Contract with L2 Address

```bash
bun run update:l1
```

This will:
1. Read both contract addresses from the deployments file
2. Update the L1 contract with the L2 address
3. Verify the update was successful

### One-Step Deployment

To deploy both contracts and update the L1 contract in one command:

```bash
bun run deploy:all
```

## Contract Addresses

Contract addresses are stored in `deployments/contracts.json` after deployment. You can also view them by checking the console output after deployment.

If you need to override the addresses, you can set them in your `.env` file:
- `L1_CONTRACT_ADDRESS`: To override the L1 contract address
- `L2_CONTRACT_ADDRESS`: To override the L2 contract address

## Advanced Usage

### Dry Run Mode

To simulate the update process without sending transactions:

```bash
bun run update:l1:dry
```

### Manual Verification

If automatic verification fails, you can verify the contracts manually using:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
npx hardhat verify --network t1 <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Architecture

The POI Marketplace consists of two main contracts:

1. **L1POIMarketplace (Sepolia)**: Handles POI registration, staking, and validation results.
2. **L2POIAuction (T1)**: Manages validator auctions and proof verification using TEE+ZK.

Cross-chain communication is facilitated through ERC-7683.
