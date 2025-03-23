import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI } from '../../utils/contractUtils';

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
  onShowOnMap?: (lat: number, lng: number) => void;
}

export function L2DetailCard({ onBack, onShowOnMap }: L2DetailCardProps) {
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
    
    if (timeRemaining <= 0) return t('treasureBox.auction.ended');
    
    const seconds = Math.floor((timeRemaining / 1000) % 60);
    const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
    const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
    const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
    
    if (days > 0) return t('treasureBox.auction.daysHours', { days, hours });
    if (hours > 0) return t('treasureBox.auction.hoursMinutes', { hours, minutes });
    return t('treasureBox.auction.minutesSeconds', { minutes, seconds });
  };

  // Fetch user's POI bids from L2 contract
  const fetchUserPOIs = async () => {
    setLoading(true);
    setError(null);
    try {
      const userAddress = user?.wallet?.address;
      if (!userAddress) {
        throw new Error(t('treasureBox.errors.noWalletAddress'));
      }

      // This should call the contract to get real data
      // Simulating network request delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // This should be replaced with actual contract calls
      // But since there's no actual backend/contract connection, keeping empty array for now
      // In a real application, this would fetch data from the contract
      const pois: POIDetail[] = [];
      
      setUserPOIs(pois);
    } catch (err) {
      console.error('Error fetching POI bids:', err);
      setError(err instanceof Error ? err.message : t('treasureBox.errors.fetchBidsFailure'));
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

  // Navigate to coordinates on the map
  const handleShowOnMap = (lat: number, lng: number) => {
    if (onShowOnMap) {
      onShowOnMap(lat, lng);
      onBack(); // Return to map
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="detail-card-container">
        <div className="detail-card-header">
          <button className="back-button" onClick={onBack}>
            ← {t('treasureBox.back')}
          </button>
          <h3>{t('treasureBox.l2DetailCardName', 'Your POI Bids in L2')}</h3>
        </div>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>{t('treasureBox.loading', 'Loading your bids...')}</p>
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
          <h3>{t('treasureBox.l2DetailCardName', 'Your POI Bids in L2')}</h3>
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
              <span className="detail-value">{selectedPOI.isAuctionEnabled ? t('common.yes') : t('common.no')}</span>
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
            <button 
              onClick={() => handleShowOnMap(selectedPOI.lat, selectedPOI.lng)}
              className="show-on-map-btn"
            >
              {t('treasureBox.showOnMap', 'Show on Map')}
            </button>
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
        <h3>{t('treasureBox.l2DetailCardName', 'Your POI Bids in L2')}</h3>
      </div>
      
      <div className="poi-list-container">
        <h4>{t('treasureBox.yourBids', 'Your Bids on L2')}</h4>
        
        {userPOIs.length === 0 ? (
          <div className="no-pois-message">
            <p>{t('treasureBox.noBids', 'You don\'t have any bids on L2 yet.')}</p>
            <div className="empty-state-actions">
              <button 
                className="action-button" 
                onClick={onBack}
                style={{ marginTop: '16px' }}
              >
                {t('treasureBox.exploreBids', 'Explore Available POIs')}
              </button>
            </div>
          </div>
        ) : (
          <div className="poi-list">
            {userPOIs.map((poi) => (
              <div key={poi.id} className="poi-item">
                <div className="poi-header">
                  <h4>{poi.name}</h4>
                  <span className="poi-id">ID: {poi.id}</span>
                </div>
                <div className="poi-location">
                  {poi.lat.toFixed(4)}, {poi.lng.toFixed(4)}
                </div>
                <div className="poi-info">
                  <span className="poi-order">{t('treasureBox.order', 'Order')}: {poi.order}</span>
                  {poi.isAuctionEnabled && (
                    <span className="auction-status">
                      {poi.auctionActive ? (
                        <>
                          <span className="auction-badge active">{t('treasureBox.auction.active', 'Auction Active')}</span>
                          <span className="highest-bid">{poi.highestBid} ETH</span>
                        </>
                      ) : (
                        <span className="auction-badge inactive">{t('treasureBox.auction.inactive', 'Auction Inactive')}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="poi-footer">
                  <div className="poi-actions">
                    <button 
                      className="view-details-btn"
                      onClick={() => handleViewDetails(poi)}
                    >
                      {t('treasureBox.viewDetails', 'View Details')}
                    </button>
                    <button 
                      className="show-on-map-btn"
                      onClick={() => handleShowOnMap(poi.lat, poi.lng)}
                    >
                      {t('treasureBox.showOnMap', 'Show on Map')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 