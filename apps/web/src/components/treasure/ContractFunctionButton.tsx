import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { subscribeToPOI, registerPOI, bidOnPOI } from '../../utils/contractUtils';

// 定义不同合约函数的参数类型
type SubscribeToPOIArgs = [string | bigint, string | bigint]; // poiId, price
type RegisterPOIArgs = [string, number, number, string, boolean, string]; // name, lat, lng, stakeAmount, requiresSubscription, subscriptionPrice
type BidOnPOIArgs = [string | bigint, string | bigint]; // poiId, bidAmount

// 映射合约函数到其参数类型
type FunctionArgsMap = {
  'subscribeToPOI': SubscribeToPOIArgs;
  'registerPOI': RegisterPOIArgs;
  'bidOnPOI': BidOnPOIArgs;
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
      
      let result;
      
      // Call the appropriate contract function
      console.log(`Calling contract function: ${contractFunction} with args:`, functionArgs);
      
      // 为registerPOI预先处理参数
      const registerArgs = functionArgs as RegisterPOIArgs;
      
      switch (contractFunction) {
        case 'subscribeToPOI':
          result = await subscribeToPOI(
            provider, 
            (functionArgs as SubscribeToPOIArgs)[0], 
            (functionArgs as SubscribeToPOIArgs)[1]
          );
          break;
        case 'registerPOI':
          result = await registerPOI(
            provider, 
            registerArgs[0], // name
            registerArgs[1], // lat
            registerArgs[2], // lng
            registerArgs[3], // stakeAmount
            registerArgs[4], // requiresSubscription
            registerArgs[5]  // subscriptionPrice
          );
          break;
        case 'bidOnPOI':
          result = await bidOnPOI(
            provider, 
            (functionArgs as BidOnPOIArgs)[0], 
            (functionArgs as BidOnPOIArgs)[1]
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