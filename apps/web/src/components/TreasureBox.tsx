import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatEther } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, subscribeToPOI, isUserSubscribedToPOI } from '../utils/contractUtils';
import '../styles/TreasureBox.css';

interface TreasureBoxProps {
  onClose: () => void;
  selectedArea?: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    radius: number; // radius in kilometers
  };
  pois?: POI[];
  onSubscriptionSuccess?: () => void;
}

export function TreasureBox({ 
  onClose, 
  selectedArea,
  pois = [],
  onSubscriptionSuccess 
}: TreasureBoxProps) {
  const { t } = useTranslation();
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [premiumPOIs, setPremiumPOIs] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{[key: string]: boolean}>({});

  // Get user's embedded wallet
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  // Filter subscription-required POIs on mount
  useEffect(() => {
    if (pois && pois.length > 0) {
      const premium = pois.filter(poi => poi.isSubscriptionRequired);
      setPremiumPOIs(premium);
    }
  }, [pois]);

  // Check subscription status for all premium POIs
  useEffect(() => {
    const checkSubscriptions = async () => {
      if (!authenticated || !user?.wallet?.address || premiumPOIs.length === 0) return;
      
      const status: {[key: string]: boolean} = {};
      
      for (const poi of premiumPOIs) {
        try {
          const isSubscribed = await isUserSubscribedToPOI(
            user.wallet.address as `0x${string}`, 
            BigInt(poi.id)
          );
          status[poi.id] = isSubscribed;
        } catch (err) {
          console.error("Error checking subscription for POI:", poi.id, err);
          status[poi.id] = false;
        }
      }
      
      setSubscriptionStatus(status);
    };
    
    checkSubscriptions();
  }, [authenticated, user?.wallet?.address, premiumPOIs]);

  // Handle POI selection
  const handleSelectPOI = (poi: POI) => {
    setSelectedPOI(poi);
    setError(null);
    setSuccess(null);
  };

  // Handle subscription
  const handleSubscribe = async () => {
    if (!selectedPOI) return;
    if (!authenticated) {
      setError(t('treasureBox.errorNotLoggedIn'));
      return;
    }
    if (!embeddedWallet) {
      setError(t('treasureBox.errorNoWallet'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Ensure the wallet is connected to the correct chain (Sepolia)
      const sepoliaChainId = 11155111; // Sepolia chain ID as number
      
      // Switch to Sepolia chain using the appropriate method for Privy
      try {
        await embeddedWallet.switchChain(sepoliaChainId);
      } catch (err) {
        console.error("Error switching chain:", err);
        setError(`${t('treasureBox.subscriptionFailed')}: ${t('treasureBox.errorSwitchingChain')}`);
        setLoading(false);
        return;
      }
      
      // Get the provider from the wallet
      const provider = await embeddedWallet.getEthereumProvider();
      
      // Subscribe to the POI
      const result = await subscribeToPOI(
        provider, 
        BigInt(selectedPOI.id), 
        selectedPOI.subscriptionPrice
      );

      if (result.success) {
        setSuccess(t('treasureBox.subscriptionSuccess'));
        // Update subscription status
        setSubscriptionStatus(prev => ({
          ...prev, 
          [selectedPOI.id]: true
        }));
        if (onSubscriptionSuccess) {
          onSubscriptionSuccess();
        }
      } else {
        setError(result.error || t('treasureBox.subscriptionFailed'));
      }
    } catch (err) {
      console.error("Error subscribing to POI:", err);
      setError(t('treasureBox.subscriptionFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="treasure-box-container">
      <div className="treasure-box-header">
        <h2>{t('treasureBox.title')}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="treasure-box-content">
        {selectedArea && (
          <div className="selected-area">
            <h3>{t('treasureBox.selectedArea')}: {selectedArea.name}</h3>
            <p>{t('treasureBox.coordinates')}: {selectedArea.coordinates[1].toFixed(4)}, {selectedArea.coordinates[0].toFixed(4)}</p>
          </div>
        )}
        
        {premiumPOIs.length === 0 ? (
          <div className="no-pois">
            <p>{t('treasureBox.noPremiumPOIs')}</p>
          </div>
        ) : (
          <div className="premium-pois-list">
            <h3>{t('treasureBox.availablePremiumPOIs')}</h3>
            <ul>
              {premiumPOIs.map(poi => (
                <li 
                  key={poi.id}
                  className={`poi-item ${selectedPOI?.id === poi.id ? 'selected' : ''} ${subscriptionStatus[poi.id] ? 'subscribed' : ''}`}
                  onClick={() => !subscriptionStatus[poi.id] && handleSelectPOI(poi)}
                >
                  <div className="poi-name">{poi.name}</div>
                  <div className="poi-price">
                    {subscriptionStatus[poi.id] 
                      ? <span className="subscribed-tag">{t('treasureBox.subscribed')}</span>
                      : <span>{formatEther(poi.subscriptionPrice)} ETH</span>
                    }
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {selectedPOI && !subscriptionStatus[selectedPOI.id] && (
          <div className="subscription-details">
            <h3>{t('treasureBox.subscriptionDetails')}</h3>
            <p className="poi-name">{selectedPOI.name}</p>
            <p className="poi-description">{t('treasureBox.premiumDescription')}</p>
            <p className="subscription-price">
              {t('treasureBox.price')}: <strong>{formatEther(selectedPOI.subscriptionPrice)} ETH</strong>
            </p>
            
            <button 
              className="subscribe-button" 
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? t('treasureBox.subscribing') : t('treasureBox.subscribe')}
            </button>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <div className="treasure-box-info">
          <h4>{t('treasureBox.howItWorks')}</h4>
          <p>{t('treasureBox.howItWorksDescription')}</p>
          <p>{t('treasureBox.crossChainInfo')}</p>
        </div>
      </div>
    </div>
  );
} 