#!/bin/bash

# Exit script if any command fails
set -e

# Change to the zk_noir directory
cd "$(dirname "$0")"

# Build the Noir project
echo "Building the Noir project..."
nargo build

# Get the artifact name from Nargo.toml
ARTIFACT_NAME=$(grep "name" Nargo.toml | cut -d '"' -f 2)
echo "Using artifact name: $ARTIFACT_NAME"

# Generate verification key with keccak as the hash function
echo "Generating verification key..."
bb write_vk -b ./target/${ARTIFACT_NAME}.json -o ./target --oracle_hash keccak

# Create target directory in the contracts project if it doesn't exist
CONTRACTS_TARGET_DIR="../contracts/contracts/verifier"
mkdir -p $CONTRACTS_TARGET_DIR

# Generate the Solidity verifier
echo "Generating Solidity verifier..."
bb write_solidity_verifier -k ./target/vk -o $CONTRACTS_TARGET_DIR/Verifier.sol

echo "Verifier contract successfully generated at $CONTRACTS_TARGET_DIR/Verifier.sol" 