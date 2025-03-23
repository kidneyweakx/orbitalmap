import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI, CONTRACTS } from '../../utils/contractUtils';

// Define POI details type for display
interface POIDetail extends POI {
  chainId: number;
  network: string;
  order?: number;
  highestBid?: string;
  highestBidder?: string;
  auctionEndTime?: number;
  auctionActive?: boolean;
}

interface L2DetailCardProps {
  onBack: () => void;
  isToolboxMode?: boolean;
}

export function L2DetailCard({ onBack }: L2DetailCardProps) {
  const { t } = useTranslation();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [loading, setLoading] = useState<boolean>(true);
  const [userPOIs, setUserPOIs] = useState<POIDetail[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POIDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && wallets.length > 0) {
      fetchUserPOIs();
    }
  }, [user, wallets]);

  // Format time remaining for auction
  const formatTimeRemaining = (endTime: number): string => {
    const now = Date.now();
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) return 'Ended';
    
    const seconds = Math.floor((timeRemaining / 1000) % 60);
    const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
    const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  // Fetch user's POIs from L2 contract
  const fetchUserPOIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const userAddress = user?.wallet?.address;
      if (!userAddress) {
        throw new Error('No wallet address found');
      }

      // Mock data for demonstration
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockPOIs: POIDetail[] = [
        {
          id: '1',
          name: 'Brooklyn Bridge',
          lat: 40.7061,
          lng: -73.9969,
          owner: userAddress,
          subscriptionPrice: '0.01',
          requiresSubscription: false,
          verified: true,
          isAuctionEnabled: true,
          chainId: CONTRACTS.L2.chainId,
          network: 'T1',
          order: 5,
          highestBid: '0.15',
          highestBidder: '0x8765...4321',
          auctionEndTime: Date.now() + 86400000, // 24 hours from now
          auctionActive: true
        },
        {
          id: '3',
          name: 'Battery Park',
          lat: 40.7032,
          lng: -74.0153,
          owner: userAddress,
          subscriptionPrice: '0.005',
          requiresSubscription: false,
          verified: true,
          isAuctionEnabled: false,
          chainId: CONTRACTS.L2.chainId,
          network: 'T1',
          order: 2
        }
      ];

      setUserPOIs(mockPOIs);
    } catch (err) {
      console.error('Error fetching POIs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch your POIs');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (poi: POIDetail) => {
    setSelectedPOI(poi);
  };

  const handleCloseDetails = () => {
    setSelectedPOI(null);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={onBack}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{t('treasureBox.l2DetailCardName', 'L2 Detail')}</h3>
        </div>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>{t('treasureBox.loading', 'Loading your POIs...')}</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={onBack}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{t('treasureBox.l2DetailCardName', 'L2 Detail')}</h3>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button className="action-button" onClick={fetchUserPOIs}>
            {t('treasureBox.retry', 'Retry')}
          </button>
        </div>
      </div>
    );
  }

  // Render POI details
  if (selectedPOI) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={handleCloseDetails}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{selectedPOI.name}</h3>
        </div>
        <div className="poi-detail-content">
          <div className="network-info">
            <span className="network-badge">{selectedPOI.network}</span>
            <span className="chain-id">Chain ID: {selectedPOI.chainId}</span>
          </div>
          
          <div className="detail-section">
            <h4>{t('treasureBox.poiDetails', 'POI Details')}</h4>
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{selectedPOI.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.coordinates', 'Coordinates')}:</span>
              <span className="detail-value">{selectedPOI.lat}, {selectedPOI.lng}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.owner', 'Owner')}:</span>
              <span className="detail-value truncate">{selectedPOI.owner}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.order', 'Order')}:</span>
              <span className="detail-value">{selectedPOI.order}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.auctionEnabled', 'Auction Enabled')}:</span>
              <span className="detail-value">{selectedPOI.isAuctionEnabled ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          {selectedPOI.isAuctionEnabled && selectedPOI.auctionActive && (
            <div className="detail-section auction-section">
              <h4>{t('treasureBox.auctionDetails', 'Auction Details')}</h4>
              <div className="detail-item">
                <span className="detail-label">{t('treasureBox.highestBid', 'Highest Bid')}:</span>
                <span className="detail-value">{selectedPOI.highestBid} ETH</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">{t('treasureBox.highestBidder', 'Highest Bidder')}:</span>
                <span className="detail-value truncate">{selectedPOI.highestBidder}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">{t('treasureBox.timeRemaining', 'Time Remaining')}:</span>
                <span className="detail-value">
                  {selectedPOI.auctionEndTime ? formatTimeRemaining(selectedPOI.auctionEndTime) : 'N/A'}
                </span>
              </div>
            </div>
          )}
          
          <div className="detail-actions">
            <a 
              href={`${CONTRACTS.L2.explorerUrl}/token/${CONTRACTS.L2.address}?a=${selectedPOI.id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="explorer-link"
            >
              {t('treasureBox.viewOnExplorer', 'View on Explorer')}
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render list of user's POIs
  return (
    <div className="detail-card-container">
      <div className="detail-card-header">
        <button className="back-button" onClick={onBack}>
          ← {t('treasureBox.back')}
        </button>
        <h3>{t('treasureBox.l2DetailCardName', 'L2 Detail')}</h3>
      </div>
      
      <div className="poi-list-container">
        <h4>{t('treasureBox.yourPOIs', 'Your POIs on L2')}</h4>
        
        {userPOIs.length === 0 ? (
          <div className="no-pois-message">
            <p>{t('treasureBox.noPOIs', 'You don\'t have any POIs on L2 yet.')}</p>
          </div>
        ) : (
          <div className="poi-list">
            {userPOIs.map((poi) => (
              <div key={poi.id} className="poi-item" onClick={() => handleViewDetails(poi)}>
                <div className="poi-header">
                  <h4>{poi.name}</h4>
                  <span className="poi-id">ID: {poi.id}</span>
                </div>
                <div className="poi-location">
                  {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                </div>
                <div className="poi-info">
                  <span className="poi-order">Order: {poi.order}</span>
                  {poi.isAuctionEnabled && (
                    <span className="auction-status">
                      {poi.auctionActive ? (
                        <>
                          <span className="auction-badge active">Auction Active</span>
                          <span className="highest-bid">{poi.highestBid} ETH</span>
                        </>
                      ) : (
                        <span className="auction-badge inactive">Auction Inactive</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="poi-footer">
                  <button className="view-details-btn">
                    {t('treasureBox.viewDetails', 'View Details')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 