# TreasureBox Components

This directory contains the components that make up the TreasureBox feature in OrbitalMap.

## Overview

The TreasureBox feature enables users to interact with blockchain-based Points of Interest (POIs) on the map. Users can subscribe to premium POIs, view auction data for POI verification, and share private locations through a Trusted Execution Environment (TEE).

## Components

### TreasureBox

The main container component that manages the overall UI and state of the feature. It handles:
- Switching between L1 card, L2 card, and PrivateShareForm
- Integration with the map interface
- Area selection and POI subscription

### L1Card

Handles interactions with the POI Marketplace on the Sepolia testnet (L1). Features include:
- Viewing available premium POIs in a selected area
- Subscribing to POIs with the user's wallet
- Checking subscription status for POIs

### L2Card

Manages interactions with the POI Auction system on the T1 protocol (L2). Features include:
- Viewing auction data for POI verification
- Displaying bid information
- Showing auction status and results

### PrivateShareForm

Allows users to share private location data through the Marlin TEEZone. Features include:
- Secure submission of location data
- Integration with the TEE API
- Privacy protection for sensitive location information

## Smart Contract Integration

The TreasureBox components integrate with smart contracts deployed on:
- Sepolia testnet (L1) - POI Marketplace
- T1 protocol (L2) - POI Auction and verification

### Contract Functions

The following contract functions are available:

#### L1 Contract (Sepolia)

- **registerPOI(name, lat, lng, requireSubscription, subscriptionPrice)**
  - Register a new POI with stake
  - Requires ETH for staking the POI
  
- **subscribeToPOI(poiId)**
  - Subscribe to a premium POI
  - Requires ETH payment for subscription
  
- **challengePOI(poiId)**
  - Challenge an incorrectly verified POI
  - Requires ETH for the challenge stake
  
- **getPOI(poiId)**
  - Get detailed information about a POI

#### L2 Contract (T1)

- **placeBid(poiId, bidAmount)**
  - Place a bid to verify a POI
  - Requires T1 native token payment
  
- **submitProof(poiId, proof)**
  - Submit verification proof from TEE
  - Only callable by the winning bidder

## Wallet Integration

The TreasureBox uses Privy for wallet management and blockchain interactions:

```typescript
// Example of subscribing to a POI
const provider = await embeddedWallet?.getEthereumProvider();
const result = await subscribeToPOI(
  provider, 
  BigInt(poiId), 
  subscriptionPrice
);

if (result.success) {
  console.log("Successfully subscribed to POI", result.txHash);
}
```

## Usage

```tsx
import { TreasureBox } from './components/treasure';

// In your component
<TreasureBox 
  onClose={() => setShowTreasureBox(false)}
  selectedArea={selectedArea}
  pois={poisInArea}
  onSubscriptionSuccess={handleSubscriptionSuccess}
  isToolboxMode={true}
/>
```

## Integration with Toolbox

The TreasureBox is integrated with the Navbar's toolbox menu, allowing users to:
1. Open the TreasureBox from the toolbox
2. Select the current map area for exploring POIs
3. Interact with L1/L2 contracts and TEE services

## TEE Integration

The PrivateShareForm component integrates with Marlin's TEEZone for secure handling of private location data, ensuring that sensitive information is processed within a trusted execution environment. 