# Zero-Knowledge Verification in OrbitalMap

This directory contains documentation and example code for the Zero-Knowledge verification features in OrbitalMap.

## Available ZK Proofs

OrbitalMap supports the following types of zero-knowledge proofs:

1. **Proof of Visit** - Prove you visited a location without revealing your exact GPS coordinates
2. **Reputation Proofs** - Prove your reputation score exceeds a threshold without revealing the exact score
3. **Ownership Proofs** - Prove you own specific assets (NFTs, tokens) without revealing which ones
4. **Trustless Commitments** - Create peer-to-peer commitments without relying on central authorities
5. **Local Explorer Badge** - Prove you've visited enough locations to earn badges without revealing which locations

## Implementation

For the hackathon demo, we're using a mock implementation that simulates ZK proof generation and verification. In a production environment, this would be replaced with actual Noir ZK circuit compilation and proof generation using the following libraries:

- `@noir-lang/noir_wasm` - For compiling Noir circuits in the browser
- `@noir-lang/noir_js` - For interacting with compiled Noir programs
- `@aztec/bb.js` - The Barretenberg backend for Noir

## Integration with Noir

The real implementation would load and compile Noir circuit files from our `zk_noir` application. The circuit files include:

- `main.nr` - Main entry point that dispatches to the appropriate ZK circuit
- `proof_of_visit.nr` - Implementation of location visit proofs
- `reputation_proofs.nr` - Implementation of reputation-based proofs
- `ownership_proofs.nr` - Implementation of asset ownership proofs
- `trustless_commitments.nr` - Implementation of P2P commitment proofs
- `local_explorer_badge.nr` - Implementation of explorer badge proofs

## Getting Started

To use ZK verification in your own development:

1. Install the required dependencies:
   ```
   npm install @noir-lang/noir_wasm @noir-lang/noir_js @aztec/bb.js
   ```

2. Import the ZK service utilities:
   ```typescript
   import { 
     generateProofOfVisit,
     generateReputationProof,
     generateOwnershipProof,
     generateCommitmentProof,
     generateExplorerBadgeProof,
     verifyProof
   } from '../utils/ZKService';
   ```

3. Use the appropriate function for the type of proof you need:
   ```typescript
   // Example: Generate a proof of visit
   const locationHash = 12345;
   const timestamp = Date.now();
   const proof = await generateProofOfVisit(locationHash, timestamp);
   
   // Verify the proof
   const isValid = await verifyProof(proof);
   ```

## Resources

- [Noir Documentation](https://noir-lang.org/)
- [Noir JWT Library](https://github.com/zkemail/noir-jwt)
- [Noir Sample Circuits](https://github.com/noir-lang/noir/tree/master/examples) 