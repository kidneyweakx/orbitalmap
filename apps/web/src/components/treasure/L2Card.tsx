import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { POI, getAuctionStatus, CONTRACTS } from '../../utils/contractUtils';

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

interface L2CardProps {
  onBack: () => void;
  selectedPOI?: POI;
  isToolboxMode?: boolean;
}

export function L2Card({ onBack, selectedPOI, isToolboxMode = false }: L2CardProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [auctionDisplayData, setAuctionDisplayData] = useState<AuctionDisplayData | null>(null);
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [viewingBids, setViewingBids] = useState(false);

  // Handle auction data fetch for a POI
  const fetchAuctionData = async (poi: POI) => {
    setAuctionLoading(true);
    setError(null);
    
    try {
      const data = await getAuctionStatus(BigInt(poi.id));
      
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
        
        setViewingBids(true);
      }
    } catch (err) {
      console.error('Error fetching auction data:', err);
      setError(t('treasureBox.errorFetchingAuction'));
    } finally {
      setAuctionLoading(false);
    }
  };

  // Handle closing bid view
  const closeBidView = () => {
    setViewingBids(false);
    setAuctionDisplayData(null);
  };

  if (isToolboxMode) {
    return (
      <div className="treasure-box-card-content">
        <div className="card-header l2-header">
          <button className="back-button" onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h3>{t('treasureBox.l2CardTitle')}</h3>
        </div>
        
        <div className="network-indicator">
          <span className="network-dot t1"></span>
          T1
        </div>
        
        <div className="card-description">
          <p>{t('treasureBox.l2CardDetailedDescription')}</p>
        </div>
        
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

  if (viewingBids && auctionDisplayData) {
    return (
      <div className="bid-list-container">
        <div className="bid-list-header">
          <button className="back-button" onClick={closeBidView}>
            ← {t('common.back')}
          </button>
          <h3>{t('treasureBox.auctionStatus')}</h3>
        </div>
        
        <div className="auction-status">
          <p><strong>{t('treasureBox.poiName')}:</strong> {selectedPOI?.name}</p>
          <p><strong>{t('treasureBox.auctionStatus')}:</strong> {auctionDisplayData.status === 'active' ? t('treasureBox.active') : t('treasureBox.ended')}</p>
          <p><strong>{t('treasureBox.endTime')}:</strong> {new Date(Number(auctionDisplayData.endTime) * 1000).toLocaleString()}</p>
          <p><strong>{t('treasureBox.bidCount')}:</strong> {auctionDisplayData.bids.length}</p>
          
          {auctionDisplayData.highestBidder !== '0x0000000000000000000000000000000000000000' && (
            <p className="highest-bid">
              <strong>{t('treasureBox.auctionWinner')}:</strong> {auctionDisplayData.highestBidder.substring(0, 6)}...{auctionDisplayData.highestBidder.substring(38)}
            </p>
          )}
        </div>
        
        <div className="bid-list">
          <h4>{t('treasureBox.currentBids')}</h4>
          
          {auctionDisplayData.bids.length === 0 ? (
            <p>{t('treasureBox.noBids')}</p>
          ) : (
            <ul className="bid-list-items">
              {auctionDisplayData.bids.map((bid, index) => (
                <li key={index} className="bid-list-item">
                  <div className="bid-list-col bidder">
                    {bid.bidder.substring(0, 6)}...{bid.bidder.substring(38)}
                  </div>
                  <div className="bid-list-col amount">
                    {bid.amount} ETH
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  return (
    <div className="l2-card-content">
      {selectedPOI ? (
        <div className="poi-details">
          <h3>{selectedPOI.name}</h3>
          <p>ID: {selectedPOI.id}</p>
          <p>Location: {selectedPOI.lat.toFixed(4)}, {selectedPOI.lng.toFixed(4)}</p>
          
          <button 
            className="view-bids-button" 
            onClick={() => fetchAuctionData(selectedPOI)}
            disabled={auctionLoading}
          >
            {auctionLoading ? t('treasureBox.loadingAuction') : t('treasureBox.viewAuctionStatus')}
          </button>
        </div>
      ) : (
        <p>{t('treasureBox.selectPOIPrompt')}</p>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="treasure-box-info">
        <h4>{t('treasureBox.howItWorks')}</h4>
        <p>{t('treasureBox.l2InfoText')}</p>
      </div>
    </div>
  );
} 