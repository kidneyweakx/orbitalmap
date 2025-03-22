#!/bin/bash
set -e

# Configuration
DOCKER_IMAGE="kidneyweakx/oyster-rewards"
TAG="latest"
DEPLOYMENT_DURATION=15 # minutes

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Oyster Rewards Deployment Script ===${NC}"

# Check if private key is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Wallet private key is required${NC}"
    echo -e "Usage: ./deploy.sh <wallet-private-key> [duration_minutes]"
    exit 1
fi

WALLET_PRIVATE_KEY=$1

# Check if custom duration is provided
if [ ! -z "$2" ]; then
    DEPLOYMENT_DURATION=$2
fi

# Step 1: Build and push the Docker image
build_and_push() {
    echo -e "${YELLOW}Building and pushing Docker image ${DOCKER_IMAGE}:${TAG}...${NC}"
    docker build -t ${DOCKER_IMAGE}:${TAG} .
    docker push ${DOCKER_IMAGE}:${TAG}
    echo -e "${GREEN}Docker image pushed successfully!${NC}"
}

# Step 2: Deploy to Oyster CVM
deploy_to_cvm() {
    echo -e "${YELLOW}Deploying to Oyster CVM for ${DEPLOYMENT_DURATION} minutes...${NC}"
    oyster-cvm deploy --wallet-private-key ${WALLET_PRIVATE_KEY} --duration-in-minutes ${DEPLOYMENT_DURATION} --docker-compose docker-compose.yml
    echo -e "${GREEN}Deployment initiated successfully!${NC}"
}

# Choose action based on arguments
case "${3:-deploy}" in
    build)
        build_and_push
        ;;
    deploy)
        deploy_to_cvm
        ;;
    all)
        build_and_push
        deploy_to_cvm
        ;;
    *)
        # Default to deploy only since image was already pushed
        deploy_to_cvm
        ;;
esac

echo -e "${GREEN}Deployment process completed!${NC}"
echo -e "${YELLOW}To stop the deployment, run: ./stop.sh <wallet-private-key>${NC}" 