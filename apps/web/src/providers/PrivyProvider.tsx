import { PrivyProvider as PrivyProviderOriginal } from '@privy-io/react-auth';
import { ReactNode } from 'react';

// Get the Privy App ID from environment variables
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

// Default emoji options for user profile
export const EMOJI_OPTIONS = [
  '🦊', '🐼', '🐶', '🐱', '🦁', '🐯', '🐨', '🐮', 
  '🐷', '🐸', '🐙', '🦄', '🦩', '🦖', '🐬', '🦋'
];

// Props for the PrivyProvider component
interface PrivyProviderProps {
  children: ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  return (
    <PrivyProviderOriginal
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
          logo: '/logo.png',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [
          { 
            id: 1, 
            name: 'Ethereum',
            nativeCurrency: {
              name: 'Ether',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: {
              default: { http: ['https://ethereum.publicnode.com'] },
              public: { http: ['https://ethereum.publicnode.com'] }
            }
          },
          { 
            id: 137, 
            name: 'Polygon',
            nativeCurrency: {
              name: 'MATIC',
              symbol: 'MATIC',
              decimals: 18
            },
            rpcUrls: {
              default: { http: ['https://polygon-rpc.com'] },
              public: { http: ['https://polygon-rpc.com'] }
            }
          },
          { 
            id: 11155111, 
            name: 'Sepolia',
            nativeCurrency: {
              name: 'Sepolia Ether',
              symbol: 'SEP',
              decimals: 18
            },
            rpcUrls: {
              default: { http: ['https://1rpc.io/sepolia'] },
              public: { http: ['https://1rpc.io/sepolia'] }
            },
            blockExplorers: {
              default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' }
            },
            testnet: true
          },
          {
            id: 299792,
            name: 'T1',
            nativeCurrency: {
              name: 'T1 Ether',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: {
              default: { http: ['https://rpc.v006.t1protocol.com'] },
              public: { http: ['https://rpc.v006.t1protocol.com'] }
            },
            blockExplorers: {
              default: { name: 'T1 Explorer', url: 'https://explorer.v006.t1protocol.com' }
            },
            testnet: true
          }
        ],
        defaultChain: {
          id: 11155111, // Sepolia as default chain
          name: 'Sepolia',
          nativeCurrency: {
            name: 'Sepolia Ether',
            symbol: 'SEP',
            decimals: 18
          },
          rpcUrls: {
            default: { http: ['https://1rpc.io/sepolia'] },
            public: { http: ['https://1rpc.io/sepolia'] }
          },
          blockExplorers: {
            default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' }
          },
          testnet: true
        },
      }}
    >
      {children}
    </PrivyProviderOriginal>
  );
} 