import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { L1Card } from './L1Card';
import { L2Card } from './L2Card';
import { PrivateShareForm } from './PrivateShareForm';
import { POI } from '../../utils/contractUtils';
import '../../styles/TreasureBox.css';

// Card types for selection
enum CardType {
  None = 'none',
  L1 = 'l1',
  L2 = 'l2',
  PrivateShare = 'private'
}

interface TreasureBoxProps {
  isOpen: boolean;
  onClose: () => void;
  selectedArea?: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    radius: number; // radius in kilometers
  };
  pois?: POI[];
  isToolboxMode?: boolean;
}

export function TreasureBox({ 
  isOpen, 
  onClose, 
  selectedArea,
  pois = [], 
  isToolboxMode = false 
}: TreasureBoxProps) {
  const { t } = useTranslation();
  const [selectedCard, setSelectedCard] = useState<CardType>(CardType.None);
  
  // Handle closing the treasure box
  const handleClose = () => {
    setSelectedCard(CardType.None);
    onClose();
  };
  
  // Handle returning to card selection
  const handleBack = () => {
    setSelectedCard(CardType.None);
  };
  
  // Handle success callbacks
  const handleSuccess = () => {
    // Optional: Add any additional logic on success
    // For now, just stay on the current card
  };
  
  // Render card selector
  const renderCardSelector = () => {
    return (
      <div className="treasure-box-card-selector">
        <h3>{t('treasureBox.selectOptionTitle')}</h3>
        <p>{t('treasureBox.selectOptionDescription')}</p>
        
        <div className="card-options">
          <div 
            className="card-option l1-card"
            onClick={() => setSelectedCard(CardType.L1)}
          >
            <div className="option-icon l1-icon">L1</div>
            <h4>{t('treasureBox.l1CardName')}</h4>
            <p>{t('treasureBox.l1CardDescription')}</p>
          </div>
          
          <div 
            className="card-option l2-card"
            onClick={() => setSelectedCard(CardType.L2)}
          >
            <div className="option-icon l2-icon">L2</div>
            <h4>{t('treasureBox.l2CardName')}</h4>
            <p>{t('treasureBox.l2CardDescription')}</p>
          </div>
          
          <div 
            className="card-option private-card"
            onClick={() => setSelectedCard(CardType.PrivateShare)}
          >
            <div className="option-icon private-icon">TEE</div>
            <h4>{t('treasureBox.privateCardName')}</h4>
            <p>{t('treasureBox.privateCardDescription')}</p>
          </div>
        </div>
      </div>
    );
  };
  
  // Render the selected card content
  const renderSelectedCard = () => {
    switch (selectedCard) {
      case CardType.L1:
        return (
          <L1Card 
            onBack={handleBack}
            selectedArea={selectedArea}
            pois={pois}
            onSubscriptionSuccess={handleSuccess}
            isToolboxMode={isToolboxMode}
          />
        );
      case CardType.L2:
        return (
          <L2Card 
            onBack={handleBack}
            selectedArea={selectedArea}
            pois={pois}
            onBidSuccess={handleSuccess}
            isToolboxMode={isToolboxMode}
          />
        );
      case CardType.PrivateShare:
        return (
          <PrivateShareForm 
            onBack={handleBack}
            selectedArea={selectedArea}
            onShareSuccess={handleSuccess}
            isToolboxMode={isToolboxMode}
          />
        );
      default:
        return renderCardSelector();
    }
  };
  
  // Don't render anything if not open
  if (!isOpen) return null;
  
  return (
    <div className="treasure-box-container">
      <div className="treasure-box-overlay" onClick={handleClose}></div>
      
      <div className="treasure-box-content">
        <div className="treasure-box-header">
          <h2>{t('treasureBox.title')}</h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        
        <div className="treasure-box-body">
          {renderSelectedCard()}
        </div>
      </div>
    </div>
  );
} 