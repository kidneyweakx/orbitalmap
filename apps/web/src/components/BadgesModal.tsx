import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExplorationStats, generatePOAPClaimUrl, generateExplorerBadge } from '../utils/RewardSystem';
import { useAuth } from '../providers/AuthContext';

interface BadgesModalProps {
  stats: ExplorationStats;
  onClose: () => void;
}

export function BadgesModal({ stats, onClose }: BadgesModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'badges'|'poap'|'stats'>('badges');
  const [copySuccess, setCopySuccess] = useState('');
  
  // For hackathon demo, use a mock wallet address
  // In production, this would come from authentication system
  const walletAddress = user ? '0x1234567890abcdef1234567890abcdef12345678' : '';
  
  // Get badge info based on stats
  const badge = walletAddress ? generateExplorerBadge(walletAddress, stats) : null;
  const poapClaimUrl = walletAddress ? generatePOAPClaimUrl(walletAddress, stats) : null;
  
  // Handle copy link to clipboard
  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopySuccess(t('badges.copySuccess'));
        setTimeout(() => setCopySuccess(''), 2000);
      })
      .catch(() => {
        setCopySuccess(t('badges.copyFailed'));
        setTimeout(() => setCopySuccess(''), 2000);
      });
  };
  
  return (
    <div className="badges-modal-backdrop" 
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
      <div className="badges-modal-content"
        style={{
          backgroundColor: '#222',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '20px',
          color: 'white',
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="badges-modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >
          <h2 style={{ margin: 0 }}>{t('badges.title')}</h2>
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
        
        <div className="badges-tabs"
          style={{
            display: 'flex',
            borderBottom: '1px solid #444',
            marginBottom: '20px'
          }}
        >
          <button
            className={`tab ${activeTab === 'badges' ? 'active' : ''}`}
            style={{
              padding: '10px 20px',
              background: activeTab === 'badges' ? '#333' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'badges' ? '2px solid #FFD700' : 'none',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('badges')}
          >
            {t('badges.exploreBadges')}
          </button>
          <button
            className={`tab ${activeTab === 'poap' ? 'active' : ''}`}
            style={{
              padding: '10px 20px',
              background: activeTab === 'poap' ? '#333' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'poap' ? '2px solid #FFD700' : 'none',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('poap')}
          >
            POAP
          </button>
          <button
            className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
            style={{
              padding: '10px 20px',
              background: activeTab === 'stats' ? '#333' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'stats' ? '2px solid #FFD700' : 'none',
              color: 'white',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab('stats')}
          >
            {t('badges.stats')}
          </button>
        </div>
        
        <div className="badges-content">
          {activeTab === 'badges' && (
            <div className="badges-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
              }}
            >
              {badge ? (
                <div className="badge-item"
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: '#333',
                    borderRadius: '8px',
                    width: '100%'
                  }}
                >
                  <h3>{badge.badgeType}</h3>
                  <div className="badge-image"
                    style={{
                      width: '150px',
                      height: '150px',
                      margin: '20px auto',
                      backgroundColor: '#444',
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '50px'
                    }}
                  >
                    🏆
                  </div>
                  <p>{t('badges.badgeDescription')}</p>
                  <button
                    style={{
                      backgroundColor: '#FFD700',
                      color: '#000',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginTop: '10px'
                    }}
                    onClick={() => handleCopyLink(badge.mintUrl)}
                  >
                    {t('badges.mintBadge')}
                  </button>
                </div>
              ) : (
                <div className="no-badges"
                  style={{
                    textAlign: 'center',
                    padding: '30px'
                  }}
                >
                  <p>{t('badges.noBadgesYet')}</p>
                  <p>{t('badges.exploreMore', { required: 25 })}</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'poap' && (
            <div className="poap-content"
              style={{
                textAlign: 'center',
                padding: '20px'
              }}
            >
              {poapClaimUrl ? (
                <>
                  <div className="poap-image"
                    style={{
                      width: '150px',
                      height: '150px',
                      margin: '20px auto',
                      backgroundColor: '#444',
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '50px'
                    }}
                  >
                    🎖️
                  </div>
                  <h3>{t('badges.poapTitle')}</h3>
                  <p>{t('badges.poapDescription')}</p>
                  <button
                    style={{
                      backgroundColor: '#FF4500',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginTop: '10px'
                    }}
                    onClick={() => handleCopyLink(poapClaimUrl)}
                  >
                    {t('badges.claimPoap')}
                  </button>
                </>
              ) : (
                <>
                  <p>{t('badges.noPoapYet')}</p>
                  <p>{t('badges.poapRequirement', { required: 50 })}</p>
                </>
              )}
            </div>
          )}
          
          {activeTab === 'stats' && (
            <div className="stats-content"
              style={{
                padding: '20px'
              }}
            >
              <div className="stats-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#333',
                  borderRadius: '8px'
                }}
              >
                <span>{t('badges.explorationIndex')}</span>
                <span
                  style={{
                    fontWeight: 'bold',
                    color: stats.explorationIndex >= 50 ? '#FFD700' : 'white'
                  }}
                >
                  {stats.explorationIndex}%
                </span>
              </div>
              
              <div className="stats-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#333',
                  borderRadius: '8px'
                }}
              >
                <span>{t('badges.rewardsCollected')}</span>
                <span style={{ fontWeight: 'bold' }}>
                  {stats.visitedRewardsCount}
                </span>
              </div>
              
              <div className="stats-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '15px',
                  padding: '10px',
                  backgroundColor: '#333',
                  borderRadius: '8px'
                }}
              >
                <span>{t('badges.totalPossibleRewards')}</span>
                <span style={{ fontWeight: 'bold' }}>
                  {stats.totalPossibleRewards}
                </span>
              </div>
              
              <div className="progress-bar"
                style={{
                  height: '20px',
                  backgroundColor: '#333',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginTop: '20px'
                }}
              >
                <div 
                  style={{
                    height: '100%',
                    width: `${stats.explorationIndex}%`,
                    backgroundColor: getProgressColor(stats.explorationIndex),
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '5px',
                  fontSize: '12px',
                  color: '#999'
                }}
              >
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}
          
          {copySuccess && (
            <div 
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '10px',
                borderRadius: '5px',
                marginTop: '20px',
                textAlign: 'center'
              }}
            >
              {copySuccess}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to get progress bar color based on percentage
function getProgressColor(percentage: number): string {
  if (percentage >= 75) return '#FFD700'; // Gold
  if (percentage >= 50) return '#C0C0C0'; // Silver
  if (percentage >= 25) return '#CD7F32'; // Bronze
  return '#4CAF50'; // Green
} 