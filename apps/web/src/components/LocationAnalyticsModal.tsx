import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocationAnalytics, LocationAnalytics } from '../utils/privacyUtils';

interface LocationAnalyticsModalProps {
  locationName: string;
  coordinates: [number, number];
  onClose: () => void;
}

/**
 * Modal component to display privacy-preserving analytics for a location.
 * All analytics data is processed within the TEE to ensure user privacy.
 */
export function LocationAnalyticsModal({ 
  locationName, 
  coordinates, 
  onClose 
}: LocationAnalyticsModalProps) {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<LocationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch analytics data when the component mounts
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Request analytics from the TEE
        const data = await getLocationAnalytics(
          coordinates[1], // latitude
          coordinates[0], // longitude
          0.5 // radius in km
        );
        
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch location analytics:', err);
        setError(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAnalytics();
  }, [coordinates, t]);
  
  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Format hour to readable time
  const formatHour = (hour: number) => {
    return t('analytics.hourFormat', { hour });
  };
  
  return (
    <div className="location-analytics-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000
      }}
      onClick={onClose}
    >
      <div className="location-analytics-modal"
        style={{
          backgroundColor: '#222',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '550px',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '25px',
          color: 'white',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="analytics-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: '1px solid #444'
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 5px 0' }}>{t('analytics.title')}</h2>
            <div className="location-name" style={{ fontSize: '18px' }}>
              {locationName}
            </div>
            <div className="encrypted-notice"
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '8px',
                color: '#9c27b0',
                fontWeight: 'bold'
              }}
            >
              <span style={{ marginRight: '6px' }}>🔒</span>
              {t('analytics.subtitle')}
            </div>
          </div>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        
        {isLoading ? (
          <div className="analytics-loading"
            style={{
              textAlign: 'center',
              padding: '40px 20px'
            }}
          >
            <div className="loading-spinner"
              style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                borderTop: '4px solid #fff',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px'
              }}
            ></div>
            <p>{t('analytics.fetchingData')}</p>
          </div>
        ) : error ? (
          <div className="analytics-error"
            style={{
              textAlign: 'center',
              padding: '30px',
              color: '#f44336'
            }}
          >
            <p>{error}</p>
            <p>{t('analytics.noDataAvailable')}</p>
          </div>
        ) : analytics ? (
          <div className="analytics-content">
            <div className="tee-indicator"
              style={{
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px'
              }}
            >
              <span className="tee-icon" style={{ marginRight: '10px', fontSize: '20px' }}>🛡️</span>
              <span>{t('analytics.visitsDescription')}</span>
            </div>
            
            <div className="analytics-section"
              style={{
                marginBottom: '25px',
                backgroundColor: '#333',
                borderRadius: '10px',
                padding: '15px'
              }}
            >
              <h3 style={{ marginTop: '0', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                {t('analytics.visitorStats')}
              </h3>
              
              <div className="analytics-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '15px',
                  marginTop: '15px'
                }}
              >
                <div className="analytics-item">
                  <div className="item-label" style={{ color: '#999', marginBottom: '5px' }}>
                    {t('privacy.visits24h')}
                  </div>
                  <div className="item-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {analytics.analytics.visits24h}
                  </div>
                </div>
                
                <div className="analytics-item">
                  <div className="item-label" style={{ color: '#999', marginBottom: '5px' }}>
                    {t('privacy.uniqueVisitors')}
                  </div>
                  <div className="item-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {analytics.analytics.uniqueVisitors24h}
                  </div>
                </div>
                
                <div className="analytics-item">
                  <div className="item-label" style={{ color: '#999', marginBottom: '5px' }}>
                    {t('privacy.peakHour')}
                  </div>
                  <div className="item-value" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {formatHour(analytics.analytics.peakHour)}
                  </div>
                </div>
                
                <div className="analytics-item">
                  <div className="item-label" style={{ color: '#999', marginBottom: '5px' }}>
                    {t('privacy.isHotspot')}
                  </div>
                  <div className="item-value" style={{ fontSize: '24px', fontWeight: 'bold', color: analytics.analytics.isHotspot ? '#FFD700' : '#ccc' }}>
                    {analytics.analytics.isHotspot ? t('privacy.yes') : t('privacy.no')}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="analytics-section"
              style={{
                marginBottom: '25px',
                backgroundColor: '#333',
                borderRadius: '10px',
                padding: '15px'
              }}
            >
              <h3 style={{ marginTop: '0', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                {t('privacy.privacyLevel')}
              </h3>
              
              <div style={{ marginTop: '15px' }}>
                <div className="privacy-meter"
                  style={{
                    height: '10px',
                    backgroundColor: '#555',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    marginBottom: '10px'
                  }}
                >
                  <div 
                    style={{
                      height: '100%',
                      width: analytics.analytics.privacyLevel === 'high' ? '100%' : 
                             analytics.analytics.privacyLevel === 'medium' ? '66%' : '33%',
                      backgroundColor: analytics.analytics.privacyLevel === 'high' ? '#4CAF50' :
                                      analytics.analytics.privacyLevel === 'medium' ? '#FFC107' : '#F44336',
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: analytics.analytics.privacyLevel === 'low' ? '#F44336' : '#999' }}>
                    {t('privacy.low')}
                  </span>
                  <span style={{ color: analytics.analytics.privacyLevel === 'medium' ? '#FFC107' : '#999' }}>
                    {t('privacy.medium')}
                  </span>
                  <span style={{ color: analytics.analytics.privacyLevel === 'high' ? '#4CAF50' : '#999' }}>
                    {t('privacy.high')}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="analytics-footer"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '20px',
                fontSize: '13px',
                color: '#999'
              }}
            >
              <div>
                {t('privacy.lastUpdated')}: {formatDate(analytics.timestamp)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '5px' }}>🔒</span>
                {t('analytics.aggregatedData')}
              </div>
            </div>
            
            <div style={{ marginTop: '25px', textAlign: 'center' }}>
              <button
                style={{
                  backgroundColor: '#9c27b0',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                onClick={onClose}
              >
                {t('analytics.closeAnalytics')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
} 