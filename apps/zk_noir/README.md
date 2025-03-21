# ZK Noir Proofs

This project implements four privacy-preserving zero-knowledge proof mechanisms using Noir. These proofs can be integrated into applications to enhance privacy while maintaining verifiability.

## Features

### 1. Proof of Visit
Allows users to prove they visited a specific location without revealing their exact GPS coordinates.
- Hash-based location verification
- Time-bound validation
- Privacy-preserving location proofs

### 2. Reputation Proofs
Enables users to prove their reputation metrics meet certain thresholds without revealing exact values.
- Reputation score threshold verification
- Task completion count verification
- Reward value threshold verification

### 3. Ownership Proofs
Permits users to prove ownership of assets (NFTs, tokens, badges) without revealing specific IDs or quantities.
- NFT ownership verification using Merkle proofs
- Token balance threshold verification
- Rare badge ownership verification

### 4. Trustless Commitments
Facilitates peer-to-peer commitments without requiring a central trusted party.
- Task commitment creation and verification
- Deposit verification
- Completion verification with deadline enforcement

## Getting Started

### Prerequisites
- [Noir](https://noir-lang.org/) installed
- Basic understanding of zero-knowledge proofs

### Building the Project
```bash
cd apps/zk_noir
nargo build
```

### Running Tests
```bash
nargo test
```

## Usage Examples

### Proof of Visit
```rust
// Client-side (prover)
let location_hash = hash_location(latitude, longitude);
let visit_time = current_timestamp();

// Generate proof...

// Verifier-side
// Only the hash and time bounds are revealed, not actual coordinates
verify_proof(location_hash, visit_time, current_time, max_allowed_time_diff);
```

### Reputation Proof
```rust
// Client-side (prover)
let user_score = get_user_score(); // Private
let min_required = 80; // Public threshold

// Generate proof...

// Verifier-side
// Only knows the user's score is ≥ 80, but not the exact value
verify_proof(min_required);
```

### Ownership Proof
```rust
// Client-side (prover)
let nft_id = get_user_nft_id(); // Private
let nft_hash = hash(nft_id);
let merkle_proof = generate_merkle_proof(nft_hash);

// Generate proof...

// Verifier-side
// Only knows the user owns an NFT in the collection, but not which one
verify_proof(collection_merkle_root, merkle_proof);
```

### Trustless Commitment
```rust
// Create commitment
let task_commitment = create_task_commitment(
    task_description,
    deadline,
    deposit_amount,
    reward_amount
);

// Prove completion
prove_task_completed(
    task_commitment,
    task_hash,
    completion_proof,
    current_time
);
```

## Architecture

Each proof mechanism is implemented in its own module:
- `proof_of_visit.nr`
- `reputation_proofs.nr`
- `ownership_proofs.nr`
- `trustless_commitments.nr`

The `main.nr` file provides a simple dispatcher to select which proof to generate or verify.

## License
MIT 