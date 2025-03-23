import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { L1Card } from './L1Card';
import { L2Card } from './L2Card';
import { PrivateShareForm } from './PrivateShareForm';
import { L1DetailCard } from './L1DetailCard';
import { L2DetailCard } from './L2DetailCard';
import { POI } from '../../utils/contractUtils';
import '../../styles/TreasureBox.css';

// Card types for selection
enum CardType {
  None = 'none',
  L1 = 'l1',
  L2 = 'l2',
  PrivateShare = 'private',
  L1Detail = 'l1Detail',
  L2Detail = 'l2Detail'
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
          
          <div 
            className="card-option l1-detail-card"
            onClick={() => setSelectedCard(CardType.L1Detail)}
          >
            <div className="option-icon l1-icon">L1+</div>
            <h4>{t('treasureBox.l1DetailCardName', 'L1 Detail')}</h4>
            <p>{t('treasureBox.l1DetailCardDescription', 'View your POI details on L1')}</p>
          </div>
          
          <div 
            className="card-option l2-detail-card"
            onClick={() => setSelectedCard(CardType.L2Detail)}
          >
            <div className="option-icon l2-icon">L2+</div>
            <h4>{t('treasureBox.l2DetailCardName', 'L2 Detail')}</h4>
            <p>{t('treasureBox.l2DetailCardDescription', 'View your POI details on L2')}</p>
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
      case CardType.L1Detail:
        return (
          <L1DetailCard
            onBack={handleBack}
            onShowOnMap={handleShowOnMap}
          />
        );
      case CardType.L2Detail:
        return (
          <L2DetailCard
            onBack={handleBack}
            onShowOnMap={handleShowOnMap}
          />
        );
      default:
        return renderCardSelector();
    }
  };
  
  // Add map navigation functionality
  const handleShowOnMap = (lat: number, lng: number) => {
    // Close the treasure box dialog
    onClose();
    
    // Call map navigation, adjust based on actual map implementation
    // For example, can use global event or call back method
    const mapInstance = (window as any).mapInstance;
    if (mapInstance && typeof mapInstance.flyTo === 'function') {
      mapInstance.flyTo({ center: [lng, lat], zoom: 15 });
    } else {
      // If no direct access to map instance, can use event dispatch
      const event = new CustomEvent('map:flyto', { detail: { lat, lng } });
      window.dispatchEvent(event);
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