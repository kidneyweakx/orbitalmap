import { useTranslation } from 'react-i18next';
import { ExplorationStats } from '../utils/RewardSystem';
import { useState, useEffect } from 'react';

interface ExplorationIndicatorProps {
  stats: ExplorationStats;
  hasBadges: boolean;
  onShowDetails?: () => void;
}

export function ExplorationIndicator({ 
  stats, 
  hasBadges,
  onShowDetails
}: ExplorationIndicatorProps) {
  const { t } = useTranslation();
  const [animate, setAnimate] = useState(false);
  
  // Animation effect when stats change
  useEffect(() => {
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 1000);
    return () => clearTimeout(timer);
  }, [stats.explorationIndex]);
  
  // Determine color based on exploration index
  const getColor = () => {
    if (stats.explorationIndex >= 75) return '#FFD700'; // Gold
    if (stats.explorationIndex >= 50) return '#C0C0C0'; // Silver
    if (stats.explorationIndex >= 25) return '#CD7F32'; // Bronze
    return '#FFFFFF'; // White
  };
  
  return (
    <div 
      className={`exploration-indicator ${animate ? 'pulse' : ''}`} 
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: getColor(),
        padding: '10px 15px',
        borderRadius: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
       
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s ease'
      }}
      onClick={onShowDetails}
    >
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
        {stats.explorationIndex}%
      </div>
      <div style={{ fontSize: '12px', marginTop: '5px' }}>
        {t('exploration.indicator')}
      </div>
      {hasBadges && (
        <div 
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-10px',
            backgroundColor: '#FF4500',
            color: 'white',
            borderRadius: '50%',
            width: '20px',
            height: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          !
        </div>
      )}
    </div>
  );
} 