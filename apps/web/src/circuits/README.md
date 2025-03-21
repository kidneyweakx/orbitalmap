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

# Zero-Knowledge Circuit Integration Guide

This document explains how the Zero-Knowledge (ZK) verification is integrated into the web application using Noir circuits.

## Circuit Structure

The main dispatcher circuit (`main.nr`) handles five different proof types. Each proof has specific constraints:

1. **Proof of Visit**
   - Proves user visited a location without revealing exact coordinates
   - Main constraint: `assert(x != 0)`
   - Additional constraints in `proof_of_visit.nr`:
     - Location hash matches
     - Visit timestamp is within allowed time window

2. **Reputation Proof**
   - Proves user's reputation score is above a threshold
   - Main constraint: `assert((x as i64) >= (y as i64))`
   - Where `x` is actual score and `y` is threshold

3. **Ownership Proof**
   - Proves token ownership without revealing exact balance
   - Main constraint: `assert(x != 0)`
   - Additional constraints in `ownership_proofs.nr`:
     - Token balance >= minimum required

4. **Trustless Commitment**
   - Facilitates peer-to-peer commitments without a trusted third party
   - Main constraint: `assert(x != 0)`
   - Additional constraints in `trustless_commitments.nr`:
     - Task commitment valid
     - Deadline is in the future

5. **Explorer Badge**
   - Proves user has visited enough locations to earn a badge
   - Main constraint: `assert(x != 0)`
   - Additional constraints in `local_explorer_badge.nr`:
     - JWT signature valid
     - Visit count >= required minimum

## Integration Details

To generate a proof:

1. The frontend calls into `ZKService.ts`, which prepares the inputs and handles conversions
2. Inputs are normalized to integers and converted to BigInt
3. The circuit is compiled from Noir to JSON and loaded from the `/public/circuits` directory
4. The Noir backend (UltraHonkBackend) executes the circuit with the inputs
5. The proof is generated and returned as a string

To verify a proof:

1. The proof data (proof and public inputs) is passed to the verification function
2. The UltraHonkBackend verifies the proof cryptographically
3. The result (true/false) is returned

## Troubleshooting

Common errors:

- **"unwrap_throw" error**: Circuit constraints are not satisfied. Double-check that all input values satisfy the required conditions.
- **Type errors**: Ensure all numeric inputs are normalized properly before converting to BigInt.
- **Circuit loading errors**: Make sure the circuit JSON file is correctly copied to the `/public/circuits` directory.

## Implementation Notes

This is a simplified implementation for demonstration purposes. In a production environment:

1. The circuits would be more complex with proper cryptographic hash functions
2. The frontend would have more robust input validation
3. A secure backend would handle sensitive operations
4. The JWT verification in the Explorer Badge would be fully implemented

## Testing

Test each proof type with valid inputs first to ensure the basic flow works. Then test with invalid inputs to verify constraint checking works properly.

For realistic testing of Proof of Visit, use coordinates that would hash to non-zero values and timestamps within the last 24 hours. 