import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, subscribeToPOI, isUserSubscribedToPOI, CONTRACTS } from '../../utils/contractUtils';

interface L1CardProps {
  onBack: () => void;
  selectedArea?: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    radius: number; // radius in kilometers
  };
  pois?: POI[];
  onSubscriptionSuccess?: () => void;
  isToolboxMode?: boolean;
}

export function L1Card({ 
  onBack, 
  selectedArea, 
  pois = [], 
  onSubscriptionSuccess, 
  isToolboxMode = false 
}: L1CardProps) {
  const { t } = useTranslation();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [premiumPOIs, setPremiumPOIs] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{[key: string]: boolean}>({});
  
  // Get user's embedded wallet
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  // Filter subscription-required POIs
  useState(() => {
    if (pois && pois.length > 0) {
      const premium = pois.filter(poi => poi.requiresSubscription);
      setPremiumPOIs(premium);
      
      // Check subscription status for all premium POIs
      if (user?.wallet?.address) {
        checkSubscriptions(premium, user.wallet.address as `0x${string}`);
      }
    }
  });

  // Check subscription status for all premium POIs
  const checkSubscriptions = async (poiList: POI[], address: `0x${string}`) => {
    const status: {[key: string]: boolean} = {};
    
    for (const poi of poiList) {
      try {
        const isSubscribed = await isUserSubscribedToPOI(
          address, 
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

  // Handle POI selection
  const handleSelectPOI = (poi: POI) => {
    setSelectedPOI(poi);
    setError(null);
    setSuccess(null);
  };

  // Handle subscription
  const handleSubscribe = async () => {
    if (!selectedPOI) return;
    if (!user?.wallet?.address) {
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
        await embeddedWallet?.switchChain(sepoliaChainId);
      } catch (err) {
        console.error("Error switching chain:", err);
        setError(`${t('treasureBox.subscriptionFailed')}: ${t('treasureBox.errorSwitchingChain')}`);
        setLoading(false);
        return;
      }
      
      // Get the provider from the wallet
      const provider = await embeddedWallet?.getEthereumProvider();
      
      if (!provider) {
        setError(t('treasureBox.errorNoProvider'));
        setLoading(false);
        return;
      }
      
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

  // Render the card in toolbox mode (info only, no interaction)
  if (isToolboxMode) {
    return (
      <div className="treasure-box-card-content">
        <div className="card-header l1-header">
          <button className="back-button" onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h3>{t('treasureBox.l1CardTitle')}</h3>
        </div>
        
        <div className="network-indicator">
          <span className="network-dot sepolia"></span>
          Sepolia
        </div>
        
        <div className="card-description">
          <p>{t('treasureBox.l1CardDetailedDescription')}</p>
        </div>
        
        <div className="function-list">
          <h4>{t('treasureBox.availableFunctions')}</h4>
          <ul>
            <li>registerPOI(...) - {t('treasureBox.registerPOIDesc')}</li>
            <li>subscribeToPOI(poiId) - {t('treasureBox.subscribeToPOIDesc')}</li>
            <li>challengePOI(poiId) - {t('treasureBox.challengePOIDesc')}</li>
            <li>getPOI(poiId) - {t('treasureBox.getPOIDesc')}</li>
          </ul>
        </div>
        
        <div className="network-info">
          <h4>{t('treasureBox.networkInfo')}</h4>
          <p>
            <strong>{t('treasureBox.network')}:</strong> Sepolia<br />
            <strong>{t('treasureBox.contractAddress')}:</strong> {CONTRACTS.L1.address}<br />
            <strong>{t('treasureBox.explorer')}:</strong> 
            <a 
              href={`${CONTRACTS.L1.explorerUrl}/address/${CONTRACTS.L1.address}`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {t('treasureBox.viewOnEtherscan')}
            </a>
          </p>
        </div>
        
        <div className="treasure-box-info">
          <p>{t('treasureBox.l1InfoText')}</p>
        </div>
      </div>
    );
  }

  // Render the L1 card for actual POI subscription
  return (
    <div className="l1-card-content">
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
                    : <span>{poi.subscriptionPrice} ETH</span>
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
            {t('treasureBox.price')}: <strong>{selectedPOI.subscriptionPrice} ETH</strong>
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
        <p>{t('treasureBox.l1MarketplaceExplanation')}</p>
      </div>
    </div>
  );
} 