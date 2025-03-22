import { Address, createPublicClient, http, parseEther, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Contract addresses
export const CONTRACTS = {
  L1: {
    address: import.meta.env.VITE_L1_CONTRACT_ADDRESS as Address || '',
    chainId: 11155111, // Sepolia
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  L2: {
    address: import.meta.env.VITE_L2_CONTRACT_ADDRESS as Address || '',
    chainId: 299792, // T1
    explorerUrl: 'https://explorer.v006.t1protocol.com',
  }
};

// POI Types
export enum VerificationState {
  Unverified,
  Pending,
  Verified,
  Challenged,
  Rejected
}

export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  owner: Address;
  stake: bigint;
  verificationState: VerificationState;
  timestamp: bigint;
  isSubscriptionRequired: boolean;
  subscriptionPrice: bigint;
}

// L1 POI Marketplace ABI (simplified for necessary functions)
export const L1POIMarketplaceABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l2Contract",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_l2ChainId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      }
    ],
    "name": "challengePOI",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      }
    ],
    "name": "getPOI",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "int256",
            "name": "lat",
            "type": "int256"
          },
          {
            "internalType": "int256",
            "name": "lng",
            "type": "int256"
          },
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "stake",
            "type": "uint256"
          },
          {
            "internalType": "enum L1POIMarketplace.VerificationState",
            "name": "verificationState",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isSubscriptionRequired",
            "type": "bool"
          },
          {
            "internalType": "uint256",
            "name": "subscriptionPrice",
            "type": "uint256"
          }
        ],
        "internalType": "struct L1POIMarketplace.POI",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPOICount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_start",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_end",
        "type": "uint256"
      }
    ],
    "name": "getPOIsBatch",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "int256",
            "name": "lat",
            "type": "int256"
          },
          {
            "internalType": "int256",
            "name": "lng",
            "type": "int256"
          },
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "stake",
            "type": "uint256"
          },
          {
            "internalType": "enum L1POIMarketplace.VerificationState",
            "name": "verificationState",
            "type": "uint8"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "isSubscriptionRequired",
            "type": "bool"
          },
          {
            "internalType": "uint256",
            "name": "subscriptionPrice",
            "type": "uint256"
          }
        ],
        "internalType": "struct L1POIMarketplace.POI[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "l2ChainId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "l2DestinationContract",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "int256",
        "name": "_lat",
        "type": "int256"
      },
      {
        "internalType": "int256",
        "name": "_lng",
        "type": "int256"
      },
      {
        "internalType": "bool",
        "name": "_isSubscriptionRequired",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "_subscriptionPrice",
        "type": "uint256"
      }
    ],
    "name": "registerPOI",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      }
    ],
    "name": "resolvePOIVerification",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      }
    ],
    "name": "subscribeToPOI",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l2Contract",
        "type": "address"
      }
    ],
    "name": "updateL2Contract",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// L2 POI Auction ABI (simplified for necessary functions)
export const L2POIAuctionABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l1Contract",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_l1ChainId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_proofData",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_teeData",
        "type": "string"
      }
    ],
    "name": "bidForVerification",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      }
    ],
    "name": "getAuctionStatus",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "validators",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "bids",
        "type": "uint256[]"
      },
      {
        "internalType": "string[]",
        "name": "proofData",
        "type": "string[]"
      },
      {
        "internalType": "string[]",
        "name": "teeData",
        "type": "string[]"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isActive",
        "type": "bool"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "l1ChainId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "l1SourceContract",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_poiId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_validator",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "_isVerified",
        "type": "bool"
      },
      {
        "internalType": "string",
        "name": "_verificationData",
        "type": "string"
      }
    ],
    "name": "sendVerificationResult",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Function to check if user is subscribed to a POI
export async function isUserSubscribedToPOI(
  userAddress: Address, 
  poiId: bigint
): Promise<boolean> {
  try {
    if (!CONTRACTS.L1.address) {
      console.error("L1 contract address not configured");
      return false;
    }

    const publicClient = createPublicClient({
      chain: {
        id: CONTRACTS.L1.chainId,
        name: "Sepolia",
        nativeCurrency: {
          decimals: 18,
          name: "Sepolia Ether",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: ["https://1rpc.io/sepolia"] },
        },
      },
      transport: http(),
    });

    // Call the subscription check function (need to implement this in contract)
    const isSubscribed = await publicClient.readContract({
      address: CONTRACTS.L1.address,
      abi: L1POIMarketplaceABI,
      functionName: 'isSubscribed',
      args: [poiId, userAddress],
    });

    return isSubscribed as boolean;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

// Function to subscribe to a POI
export async function subscribeToPOI(
  walletClient: any,
  poiId: bigint,
  price: bigint
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!CONTRACTS.L1.address) {
      return { success: false, error: "L1 contract address not configured" };
    }

    // Subscribe to POI
    const txHash = await walletClient.writeContract({
      address: CONTRACTS.L1.address,
      abi: L1POIMarketplaceABI,
      functionName: 'subscribeToPOI',
      args: [poiId],
      value: price,
    });

    return { success: true, txHash };
  } catch (error) {
    console.error("Error subscribing to POI:", error);
    return { success: false, error: String(error) };
  }
}

// Function to get POIs in an area
export async function getPOIsInArea(minLat: number, maxLat: number, minLng: number, maxLng: number): Promise<POI[]> {
  try {
    if (!CONTRACTS.L1.address) {
      console.error("L1 contract address not configured");
      return [];
    }

    const publicClient = createPublicClient({
      chain: {
        id: CONTRACTS.L1.chainId,
        name: "Sepolia",
        nativeCurrency: {
          decimals: 18,
          name: "Sepolia Ether",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: ["https://1rpc.io/sepolia"] },
        },
      },
      transport: http(),
    });

    // Get total POI count
    const poiCount = await publicClient.readContract({
      address: CONTRACTS.L1.address,
      abi: L1POIMarketplaceABI,
      functionName: 'getPOICount',
    }) as bigint;

    const batchSize = 10n;
    const pois: POI[] = [];

    // Fetch POIs in batches
    for (let i = 0n; i < poiCount; i += batchSize) {
      const end = i + batchSize > poiCount ? poiCount : i + batchSize;
      
      const batchPOIs = await publicClient.readContract({
        address: CONTRACTS.L1.address,
        abi: L1POIMarketplaceABI,
        functionName: 'getPOIsBatch',
        args: [i, end],
      }) as any[];

      // Filter POIs by coordinates
      const filteredPOIs = batchPOIs.map((poi, index) => ({
        id: (i + BigInt(index)).toString(),
        name: poi.name,
        lat: Number(poi.lat) / 1000000, // Assuming coordinates are stored as integers with 6 decimal precision
        lng: Number(poi.lng) / 1000000,
        owner: poi.owner,
        stake: poi.stake,
        verificationState: poi.verificationState,
        timestamp: poi.timestamp,
        isSubscriptionRequired: poi.isSubscriptionRequired,
        subscriptionPrice: poi.subscriptionPrice
      })).filter(poi => 
        poi.lat >= minLat && 
        poi.lat <= maxLat && 
        poi.lng >= minLng && 
        poi.lng <= maxLng
      );

      pois.push(...filteredPOIs);
    }

    return pois;
  } catch (error) {
    console.error("Error fetching POIs:", error);
    return [];
  }
}

// Function to get auction status for a POI on L2
export async function getAuctionStatus(poiId: bigint) {
  try {
    if (!CONTRACTS.L2.address) {
      console.error("L2 contract address not configured");
      return null;
    }

    const publicClient = createPublicClient({
      chain: {
        id: CONTRACTS.L2.chainId,
        name: "T1",
        nativeCurrency: {
          decimals: 18,
          name: "T1 Ether",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: ["https://rpc.v006.t1protocol.com"] },
        },
      },
      transport: http(),
    });

    const auctionStatus = await publicClient.readContract({
      address: CONTRACTS.L2.address,
      abi: L2POIAuctionABI,
      functionName: 'getAuctionStatus',
      args: [poiId],
    });

    return auctionStatus;
  } catch (error) {
    console.error("Error fetching auction status:", error);
    return null;
  }
} 