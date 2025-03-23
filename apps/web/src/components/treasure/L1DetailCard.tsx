import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { POI } from '../../utils/contractUtils';

// Define POI details type for display
interface POIDetail extends POI {
  chainId: number;
  network: string;
}

interface L1DetailCardProps {
  onBack: () => void;
  onShowOnMap?: (lat: number, lng: number) => void;
}

export function L1DetailCard({ onBack, onShowOnMap }: L1DetailCardProps) {
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

  // Fetch user's POIs directly from the contract
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
      console.error('Error fetching POIs:', err);
      setError(err instanceof Error ? err.message : t('treasureBox.errors.fetchPoiFailure'));
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
          <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
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
          <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
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
              <span className="detail-label">{t('treasureBox.subscriptionPrice', 'Subscription Price')}:</span>
              <span className="detail-value">{selectedPOI.subscriptionPrice} ETH</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.requiresSubscription', 'Requires Subscription')}:</span>
              <span className="detail-value">{selectedPOI.requiresSubscription ? t('common.yes') : t('common.no')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('treasureBox.verified', 'Verified')}:</span>
              <span className="detail-value">{selectedPOI.verified ? t('common.yes') : t('common.no')}</span>
            </div>
          </div>
          
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

  // Render list of user's POIs or empty state
  return (
    <div className="detail-card-container">
      <div className="detail-card-header">
        <button className="back-button" onClick={onBack}>
          ← {t('treasureBox.back')}
        </button>
        <h3>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h3>
      </div>
      
      <div className="poi-list-container">
        <h4>{t('treasureBox.yourPOIs', 'Your POIs on L1')}</h4>
        
        {userPOIs.length === 0 ? (
          <div className="no-pois-message">
            <p>{t('treasureBox.noPOIs', 'You don\'t have any POIs on L1 yet.')}</p>
            <div className="empty-state-actions">
              <button 
                className="action-button" 
                onClick={onBack}
                style={{ marginTop: '16px' }}
              >
                {t('treasureBox.addPOI', 'Add POI')}
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
                <div className="poi-footer">
                  <span className={`poi-status ${poi.verified ? 'verified' : 'unverified'}`}>
                    {poi.verified ? t('treasureBox.verified', 'Verified') : t('treasureBox.unverified', 'Unverified')}
                  </span>
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