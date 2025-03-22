#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Oyster Rewards Stop Script ===${NC}"

# Check if private key is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Wallet private key is required${NC}"
    echo -e "Usage: ./stop.sh <wallet-private-key> [deployment-id]"
    exit 1
fi

WALLET_PRIVATE_KEY=$1
DEPLOYMENT_ID=$2

if [ -z "$DEPLOYMENT_ID" ]; then
    # List deployments and prompt user to select one
    echo -e "${YELLOW}Retrieving active deployments...${NC}"
    DEPLOYMENTS=$(oyster-cvm list --wallet-private-key ${WALLET_PRIVATE_KEY})
    
    if [ -z "$DEPLOYMENTS" ] || [ "$DEPLOYMENTS" == "No deployments found" ]; then
        echo -e "${RED}No active deployments found${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Found active deployments:${NC}"
    echo "$DEPLOYMENTS"
    
    echo -e "${YELLOW}Please enter the Deployment ID to stop from the list above:${NC}"
    read -p "> " SELECTED_ID
    
    DEPLOYMENT_ID=$SELECTED_ID
    
    if [ -z "$DEPLOYMENT_ID" ]; then
        echo -e "${RED}No deployment ID selected. Exiting.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Using provided deployment ID: ${DEPLOYMENT_ID}${NC}"
fi

# Stop the deployment
echo -e "${YELLOW}Stopping deployment ${DEPLOYMENT_ID}...${NC}"
oyster-cvm stop --wallet-private-key ${WALLET_PRIVATE_KEY} --deployment-id ${DEPLOYMENT_ID}

echo -e "${GREEN}Deployment stopped successfully!${NC}" 