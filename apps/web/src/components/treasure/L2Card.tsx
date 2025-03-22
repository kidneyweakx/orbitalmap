import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatEther, parseEther } from 'viem';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, CONTRACTS, getAuctionData, bidOnPOI } from '../../utils/contractUtils';
import { ContractFunctionButton } from './ContractFunctionButton';

// T1 Network ID (Ex-Optimism)
const T1_NETWORK_ID = 11155420;

// Local interface for auction data with bigint types
interface AuctionData {
  highestBid: bigint;
  highestBidder: string;
  endTime: number;
  active: boolean;
}

interface AuctionDisplayData {
  poiId: string;
  poiName: string;
  currentBid: string;
  timeRemaining: string;
  isUserHighestBidder: boolean;
}

interface L2CardProps {
  onBack: () => void;
  selectedArea?: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    radius: number; // radius in kilometers
  };
  pois?: POI[];
  onBidSuccess?: () => void;
  isToolboxMode?: boolean;
}

export function L2Card({ 
  onBack, 
  selectedArea, 
  pois = [], 
  onBidSuccess, 
  isToolboxMode = false 
}: L2CardProps) {
  const { t } = useTranslation();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [auctionPOIs, setAuctionPOIs] = useState<POI[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [auctionData, setAuctionData] = useState<{[key: string]: AuctionData}>({});
  const [bidAmount, setBidAmount] = useState<string>('');
  const [displayData, setDisplayData] = useState<{[key: string]: AuctionDisplayData}>({});
  
  // Filter auction-enabled POIs
  useEffect(() => {
    if (pois && pois.length > 0) {
      const auctionable = pois.filter(poi => poi.isAuctionEnabled);
      setAuctionPOIs(auctionable);
      
      // Fetch auction data for all auctionable POIs
      if (auctionable.length > 0) {
        fetchAuctionData(auctionable);
      }
    }
  }, [pois]);

  // Refresh auction data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (auctionPOIs.length > 0) {
        fetchAuctionData(auctionPOIs);
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [auctionPOIs]);

  // Update display data whenever auction data changes
  useEffect(() => {
    updateDisplayData();
  }, [auctionData, user?.wallet?.address]);

  // Format auction data for display
  const updateDisplayData = () => {
    const data: {[key: string]: AuctionDisplayData} = {};
    
    for (const poi of auctionPOIs) {
      const auction = auctionData[poi.id];
      if (!auction) continue;
      
      // Calculate time remaining
      const now = Math.floor(Date.now() / 1000);
      const timeRemaining = auction.endTime > now 
        ? formatTimeRemaining(auction.endTime - now)
        : t('treasureBox.auctionEnded');
      
      // Check if user is highest bidder
      const isUserHighestBidder = user?.wallet?.address
        ? auction.highestBidder.toLowerCase() === user.wallet.address.toLowerCase()
        : false;
      
      data[poi.id] = {
        poiId: poi.id,
        poiName: poi.name,
        currentBid: formatEther(auction.highestBid),
        timeRemaining,
        isUserHighestBidder
      };
    }
    
    setDisplayData(data);
  };

  // Format time remaining in human-readable format
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return t('treasureBox.auctionEnded');
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Fetch auction data for all auctionable POIs
  const fetchAuctionData = async (poiList: POI[]) => {
    const data: {[key: string]: AuctionData} = {};
    
    for (const poi of poiList) {
      try {
        const auctionResult = await getAuctionData(BigInt(poi.id));
        if (auctionResult.success && auctionResult.data) {
          // Convert string format to bigint format for local usage
          data[poi.id] = {
            highestBid: parseEther(auctionResult.data.highestBid),
            highestBidder: auctionResult.data.highestBidder,
            endTime: auctionResult.data.endTime,
            active: auctionResult.data.active
          };
        }
      } catch (error) {
        console.error("Error fetching auction data for POI:", poi.id, error);
      }
    }
    
    setAuctionData(data);
  };

  // Handle POI selection
  const handleSelectPOI = (poi: POI) => {
    setSelectedPOI(poi);
    setError(null);
    setSuccess(null);
    
    // Set default bid amount to current highest bid + 10% or a minimum small value
    if (auctionData[poi.id]) {
      const currentBid = auctionData[poi.id].highestBid;
      // For very small bids, add a small fixed amount instead of percentage
      const minBid = currentBid < parseEther("0.0001") 
        ? currentBid + parseEther("0.0000001")  // Add 0.0000001 ETH to small bids
        : currentBid + (currentBid / BigInt(10)); // Add 10% to larger bids
      setBidAmount(formatEther(minBid));
    } else {
      // Default small bid if no auction data
      setBidAmount("0.0000001");
    }
  };

  // Handle bid amount change
  const handleBidAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBidAmount(e.target.value);
  };

  // Handle placing a bid
  const handlePlaceBid = async () => {
    if (!selectedPOI) return;
    if (!user?.wallet?.address) {
      setError(t('treasureBox.errorNoWallet'));
      return;
    }
    
    // Validate bid amount
    try {
      const bidValue = parseEther(bidAmount);
      const currentBid = auctionData[selectedPOI.id]?.highestBid || BigInt(0);
      
      // For very small bids, require at least 0.0000001 ETH more
      const minIncrease = currentBid < parseEther("0.0001")
        ? parseEther("0.0000001") // 0.0000001 ETH minimum increase for small bids
        : currentBid / BigInt(10); // 10% minimum increase for larger bids
        
      if (bidValue <= currentBid) {
        setError(t('treasureBox.errorBidTooLow'));
        return;
      }
      
      if (bidValue < currentBid + minIncrease) {
        setError(`${t('treasureBox.errorBidIncreaseTooSmall')} (min: ${formatEther(currentBid + minIncrease)} ETH)`);
        return;
      }
    } catch (error) {
      console.error("Invalid bid amount:", error);
      setError(t('treasureBox.errorInvalidBid'));
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
      
      // Place bid on the POI using bidOnPOI function
      const result = await bidOnPOI(
        provider, 
        BigInt(selectedPOI.id), 
        parseEther(bidAmount)
      );

      if (result.success) {
        setSuccess(t('treasureBox.bidSuccess'));
        // Refresh auction data
        fetchAuctionData([selectedPOI]);
        if (onBidSuccess) {
          onBidSuccess();
        }
      } else {
        setError(result.error || t('treasureBox.bidFailed'));
      }
    } catch (err) {
      console.error('Error bidding on POI:', err);
      setError(t('treasureBox.bidError'));
    } finally {
      setLoading(false);
    }
  };

  // Render the card in toolbox mode with a demo bidding interface
  if (isToolboxMode) {
    return (
      <div className="treasure-box-card-content">
        <div className="demo-header">
          <button className="back-button" onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h3 className="demo-title">{t('treasureBox.l2CardTitle')}</h3>
          <div className="network-badge">T1 (Ex-Optimism)</div>
        </div>
        
        <div className="card-description">
          <p>{t('treasureBox.l2CardDetailedDescription')}</p>
        </div>
        
        {/* Interactive Demo Section for Toolbox Mode */}
        <div className="demo-section">
          <div className="auction-item">
            <div className="auction-header">
              <h4 className="auction-title">Tokyo City Center POI</h4>
              <div className="auction-timer">2h 15m left</div>
            </div>
            <div className="auction-info">
              <span>Current bid: 0.000001 ETH</span>
              <span>Highest bidder: 0x7a21...f8e9</span>
            </div>
            
            <div className="bid-form">
              <input
                type="number"
                className="bid-input"
                step="0.0000001"
                min="0.0000011"
                placeholder="0.0000011"
              />
              <ContractFunctionButton 
                contractFunction="bidOnPOI"
                functionArgs={["1", "0.0000011"]} // poiId, bidAmount
                buttonText={t('treasureBox.placeBid')}
                networkId={T1_NETWORK_ID}
                onSuccess={() => alert(t('treasureBox.bidSuccess'))}
                onError={() => alert(t('treasureBox.bidFailed'))}
              />
            </div>
          </div>
          
          <div className="auction-item">
            <div className="auction-header">
              <h4 className="auction-title">Mount Fuji Viewpoint</h4>
              <div className="auction-timer">Auction ended</div>
            </div>
            <div className="auction-info">
              <span>Final bid: 0.000005 ETH</span>
              <span>Winner: 0x3b91...c4d2</span>
            </div>
            <div className="poi-actions">
              <button className="demo-button" onClick={() => alert('Demo mode: Auction details would be shown in a real environment.')}>
                View Details
              </button>
            </div>
          </div>
          
          <div className="auction-item">
            <div className="auction-header">
              <h4 className="auction-title">Kyoto Bamboo Forest</h4>
              <div className="auction-timer">1d 3h left</div>
            </div>
            <div className="auction-info">
              <span>Current bid: 0.0000015 ETH</span>
              <span>Your status: Highest bidder</span>
            </div>
            <div className="poi-actions">
              <ContractFunctionButton 
                contractFunction="bidOnPOI"
                functionArgs={["3", "0.000002"]} // poiId, bidAmount
                buttonText="Increase Bid"
                networkId={T1_NETWORK_ID}
                onSuccess={() => alert('Your bid has been increased!')}
                onError={() => alert('Failed to increase bid!')}
              />
            </div>
          </div>
        </div>
        
        <div className="functions-section">
          <h3>{t('treasureBox.availableFunctions')}</h3>
          <div className="function-list">
            <div className="function-item">createAuction(poiId, startingBid, duration) - {t('treasureBox.createAuctionDesc')}</div>
            <div className="function-item">bid(auctionId, bidAmount) - {t('treasureBox.bidDesc')}</div>
            <div className="function-item">claimPOI(auctionId) - {t('treasureBox.claimPOIDesc')}</div>
            <div className="function-item">getAuctionData(auctionId) - {t('treasureBox.getAuctionDataDesc')}</div>
          </div>
          
          <div className="network-info">
            <p>
              <strong>{t('treasureBox.network')}:</strong> T1 (Ex-Optimism)<br />
              <strong>{t('treasureBox.contractAddress')}:</strong> <span className="contract-address">{CONTRACTS.L2.address.substring(0, 8)}...{CONTRACTS.L2.address.substring(36)}</span><br />
              <strong>{t('treasureBox.explorer')}:</strong> 
              <a 
                href={`${CONTRACTS.L2.explorerUrl}/address/${CONTRACTS.L2.address}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="explorer-link"
              >
                {t('treasureBox.viewOnExplorer')}
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render the L2 card for actual bidding
  return (
    <div className="l2-card-content">
      {selectedArea && (
        <div className="selected-area">
          <h3>{t('treasureBox.selectedArea')}: {selectedArea.name}</h3>
          <p>{t('treasureBox.coordinates')}: {selectedArea.coordinates[1].toFixed(4)}, {selectedArea.coordinates[0].toFixed(4)}</p>
        </div>
      )}
      
      {auctionPOIs.length === 0 ? (
        <div className="no-pois">
          <p>{t('treasureBox.noAuctionPOIs')}</p>
        </div>
      ) : (
        <div className="auction-pois-list">
          <h3>{t('treasureBox.availableAuctions')}</h3>
          <ul>
            {auctionPOIs.map(poi => {
              const display = displayData[poi.id];
              if (!display) return null;
              
              return (
                <li 
                  key={poi.id}
                  className={`poi-item ${selectedPOI?.id === poi.id ? 'selected' : ''} ${display.isUserHighestBidder ? 'winning' : ''}`}
                  onClick={() => handleSelectPOI(poi)}
                >
                  <div className="poi-info">
                    <div className="poi-name">{poi.name}</div>
                    <div className="poi-auction-status">
                      {display.isUserHighestBidder && (
                        <span className="winning-tag">{t('treasureBox.winning')}</span>
                      )}
                    </div>
                  </div>
                  <div className="poi-auction-data">
                    <div className="current-bid">{display.currentBid} ETH</div>
                    <div className="time-remaining">{display.timeRemaining}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {selectedPOI && auctionData[selectedPOI.id] && (
        <div className="bid-details">
          <h3>{t('treasureBox.bidDetails')}</h3>
          <p className="poi-name">{selectedPOI.name}</p>
          
          <div className="auction-info">
            <div className="info-row">
              <span>{t('treasureBox.currentBid')}:</span>
              <span>{displayData[selectedPOI.id]?.currentBid} ETH</span>
            </div>
            <div className="info-row">
              <span>{t('treasureBox.timeRemaining')}:</span>
              <span>{displayData[selectedPOI.id]?.timeRemaining}</span>
            </div>
            <div className="info-row">
              <span>{t('treasureBox.highestBidder')}:</span>
              <span className="address">{auctionData[selectedPOI.id].highestBidder.substring(0, 6)}...{auctionData[selectedPOI.id].highestBidder.substring(38)}</span>
            </div>
          </div>
          
          {displayData[selectedPOI.id]?.timeRemaining !== t('treasureBox.auctionEnded') && (
            <div className="bid-form">
              <div className="input-group">
                <label htmlFor="bidAmount">{t('treasureBox.yourBid')}</label>
                <div className="bid-input-wrapper">
                  <input
                    id="bidAmount"
                    type="number"
                    step="0.001"
                    min="0"
                    value={bidAmount}
                    onChange={handleBidAmountChange}
                    disabled={loading}
                  />
                  <span className="currency">ETH</span>
                </div>
              </div>
              
              <button 
                className="bid-button" 
                onClick={handlePlaceBid}
                disabled={loading || !bidAmount}
              >
                {loading ? t('treasureBox.placingBid') : t('treasureBox.placeBid')}
              </button>
            </div>
          )}
          
          {displayData[selectedPOI.id]?.timeRemaining === t('treasureBox.auctionEnded') && (
            <div className="auction-ended">
              <p>{t('treasureBox.auctionEndedMessage')}</p>
              {displayData[selectedPOI.id]?.isUserHighestBidder && (
                <p className="winner-message">{t('treasureBox.youWonMessage')}</p>
              )}
            </div>
          )}
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="treasure-box-info">
        <h4>{t('treasureBox.howItWorks')}</h4>
        <p>{t('treasureBox.l2AuctionExplanation')}</p>
      </div>
    </div>
  );
} 