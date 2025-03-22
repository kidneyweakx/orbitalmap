import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, subscribeToPOI, isUserSubscribedToPOI, getAuctionData, CONTRACTS } from '../utils/contractUtils';
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
  isToolboxMode?: boolean; // New prop to identify if opened from toolbox
}

// Define card selection options
enum CardType {
  L1Card = 'l1',
  L2Card = 'l2',
  TEEZONE = 'teezone'
}

// Interface matching the contract's getAuctionStatus return structure
interface AuctionData {
  validators: string[];
  bids: bigint[];
  proofData: string[];
  teeData: string[];
  endTime: bigint;
  isActive: boolean;
  winner: string;
}

// Convert contract data to a display-friendly format
interface AuctionDisplayData {
  bids: Array<{bidder: string, amount: string}>;
  highestBidder: string;
  highestBid: string;
  endTime: number;
  status: string;
}

export function TreasureBox({ 
  onClose, 
  selectedArea,
  pois = [],
  onSubscriptionSuccess,
  isToolboxMode = false
}: TreasureBoxProps) {
  const { t } = useTranslation();
  const { wallets } = useWallets();
  const { user } = usePrivy();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [premiumPOIs, setPremiumPOIs] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{[key: string]: boolean}>({});
  
  // New state variables for toolbox mode
  const [activeCard, setActiveCard] = useState<CardType | null>(isToolboxMode ? null : CardType.L1Card);
  const [auctionDisplayData, setAuctionDisplayData] = useState<AuctionDisplayData | null>(null);
  const [auctionLoading, setAuctionLoading] = useState(false);

  // Get user's embedded wallet
  const embeddedWallet = wallets?.find(wallet => wallet.walletClientType === 'privy');

  // Filter subscription-required POIs on mount
  useEffect(() => {
    if (pois && pois.length > 0) {
      const premium = pois.filter(poi => poi.requiresSubscription);
      setPremiumPOIs(premium);
    }
  }, [pois]);

  // Check subscription status for all premium POIs
  useEffect(() => {
    const checkSubscriptions = async () => {
      if (!user?.wallet?.address || premiumPOIs.length === 0) return;
      
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
  }, [user?.wallet?.address, premiumPOIs]);

  // Handle POI selection
  const handleSelectPOI = (poi: POI) => {
    setSelectedPOI(poi);
    setError(null);
    setSuccess(null);
  };
  
  // Handle L2 auction data fetch for a POI
  const fetchAuctionData = async (poi: POI) => {
    setAuctionLoading(true);
    setSelectedPOI(poi);
    setError(null);
    
    try {
      const data = await getAuctionData(BigInt(poi.id));
      
      if (data) {
        // Type assertion to match the contract's return structure
        const auctionData = data as unknown as AuctionData;
        
        // Find highest bid and bidder
        let highestBid = BigInt(0);
        let highestBidderIndex = -1;
        
        if (auctionData.bids && auctionData.bids.length > 0) {
          for (let i = 0; i < auctionData.bids.length; i++) {
            if (auctionData.bids[i] > highestBid) {
              highestBid = auctionData.bids[i];
              highestBidderIndex = i;
            }
          }
        }
        
        // Create display-friendly format
        setAuctionDisplayData({
          bids: auctionData.bids.map((amount, index) => ({
            bidder: auctionData.validators[index],
            amount: amount.toString()
          })),
          highestBidder: highestBidderIndex >= 0 ? auctionData.validators[highestBidderIndex] : auctionData.winner,
          highestBid: highestBid.toString(),
          endTime: Number(auctionData.endTime),
          status: auctionData.isActive ? 'active' : 'ended'
        });
      }
    } catch (err) {
      console.error('Error fetching auction data:', err);
      setError(t('treasureBox.errorFetchingAuction'));
    } finally {
      setAuctionLoading(false);
    }
  };

  // Handle subscription
  const handleSubscribe = async () => {
    if (!selectedPOI) return;
    if (!user) {
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

  // Toolbox mode content - selecting either L1 or L2 card
  const renderToolboxModeContent = () => {
    if (activeCard === null) {
      return (
        <div className="treasure-box-card-selector">
          <h3>{t('treasureBox.selectBlockchain')}</h3>
          
          <div className="treasure-box-card-grid">
            <div 
              className="treasure-box-card l1-card" 
              onClick={() => setActiveCard(CardType.L1Card)}
            >
              <div className="treasure-box-card-icon">🏙️</div>
              <h4>{t('treasureBox.l1Card')}</h4>
              <p>{t('treasureBox.l1CardDescription')}</p>
              <div className="treasure-box-card-network">
                <span className="network-dot sepolia"></span>
                Sepolia
              </div>
              <div className="treasure-box-card-address">
                {CONTRACTS.L1.address.substring(0, 6) + '...' + CONTRACTS.L1.address.substring(38)}
              </div>
            </div>
            
            <div 
              className="treasure-box-card l2-card" 
              onClick={() => setActiveCard(CardType.L2Card)}
            >
              <div className="treasure-box-card-icon">🔍</div>
              <h4>{t('treasureBox.l2Card')}</h4>
              <p>{t('treasureBox.l2CardDescription')}</p>
              <div className="treasure-box-card-network">
                <span className="network-dot t1"></span>
                T1
              </div>
              <div className="treasure-box-card-address">
                {CONTRACTS.L2.address.substring(0, 6) + '...' + CONTRACTS.L2.address.substring(38)}
              </div>
            </div>
          </div>
          
          <div className="treasure-box-info">
            <h4>{t('treasureBox.howItWorks')}</h4>
            <p>{t('treasureBox.crossChainExplanation')}</p>
          </div>
        </div>
      );
    }
    
    // L1 POI Marketplace card content
    if (activeCard === CardType.L1Card) {
      return (
        <div className="treasure-box-card-content">
          <button className="back-button" onClick={() => setActiveCard(null)}>
            ← {t('common.back')}
          </button>
          
          <h3>{t('treasureBox.l1CardTitle')}</h3>
          <p className="card-description">{t('treasureBox.l1CardDetailedDescription')}</p>
          
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
    
    // L2 POI Auction card content
    if (activeCard === CardType.L2Card) {
      return (
        <div className="treasure-box-card-content">
          <button className="back-button" onClick={() => setActiveCard(null)}>
            ← {t('common.back')}
          </button>
          
          <h3>{t('treasureBox.l2CardTitle')}</h3>
          <p className="card-description">{t('treasureBox.l2CardDetailedDescription')}</p>
          
          <div className="function-list">
            <h4>{t('treasureBox.availableFunctions')}</h4>
            <ul>
              <li>bidForVerification(poiId, proofData, teeData) - {t('treasureBox.bidForVerificationDesc')}</li>
              <li>getAuctionStatus(poiId) - {t('treasureBox.getAuctionStatusDesc')}</li>
              <li>sendVerificationResult(poiId, validator, isVerified, verificationData) - {t('treasureBox.sendVerificationResultDesc')}</li>
            </ul>
          </div>
          
          <div className="network-info">
            <h4>{t('treasureBox.networkInfo')}</h4>
            <p>
              <strong>{t('treasureBox.network')}:</strong> T1<br />
              <strong>{t('treasureBox.contractAddress')}:</strong> {CONTRACTS.L2.address}<br />
              <strong>{t('treasureBox.explorer')}:</strong> 
              <a 
                href={`${CONTRACTS.L2.explorerUrl}/address/${CONTRACTS.L2.address}`} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                {t('treasureBox.viewOnT1Explorer')}
              </a>
            </p>
          </div>
          
          <div className="treasure-box-info">
            <p>{t('treasureBox.l2InfoText')}</p>
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Area mode content - subscribing to POIs in a selected area
  const renderAreaModeContent = () => {
    return (
      <>
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
            
            <div className="button-group">
              <button 
                className="subscribe-button" 
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? t('treasureBox.subscribing') : t('treasureBox.subscribe')}
              </button>
              
              <button 
                className="view-auction-button" 
                onClick={() => fetchAuctionData(selectedPOI!)}
                disabled={auctionLoading}
              >
                {auctionLoading ? t('treasureBox.loadingAuction') : t('treasureBox.viewAuctionStatus')}
              </button>
            </div>
          </div>
        )}
        
        {/* Display auction data if available */}
        {selectedPOI && auctionDisplayData && (
          <div className="auction-status">
            <h3>{t('treasureBox.auctionDetails')}</h3>
            
            <div className="auction-details">
              <p><strong>{t('treasureBox.poiName')}:</strong> {selectedPOI.name}</p>
              <p><strong>{t('treasureBox.auctionStatus')}:</strong> {auctionDisplayData.status === 'active' ? t('treasureBox.active') : t('treasureBox.ended')}</p>
              <p><strong>{t('treasureBox.endTime')}:</strong> {new Date(Number(auctionDisplayData.endTime) * 1000).toLocaleString()}</p>
              <p><strong>{t('treasureBox.bidCount')}:</strong> {auctionDisplayData.bids.length}</p>
              {auctionDisplayData.highestBidder !== '0x0000000000000000000000000000000000000000' && (
                <p><strong>{t('treasureBox.winner')}:</strong> {auctionDisplayData.highestBidder}</p>
              )}
            </div>
            
            <button 
              className="close-auction-button" 
              onClick={() => setAuctionDisplayData(null)}
            >
              {t('common.close')}
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
      </>
    );
  };

  return (
    <div className="treasure-box-container">
      <div className="treasure-box-header">
        <h2>{t('treasureBox.title')}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="treasure-box-content">
        {isToolboxMode ? renderToolboxModeContent() : renderAreaModeContent()}
      </div>
    </div>
  );
} 