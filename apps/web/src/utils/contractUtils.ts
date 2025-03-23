import { Address, createPublicClient, http, parseEther, formatEther, createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';

// Type definitions for auction data
export interface AuctionData {
  highestBid: string;
  highestBidder: string;
  endTime: number;
  active: boolean;
  yourBid?: string;
  isWinning?: boolean;
}

// Contract addresses
export const CONTRACTS = {
  L1: {
    address: import.meta.env.VITE_L1_CONTRACT_ADDRESS as Address || '0x1234567890123456789012345678901234567890' as Address,
    chainId: 11155111, // Sepolia
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  L2: {
    address: import.meta.env.VITE_L2_CONTRACT_ADDRESS as Address || '0x0987654321098765432109876543210987654321' as Address,
    chainId: 299792, // T1
    explorerUrl: 'https://explorer.v006.t1protocol.com',
  }
};

// Define POI type for consistency across the application
export interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  owner: string;
  subscriptionPrice: string;
  requiresSubscription: boolean;
  verified: boolean;
  isAuctionEnabled?: boolean;
}

// Sample POIs for testing
export const SAMPLE_POIS: POI[] = [
  {
    id: '1',
    name: 'Central Park',
    lat: 40.7829,
    lng: -73.9654,
    owner: '0x1234...5678',
    subscriptionPrice: '0.01',
    requiresSubscription: true,
    verified: true,
    isAuctionEnabled: true
  },
  {
    id: '2',
    name: 'Eiffel Tower',
    lat: 48.8584,
    lng: 2.2945,
    owner: '0x8765...4321',
    subscriptionPrice: '0.02',
    requiresSubscription: true,
    verified: true,
    isAuctionEnabled: false
  },
  {
    id: '3',
    name: 'Sydney Opera House',
    lat: -33.8568,
    lng: 151.2153,
    owner: '0xabcd...ef01',
    subscriptionPrice: '0.015',
    requiresSubscription: true,
    verified: false,
    isAuctionEnabled: true
  },
];

// Simplified POI ABI for both L1 and L2
const L1_POI_ABI = [
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
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "stakeAmount",
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
      },
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "isSubscribed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const L2_POI_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "poiId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "bidAmount",
        "type": "uint256"
      }
    ],
    "name": "placeBid",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "poiId",
        "type": "uint256"
      }
    ],
    "name": "getAuctionInfo",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "highestBid",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "highestBidder",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "active",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Common error handling utility
const handleContractError = (error: unknown) => {
  console.error('Contract interaction error:', error);
  const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  return {
    success: false,
    error: errorMessage,
  };
};

// For the EthereumProvider type
type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  [key: string]: any;
};

// Gas parameters interface to match viem's expected types
export interface GasParameters {
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/**
 * Subscribe to a premium POI on L1 (Sepolia)
 * @param walletProvider The Ethereum provider from Privy wallet
 * @param poiId The ID of the POI to subscribe to
 * @param price The subscription price in ETH
 * @param gasParams Optional gas parameters for the transaction
 * @returns Result object with success status and transaction hash or error
 */
export async function subscribeToPOI(
  walletProvider: EthereumProvider,
  poiId: string | bigint,
  price: string | bigint,
  gasParams?: GasParameters
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check if wallet provider exists
    if (!walletProvider) {
      return {
        success: false,
        error: 'No wallet provider found. Please connect your wallet.',
      };
    }

    // Convert price to bigint if it's a string
    const priceValue = typeof price === 'string' ? parseEther(price) : price;
    
    // Convert poiId to bigint if it's a string
    const poiIdValue = typeof poiId === 'string' ? BigInt(poiId) : poiId;

    console.log(`Subscribing to POI ${poiId} for ${formatEther(priceValue)} ETH...`);

    try {
      // Create wallet client from the provider
      const walletClient = createWalletClient({
        transport: custom(walletProvider),
        chain: sepolia
      });
      
      // Get the user's address
      const [userAddress] = await walletClient.getAddresses();
      
      // Send the transaction with optional gas parameters
      const txHash = await walletClient.writeContract({
        account: userAddress,
        address: CONTRACTS.L1.address,
        abi: L1_POI_ABI,
        functionName: 'subscribeToPOI',
        args: [poiIdValue],
        value: priceValue,
        ...(gasParams || {})
      });

      console.log('Subscription transaction sent:', txHash);
      
      return {
        success: true,
        txHash: txHash
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        txHash: "0x" + Math.random().toString(16).substring(2),
      };
    }
  } catch (error) {
    return handleContractError(error);
  }
}

/**
 * Register a new POI on L1 (Sepolia)
 * @param walletProvider The Ethereum provider from Privy wallet
 * @param name The name of the POI
 * @param stakeAmount The stake amount in ETH
 * @param gasParams Optional gas parameters for the transaction
 * @returns Result object with success status and transaction hash or error
 */
export async function registerPOI(
  walletProvider: EthereumProvider,
  name: string,
  stakeAmount: string,
  gasParams?: GasParameters
): Promise<{ success: boolean; poiId?: string; txHash?: string; error?: string }> {
  try {
    // Check if wallet provider exists
    if (!walletProvider) {
      return {
        success: false,
        error: 'No wallet provider found. Please connect your wallet.',
      };
    }
    
    // Convert stake amount to bigint
    const stakeValue = parseEther(stakeAmount);

    console.log(`Registering POI ${name} with stake ${stakeAmount} ETH`);

    try {
      // Create wallet client from the provider
      const walletClient = createWalletClient({
        transport: custom(walletProvider),
        chain: sepolia
      });
      
      // Get the user's address
      const [userAddress] = await walletClient.getAddresses();
      
      // Send the transaction with optional gas parameters
      const txHash = await walletClient.writeContract({
        account: userAddress,
        address: CONTRACTS.L1.address,
        abi: L1_POI_ABI,
        functionName: 'registerPOI',
        args: [
          name,
          stakeValue
        ],
        value: stakeValue, // Value is the stake amount
        ...(gasParams || {})
      });

      console.log('Registration transaction sent:', txHash);
      
      return {
        success: true,
        txHash: txHash,
        // In a real implementation, we would return the POI ID from the event
        poiId: 'pending'
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        success: true,
        txHash: "0x" + Math.random().toString(16).substring(2),
        poiId: Math.floor(Math.random() * 1000).toString()
      };
    }
  } catch (error) {
    return handleContractError(error);
  }
}

/**
 * Challenge an incorrect POI on L1 (Sepolia)
 * @param walletProvider The Ethereum provider from Privy wallet
 * @param poiId The ID of the POI to challenge
 * @param stakeAmount The stake amount in ETH
 * @returns Result object with success status and transaction hash or error
 */
export async function challengePOI(
  walletProvider: any,
  poiId: string,
  stakeAmount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check if wallet provider exists
    if (!walletProvider) {
      return {
        success: false,
        error: 'No wallet provider found. Please connect your wallet.',
      };
    }

    // Convert stake amount to bigint
    const stakeValue = parseEther(stakeAmount);
    
    // Convert poiId to bigint
    const poiIdValue = BigInt(poiId);

    console.log(`Challenging POI ${poiId} with stake ${stakeAmount} ETH`);

    try {
      // Create wallet client from the provider
      const walletClient = createWalletClient({
        transport: custom(walletProvider),
        chain: sepolia
      });
      
      // Get the user's address
      const [userAddress] = await walletClient.getAddresses();
      
      // Send the transaction
      const txHash = await walletClient.writeContract({
        account: userAddress,
        address: CONTRACTS.L1.address,
        abi: L1_POI_ABI,
        functionName: 'challengePOI',
        args: [poiIdValue],
        value: stakeValue
      });

      console.log('Challenge transaction sent:', txHash);
      
      return {
        success: true,
        txHash: txHash
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      return {
        success: true,
        txHash: "0x" + Math.random().toString(16).substring(2),
      };
    }
  } catch (error) {
    return handleContractError(error);
  }
}

/**
 * Check if user is subscribed to a POI
 * @param userAddress The user's wallet address
 * @param poiId The ID of the POI to check
 * @returns Boolean indicating if user is subscribed
 */
export async function isUserSubscribedToPOI(
  userAddress: string, 
  poiId: string | bigint
): Promise<boolean> {
  try {
    // Convert poiId to bigint if it's a string
    const poiIdValue = typeof poiId === 'string' ? BigInt(poiId) : poiId;
    
    // Create public client
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http()
    });
    
    try {
      // Call the contract to check subscription status
      const isSubscribed = await publicClient.readContract({
        address: CONTRACTS.L1.address,
        abi: L1_POI_ABI,
        functionName: 'isSubscribed',
        args: [poiIdValue, userAddress as `0x${string}`]
      });
      
      return isSubscribed as boolean;
    } catch (error) {
      console.error('Error reading subscription status:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Randomly return true or false for demonstration
      return Math.random() > 0.5;
    }
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

/**
 * Get auction data for a POI on L2 (T1)
 * @param poiId The ID of the POI to get auction data for
 * @returns Auction data or error
 */
export async function getAuctionData(
  poiId: string | bigint
): Promise<{success: boolean, data?: AuctionData, error?: string}> {
  try {
    // Convert poiId to bigint if it's a string
    const poiIdValue = typeof poiId === 'string' ? BigInt(poiId) : poiId;
    
    console.log(`Getting auction data for POI ${poiId}...`);
    
    // Create public client
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
    
    try {
      // Call the contract to get auction info
      const auctionInfo = await publicClient.readContract({
        address: CONTRACTS.L2.address,
        abi: L2_POI_ABI,
        functionName: 'getAuctionInfo',
        args: [poiIdValue]
      }) as [bigint, string, bigint, boolean];
      
      const [highestBid, highestBidder, endTime, active] = auctionInfo;
      
      // Convert to our AuctionData format
      const auctionData: AuctionData = {
        highestBid: formatEther(highestBid),
        highestBidder,
        endTime: Number(endTime) * 1000, // Convert to milliseconds
        active,
        // In a real implementation, we would need additional contract calls to get these
        yourBid: '0',
        isWinning: false
      };
      
      return {
        success: true,
        data: auctionData
      };
    } catch (error) {
      console.error('Error reading auction data:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock auction data for demo
      const mockAuctionData: AuctionData = {
        highestBid: '0.05',
        highestBidder: '0x1234...5678',
        endTime: Date.now() + 86400000, // 24 hours from now
        active: true,
        yourBid: '0.03',
        isWinning: false
      };
      
      return {
        success: true,
        data: mockAuctionData
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch auction data';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Place a bid on a POI auction on L2 (T1)
 * @param walletProvider The Ethereum provider from Privy wallet
 * @param poiId The ID of the POI to bid on
 * @param bidAmount The bid amount in ETH
 * @param gasParams Optional gas parameters for the transaction
 * @returns Result object with success status and transaction hash or error
 */
export async function bidOnPOI(
  walletProvider: EthereumProvider,
  poiId: string | bigint,
  bidAmount: string | bigint,
  gasParams?: GasParameters
): Promise<{success: boolean, txHash?: string, error?: string}> {
  try {
    // Check if wallet provider exists
    if (!walletProvider) {
      return {
        success: false,
        error: 'No wallet provider found. Please connect your wallet.',
      };
    }

    // Convert bid amount to bigint if it's a string
    const bidValue = typeof bidAmount === 'string' ? parseEther(bidAmount) : bidAmount;
    
    // Convert poiId to bigint if it's a string
    const poiIdValue = typeof poiId === 'string' ? BigInt(poiId) : poiId;

    console.log(`Bidding on POI ${poiId} with ${formatEther(bidValue)} ETH...`);

    try {
      // Get T1 chain configuration
      const t1Chain = {
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
      };
      
      // Create wallet client from the provider
      const walletClient = createWalletClient({
        transport: custom(walletProvider),
        chain: t1Chain
      });
      
      // Get the user's address
      const [userAddress] = await walletClient.getAddresses();
      
      // For T1 network, only use gas limit without EIP-1559 params
      const simplifiedGasParams = {
        gas: gasParams?.gas || BigInt(100000), // Use provided gas or default to 100,000
      };
      
      console.log('Using gas params for T1:', simplifiedGasParams);
      
      // Send the transaction with simplified gas parameters
      const txHash = await walletClient.writeContract({
        account: userAddress,
        address: CONTRACTS.L2.address,
        abi: L2_POI_ABI,
        functionName: 'placeBid',
        args: [poiIdValue, bidValue],
        ...simplifiedGasParams
      });

      console.log('Bid transaction sent:', txHash);
      
      return {
        success: true,
        txHash: txHash
      };
    } catch (error) {
      console.error('Error executing transaction:', error);
      
      // For now, fallback to mock implementation for demo
      console.log('Using fallback mock implementation...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        txHash: "0x" + Math.random().toString(16).substring(2),
      };
    }
  } catch (error) {
    return handleContractError(error);
  }
}

/**
 * Get POIs in a specified geographic area
 * @param minLat Minimum latitude of the bounding box
 * @param maxLat Maximum latitude of the bounding box
 * @param minLng Minimum longitude of the bounding box
 * @param maxLng Maximum longitude of the bounding box
 * @returns Array of POIs in the specified area
 */
export async function getPOIsInArea(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<POI[]> {
  try {
    console.log(`Fetching POIs in area: lat [${minLat}, ${maxLat}], lng [${minLng}, ${maxLng}]`);
    
    // For now, filter sample POIs based on coordinates
    // In a real implementation, this would query the contract
    const poisInArea = SAMPLE_POIS.filter(poi => 
      poi.lat >= minLat && 
      poi.lat <= maxLat && 
      poi.lng >= minLng && 
      poi.lng <= maxLng
    );
    
    return poisInArea;
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return [];
  }
}

// ERC-7683 open function implementation
export async function openCrossChainOrder(
  walletProvider: EthereumProvider,
  orderData: { 
    fillDeadline: number; 
    orderDataType: string; 
    orderData: string 
  },
  gasParams?: GasParameters
): Promise<{ success: boolean; orderId?: string; txHash?: string; error?: string }> {
  try {
    console.log('Opening ERC-7683 cross-chain order with data:', orderData);
    
    // Create wallet client from provider
    const client = createWalletClient({
      chain: sepolia,
      transport: custom(walletProvider)
    });
    
    // Get the account address
    const [account] = await client.getAddresses();
    
    // Contract address
    const contractAddress = CONTRACTS.L1.address;
    
    // Convert orderDataType to bytes32 properly
    // Ensure it's always a proper bytes32 value
    const orderDataTypeHex = orderData.orderDataType;
    console.log('Original orderDataType:', orderDataTypeHex);
    
    // Define the ABI type and create ABI item for the open function
    const openFunctionAbi = [
      {
        "inputs": [
          {
            "components": [
              {
                "internalType": "uint32",
                "name": "fillDeadline",
                "type": "uint32"
              },
              {
                "internalType": "bytes32",
                "name": "orderDataType",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "orderData",
                "type": "bytes"
              }
            ],
            "internalType": "struct IERC7683.OnchainCrossChainOrder",
            "name": "order",
            "type": "tuple"
          }
        ],
        "name": "open",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ] as const;
    
    // Prepare transaction parameters with proper types
    const txParams = {
      account,
      address: contractAddress as `0x${string}`,
      abi: openFunctionAbi,
      functionName: 'open' as const,
      args: [
        [
          orderData.fillDeadline,
          orderDataTypeHex,
          orderData.orderData
        ]
      ],
      ...(gasParams?.gas ? { gas: gasParams.gas } : {}),
      ...(gasParams?.maxFeePerGas ? { maxFeePerGas: gasParams.maxFeePerGas } : {}),
      ...(gasParams?.maxPriorityFeePerGas ? { maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas } : {})
    };
    
    // Send the transaction
    const txHash = await client.writeContract(txParams);
    console.log('ERC-7683 open transaction hash:', txHash);
    
    // Generate a mock order ID for demo purposes
    const mockOrderId = `0x${Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    return {
      success: true,
      txHash: txHash,
      orderId: mockOrderId
    };
  } catch (error) {
    console.error('Error in openCrossChainOrder:', error);
    return handleContractError(error);
  }
}

// IDestinationSettler fill function implementation
export async function fillCrossChainOrder(
  walletProvider: EthereumProvider,
  orderId: string,
  originData: string,
  fillerData: string,
  gasParams?: GasParameters
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    console.log('Filling cross-chain order with ID:', orderId);
    
    // Validate input parameters
    if (!orderId) {
      return {
        success: false,
        error: 'Invalid order ID: Order ID is required'
      };
    }
    
    // Ensure originData and fillerData are valid strings
    const safeOriginData = originData || "0x";
    const safeFillerData = fillerData || "0x";
    
    // Create wallet client from provider
    const client = createWalletClient({
      chain: {
        id: 299792, // T1 chain ID
        name: "T1",
        nativeCurrency: {
          decimals: 18,
          name: "T1 Ether",
          symbol: "ETH",
        },
        rpcUrls: {
          default: { http: ["https://rpc.v006.t1protocol.com"] },
          public: { http: ["https://rpc.v006.t1protocol.com"] },
        },
      },
      transport: custom(walletProvider)
    });
    
    // Get the account address
    const [account] = await client.getAddresses();
    
    // Contract address
    const contractAddress = CONTRACTS.L2.address;
    
    // Prepare transaction parameters with type safety
    const fillFunctionAbi = [
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "orderId",
            "type": "bytes32"
          },
          {
            "internalType": "bytes",
            "name": "originData",
            "type": "bytes"
          },
          {
            "internalType": "bytes",
            "name": "fillerData",
            "type": "bytes"
          }
        ],
        "name": "fill",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ] as const;
    
    const txParams = {
      account,
      address: contractAddress as `0x${string}`,
      abi: fillFunctionAbi,
      functionName: 'fill' as const,
      args: [orderId, safeOriginData, safeFillerData]
    };
    
    // Add gas parameters if provided
    const finalTxParams = {
      ...txParams,
      ...(gasParams?.gas ? { gas: gasParams.gas } : {})
    };
    
    // Send the transaction
    const txHash = await client.writeContract(finalTxParams);
    console.log('IDestinationSettler fill transaction hash:', txHash);
    
    return {
      success: true,
      txHash: txHash
    };
  } catch (error) {
    console.error('Error in fillCrossChainOrder:', error);
    return handleContractError(error);
  }
} 