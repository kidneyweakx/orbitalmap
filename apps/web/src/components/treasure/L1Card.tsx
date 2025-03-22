import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, subscribeToPOI, isUserSubscribedToPOI, CONTRACTS } from '../../utils/contractUtils';
import { ContractFunctionButton } from './ContractFunctionButton';

// Sepolia Network ID
const SEPOLIA_NETWORK_ID = 11155111;

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
      // Get the embedded wallet
      const wallet = wallets.find(wallet => wallet.walletClientType === 'privy');
      
      if (!wallet) {
        setError(t('treasureBox.errorNoWallet'));
        setLoading(false);
        return;
      }
      
      // Get the provider from the wallet
      const provider = await wallet.getEthereumProvider();
      
      if (!provider) {
        setError(t('treasureBox.errorNoProvider'));
        setLoading(false);
        return;
      }
      
      // Subscribe to the POI using subscribeToPOI function
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

  // Render the card in toolbox mode with a more interactive demo
  if (isToolboxMode) {
    return (
      <div className="treasure-box-card-content">
        <div className="demo-header">
          <button className="back-button" onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h3 className="demo-title">{t('treasureBox.l1CardTitle')}</h3>
          <div className="network-badge">Sepolia</div>
        </div>
        
        <div className="card-description">
          <p>{t('treasureBox.l1CardDetailedDescription')}</p>
        </div>
        
        {/* Interactive Demo Section for Toolbox Mode */}
        <div className="demo-section">
          <div className="poi-demo-item">
            <h4>Tokyo Tower Premium Access</h4>
            <div className="poi-details">
              <span>Price: 0.000001 ETH</span>
              <span>Subscribers: 27</span>
            </div>
            <div className="poi-details">
              <span>Owner: 0x4f2a...c9b3</span>
              <span>Data: Encrypted</span>
            </div>
            <div className="poi-actions">
              <ContractFunctionButton 
                contractFunction="subscribeToPOI"
                functionArgs={["1", "0.000001"]} // poiId, price
                buttonText={t('treasureBox.subscribe')}
                networkId={SEPOLIA_NETWORK_ID}
                onSuccess={() => alert(t('treasureBox.subscriptionSuccess'))}
                onError={() => alert(t('treasureBox.subscriptionFailed'))}
              />
            </div>
          </div>
          
          <div className="poi-demo-item">
            <h4>Shibuya Crossing Insider</h4>
            <div className="poi-details">
              <span>Price: 0.000002 ETH</span>
              <span>Subscribers: 42</span>
            </div>
            <div className="poi-details">
              <span>Owner: 0x8e15...a7d4</span>
              <span>Status: Subscribed</span>
            </div>
            <div className="poi-actions">
              <button className="demo-button" onClick={() => alert('Demo mode: You already subscribed to this POI.')}>
                {t('treasureBox.subscribed')}
              </button>
            </div>
          </div>
          
          <div className="poi-demo-item">
            <h4>Register Your Own POI</h4>
            <div className="poi-details">
              <span>Create and monetize your own Points of Interest</span>
            </div>
            <div className="poi-actions">
              <ContractFunctionButton 
                contractFunction="registerPOI"
                functionArgs={[
                  "My Custom POI", // name
                  "0.000003" // stakeAmount
                ]}
                buttonText="Register POI"
                networkId={SEPOLIA_NETWORK_ID}
                onSuccess={() => alert('POI registration successful!')}
                onError={() => alert('POI registration failed!')}
              />
            </div>
          </div>
        </div>
        
        <div className="functions-section">
          <h3>{t('treasureBox.availableFunctions')}</h3>
          <div className="function-list">
            <div className="function-item">registerPOI(...) - {t('treasureBox.registerPOIDesc')}</div>
            <div className="function-item">subscribeToPOI(poiId) - {t('treasureBox.subscribeToPOIDesc')}</div>
            <div className="function-item">challengePOI(poiId) - {t('treasureBox.challengePOIDesc')}</div>
            <div className="function-item">getPOI(poiId) - {t('treasureBox.getPOIDesc')}</div>
          </div>
          
          <div className="network-info">
            <p>
              <strong>{t('treasureBox.network')}:</strong> Sepolia<br />
              <strong>{t('treasureBox.contractAddress')}:</strong> <span className="contract-address">{CONTRACTS.L1.address.substring(0, 8)}...{CONTRACTS.L1.address.substring(36)}</span><br />
              <strong>{t('treasureBox.explorer')}:</strong> 
              <a 
                href={`${CONTRACTS.L1.explorerUrl}/address/${CONTRACTS.L1.address}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="explorer-link"
              >
                {t('treasureBox.viewOnEtherscan')}
              </a>
            </p>
          </div>
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