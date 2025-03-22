import { useSendTransaction, usePrivy, useWallets } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

interface SendTransactionButtonProps {
  to: string;
  value: number | bigint;
  buttonText?: string;
  networkId?: number; // Chain ID for the network to use
  onSuccess?: () => void;
  onError?: (error: Error | unknown) => void;
  className?: string;
}

export function SendTransactionButton({
  to,
  value,
  buttonText,
  networkId,
  onSuccess,
  onError,
  className
}: SendTransactionButtonProps) {
  const { t } = useTranslation();
  const { sendTransaction } = useSendTransaction();
  const { createWallet, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [isProcessing, setIsProcessing] = useState(false);

  const onSendTransaction = async () => {
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
      const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      
      // Create wallet if not exists
      if (!embeddedWallet) {
        console.log("Creating embedded wallet...");
        await createWallet();
        
        // Small delay to allow wallet creation to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Get the wallet again after possible creation
      const wallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      
      if (!wallet) {
        throw new Error("Failed to create embedded wallet. Please try again.");
      }
      
      // Switch network if needed
      if (networkId) {
        try {
          console.log(`Switching to network ID: ${networkId}`);
          await wallet.switchChain(networkId);
          
          // Small delay to allow chain switching to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error("Error switching network:", err);
          throw new Error(`Failed to switch to the required network. Please switch manually to ${getNetworkName(networkId)}.`);
        }
      }
      
      // Send the transaction
      console.log("Sending transaction to:", to, "with value:", value.toString());
      await sendTransaction({
        to: to,
        value: value,
      });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Transaction error:", error);
      
      // Handle known error types with user-friendly messages
      let userError: Error;
      
      if (typeof error === 'object' && error !== null) {
        const errorMessage = String(error);
        
        if (errorMessage.includes("User must have an embedded wallet")) {
          userError = new Error("Could not create an embedded wallet. Please reload and try again.");
        } else if (errorMessage.includes("User rejected the request")) {
          userError = new Error("Transaction was rejected. Please try again when ready.");
        } else if (errorMessage.includes("insufficient funds")) {
          userError = new Error("Your wallet has insufficient funds for this transaction.");
        } else if (errorMessage.includes("Failed to switch to the required network")) {
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

  // Helper function to get network name from ID
  const getNetworkName = (id: number): string => {
    switch(id) {
      case 1:
        return "Ethereum Mainnet";
      case 11155111:
        return "Sepolia Testnet";
      case 11155420:
        return "T1 (Ex-Optimism)";
      default:
        return `Network ID ${id}`;
    }
  };

  return (
    <button 
      onClick={onSendTransaction}
      className={className || "demo-button primary"}
      disabled={isProcessing}
    >
      {isProcessing ? t('common.loading') : (buttonText || t('treasureBox.sendTransaction'))}
    </button>
  );
} 