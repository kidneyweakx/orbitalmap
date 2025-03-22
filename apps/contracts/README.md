# Point of Interest (POI) Marketplace Contracts

This project implements a trusted POI marketplace using ERC-7683 for cross-chain bidding and verification between L1 (Sepolia) and L2 (T1).

## Architecture

The POI marketplace consists of two main contracts:

1. **L1POIMarketplace**: Operates on Sepolia (L1)
   - Registers new POIs
   - Initiates cross-chain verification requests
   - Receives verification results from L2
   - Manages POI challenges and final verification

2. **L2POIAuction**: Operates on T1 (L2)
   - Manages validator registration
   - Runs auctions for POI verification
   - Handles TEE+ZK verification of POIs
   - Sends verification results back to L1

## Cross-Chain Communication

The marketplace uses ERC-7683 for cross-chain communication:
- L1 sends verification requests to L2 via the `openFor` function
- L2 processes auctions and verification
- L2 sends results back to L1 for final settlement

## Key Features

- **Trustless POI Registration**: Users can register POIs with a stake
- **Auction-Based Verification**: Validators compete to verify POIs through bidding
- **TEE+ZK Verification**: Uses Trusted Execution Environment and Zero Knowledge proofs for secure verification
- **Challenge System**: Allows disputing potentially fraudulent POIs
- **Validator Reputation**: Tracks validator performance over time

## Installation

```bash
bun install
```

## Development

```bash
bun run hardhat compile
```

## Testing

```bash
bun run hardhat test
```

## Deployment

First, modify the hardhat.config.ts file with your network settings, then:

```bash
bun run hardhat run scripts/deploy.ts --network sepolia
```

This project uses Hardhat for development and was created with bun v1.2.5.
