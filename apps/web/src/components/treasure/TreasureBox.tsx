import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { POI } from '../../utils/contractUtils';
import { L1Card } from './L1Card';
import { L2Card } from './L2Card';
import { PrivateShareForm } from './PrivateShareForm';
import '../../styles/TreasureBox.css';

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
  PrivateShare = 'private'
}

export function TreasureBox({
  onClose,
  selectedArea,
  pois = [],
  onSubscriptionSuccess,
  isToolboxMode = false
}: TreasureBoxProps) {
  const { t } = useTranslation();
  
  // State for card selection in toolbox mode
  const [selectedCard, setSelectedCard] = useState<CardType | null>(isToolboxMode ? null : CardType.L1Card);
  
  // Handle going back to card selection
  const handleBack = () => {
    setSelectedCard(null);
  };
  
  // Handle success from any card components
  const handleSuccess = () => {
    if (onSubscriptionSuccess) {
      onSubscriptionSuccess();
    }
  };

  // Toolbox mode content - selecting either L1, L2, or Private Share card
  const renderToolboxModeContent = () => {
    if (selectedCard === null) {
      return (
        <div className="treasure-box-card-selector">
          <h3>{t('treasureBox.selectBlockchain')}</h3>
          
          <div className="treasure-box-card-grid">
            <div 
              className="treasure-box-card l1-card" 
              onClick={() => setSelectedCard(CardType.L1Card)}
            >
              <div className="treasure-box-card-icon">🏙️</div>
              <h4>{t('treasureBox.l1Card')}</h4>
              <p>{t('treasureBox.l1CardDescription')}</p>
              <div className="treasure-box-card-network">
                <span className="network-dot sepolia"></span>
                Sepolia
              </div>
            </div>
            
            <div 
              className="treasure-box-card l2-card" 
              onClick={() => setSelectedCard(CardType.L2Card)}
            >
              <div className="treasure-box-card-icon">🔍</div>
              <h4>{t('treasureBox.l2Card')}</h4>
              <p>{t('treasureBox.l2CardDescription')}</p>
              <div className="treasure-box-card-network">
                <span className="network-dot t1"></span>
                T1
              </div>
            </div>

            <div 
              className="treasure-box-card private-share-card" 
              onClick={() => setSelectedCard(CardType.PrivateShare)}
            >
              <div className="treasure-box-card-icon">🔒</div>
              <h4>{t('treasureBox.privateShareTitle')}</h4>
              <p>{t('treasureBox.privateShareDescription')}</p>
              <div className="treasure-box-card-network">
                <span className="network-dot tee"></span>
                TEE Zone
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
    
    // Render the selected card component
    switch (selectedCard) {
      case CardType.L1Card:
        return (
          <L1Card 
            onBack={handleBack} 
            onSubscriptionSuccess={handleSuccess}
            selectedArea={selectedArea}
            pois={pois}
            isToolboxMode={true}
          />
        );
      
      case CardType.L2Card:
        return (
          <L2Card 
            onBack={handleBack}
            isToolboxMode={true}
          />
        );
      
      case CardType.PrivateShare:
        return (
          <PrivateShareForm 
            onBack={handleBack}
            onSuccess={handleSuccess}
          />
        );
      
      default:
        return null;
    }
  };

  // Area mode content - subscribing to POIs in a selected area
  const renderAreaModeContent = () => {
    return (
      <L1Card 
        onBack={() => {}} 
        onSubscriptionSuccess={onSubscriptionSuccess}
        selectedArea={selectedArea}
        pois={pois}
        isToolboxMode={false}
      />
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