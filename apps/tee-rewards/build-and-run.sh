#!/bin/bash

set -e

echo "Building and running TEE Rewards with Enarx in Docker"

# Create required directories if they don't exist
mkdir -p web-interface/src
mkdir -p data

# Make sure the Dockerfile, docker-compose.yml and web-interface files exist
if [ ! -f Dockerfile ]; then
  echo "Error: Dockerfile not found!"
  exit 1
fi

if [ ! -f docker-compose.yml ]; then
  echo "Error: docker-compose.yml not found!"
  exit 1
fi

if [ ! -f web-interface/Cargo.toml ]; then
  echo "Error: web-interface/Cargo.toml not found!"
  exit 1
fi

if [ ! -f web-interface/src/main.rs ]; then
  echo "Error: web-interface/src/main.rs not found!"
  exit 1
fi

# Build and run with Docker Compose
echo "Starting Docker Compose..."
docker-compose up --build

echo "Done!" 