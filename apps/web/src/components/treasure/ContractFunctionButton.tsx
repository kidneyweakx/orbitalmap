import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { 
  subscribeToPOI, 
  registerPOI, 
  bidOnPOI, 
  openCrossChainOrder, 
  fillCrossChainOrder, 
  GasParameters 
} from '../../utils/contractUtils';
import { parseEther } from 'viem';

// 定义不同合约函数的参数类型
type SubscribeToPOIArgs = [string | bigint, string | bigint]; // poiId, price
type RegisterPOIArgs = [string, string]; // name, stakeAmount
type BidOnPOIArgs = [string | bigint, string | bigint]; // poiId, bidAmount
type OpenCrossChainArgs = [{ fillDeadline: number; orderDataType: string; orderData: string }]; // ERC-7683 open
type FillCrossChainArgs = [string, string, string]; // orderId, originData, fillerData

// 映射合约函数到其参数类型
type FunctionArgsMap = {
  'subscribeToPOI': SubscribeToPOIArgs;
  'registerPOI': RegisterPOIArgs;
  'bidOnPOI': BidOnPOIArgs;
  'open': OpenCrossChainArgs;
  'fill': FillCrossChainArgs;
};

interface ContractFunctionButtonProps<T extends keyof FunctionArgsMap> {
  contractFunction: T;
  functionArgs: FunctionArgsMap[T];
  buttonText?: string;
  networkId: number;
  onSuccess?: () => void;
  onError?: (error: Error | unknown) => void;
  className?: string;
}

export function ContractFunctionButton<T extends keyof FunctionArgsMap>({
  contractFunction,
  functionArgs,
  buttonText,
  networkId,
  onSuccess,
  onError,
  className
}: ContractFunctionButtonProps<T>) {
  const { t } = useTranslation();
  const { authenticated, login, createWallet } = usePrivy();
  const { wallets } = useWallets();
  const [isProcessing, setIsProcessing] = useState(false);

  // Add manual gas limit for different contract functions
  const getGasLimit = (functionName: string): bigint => {
    switch (functionName) {
      case 'subscribeToPOI':
        return BigInt(300000); // 300,000 gas
      case 'registerPOI':
        return BigInt(500000); // 500,000 gas
      case 'bidOnPOI':
        return BigInt(100000); // Reduced from 250,000 to 100,000 gas
      case 'open':
        return BigInt(400000); // ERC-7683 open cross-chain order
      case 'fill':
        return BigInt(400000); // IDestinationSettler fill cross-chain order
      default:
        return BigInt(100000); // Default 100,000 gas
    }
  };

  const handleContractCall = async () => {
    try {
      setIsProcessing(true);
      
      // Check if user is authenticated
      if (!authenticated) {
        await login();
        // Return early as we need to wait for authentication to complete
        setIsProcessing(false);
        return;
      }
      
      // Get the embedded wallet
      let embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      
      // Create wallet if not exists
      if (!embeddedWallet) {
        console.log("Creating embedded wallet...");
        await createWallet();
        
        // Small delay to allow wallet creation to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the wallet again after creation
        embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
        
        if (!embeddedWallet) {
          throw new Error("Failed to create embedded wallet. Please try again.");
        }
      }
      
      // Switch network if needed
      try {
        console.log(`Switching to network ID: ${networkId}`);
        await embeddedWallet.switchChain(networkId);
        
        // Small delay to allow chain switching to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error("Error switching network:", err);
        throw new Error(`Failed to switch to the required network. Please switch manually to network ID ${networkId}.`);
      }
      
      // Get the provider from the wallet
      const provider = await embeddedWallet.getEthereumProvider();
      
      if (!provider) {
        throw new Error("No provider available. Please try again.");
      }
      
      // Set gas limit based on function
      const gasLimit = getGasLimit(contractFunction);
      
      // Get fee data from the network if possible
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      
      try {
        // Use much lower gas fees for testing networks
        maxFeePerGas = parseEther('0.0000000003'); // 0.3 gwei base
        maxPriorityFeePerGas = parseEther('0.0000000001'); // 0.1 gwei priority
      } catch {
        // Ignore errors, use the defaults from initialization
        console.warn('Error getting fee data, using defaults');
      }
      
      // Prepare gas parameters - for T1 network, don't use maxFeePerGas and maxPriorityFeePerGas
      const gasParams: GasParameters = {
        gas: gasLimit,
      };
      
      // Only add EIP-1559 params for networks that support it (not for T1)
      if (networkId !== 299792) { // If not T1 network
        gasParams.maxFeePerGas = maxFeePerGas;
        gasParams.maxPriorityFeePerGas = maxPriorityFeePerGas;
      }
      
      console.log(`Using gas params:`, gasParams);
      
      let result;
      
      // Call the appropriate contract function
      console.log(`Calling contract function: ${contractFunction} with args:`, functionArgs);
      
      const registerArgs = functionArgs as RegisterPOIArgs;
      const fillArgs = functionArgs as FillCrossChainArgs;
      
      switch (contractFunction) {
        case 'subscribeToPOI':
          result = await subscribeToPOI(
            provider, 
            (functionArgs as SubscribeToPOIArgs)[0], 
            (functionArgs as SubscribeToPOIArgs)[1],
            gasParams
          );
          break;
        case 'registerPOI':
          result = await registerPOI(
            provider, 
            registerArgs[0], // name
            registerArgs[1], // stakeAmount
            gasParams
          );
          break;
        case 'bidOnPOI':
          result = await bidOnPOI(
            provider, 
            (functionArgs as BidOnPOIArgs)[0], 
            (functionArgs as BidOnPOIArgs)[1],
            gasParams
          );
          break;
        case 'open':
          // Call ERC-7683 open function
          console.log('Calling ERC-7683 open function with args:', functionArgs);
          result = await openCrossChainOrder(
            provider,
            (functionArgs as OpenCrossChainArgs)[0],
            gasParams
          );
          break;
        case 'fill':
          // Call IDestinationSettler fill function
          console.log('Calling IDestinationSettler fill function with args:', functionArgs);
          result = await fillCrossChainOrder(
            provider,
            fillArgs[0], // orderId
            fillArgs[1], // originData
            fillArgs[2], // fillerData
            gasParams
          );
          break;
        default:
          throw new Error(`Unsupported contract function: ${contractFunction}`);
      }
      
      if (result.success) {
        console.log(`${contractFunction} successful:`, result);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.error || `${contractFunction} failed`);
      }
    } catch (error) {
      console.error("Contract interaction error:", error);
      
      // Handle known error types with user-friendly messages
      let userError: Error;
      
      if (typeof error === 'object' && error !== null) {
        const errorMessage = String(error);
        
        if (errorMessage.includes("embedded wallet")) {
          userError = new Error("Could not create an embedded wallet. Please reload and try again.");
        } else if (errorMessage.includes("rejected the request")) {
          userError = new Error("Transaction was rejected. Please try again when ready.");
        } else if (errorMessage.includes("insufficient funds")) {
          userError = new Error("Your wallet has insufficient funds for this transaction.");
        } else if (errorMessage.includes("intrinsic gas too low")) {
          userError = new Error("Network is congested. Please try again with a higher gas limit.");
        } else if (errorMessage.includes("Failed to switch")) {
          userError = error as Error;
        } else {
          userError = new Error("Transaction failed. Please try again later.");
        }
      } else {
        userError = new Error("Unknown error occurred. Please try again.");
      }
      
      if (onError) {
        onError(userError);
      } else {
        alert(userError.message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button 
      onClick={handleContractCall}
      className={className || "demo-button primary"}
      disabled={isProcessing}
    >
      {isProcessing ? t('common.loading') : (buttonText || t('treasureBox.sendTransaction'))}
    </button>
  );
} 