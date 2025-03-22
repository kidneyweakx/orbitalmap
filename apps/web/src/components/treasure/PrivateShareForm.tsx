import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy } from '@privy-io/react-auth';

interface PrivateShareFormProps {
  onBack: () => void;
  selectedArea?: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    radius: number; // radius in kilometers
  };
  onShareSuccess?: () => void;
  isToolboxMode?: boolean;
}

export function PrivateShareForm({ 
  onBack, 
  selectedArea, 
  onShareSuccess, 
  isToolboxMode = false 
}: PrivateShareFormProps) {
  const { t } = useTranslation();
  const { user } = usePrivy();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [privateLocation, setPrivateLocation] = useState({
    name: '',
    latitude: selectedArea ? selectedArea.coordinates[1].toString() : '',
    longitude: selectedArea ? selectedArea.coordinates[0].toString() : '',
    description: '',
    type: 'hidden-treasure',
    sharedWith: '' // comma-separated wallet addresses
  });
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPrivateLocation(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Validate form data
  const validateForm = (): boolean => {
    if (!privateLocation.name.trim()) {
      setError(t('treasureBox.errorNameRequired'));
      return false;
    }
    
    if (!privateLocation.latitude.trim() || !privateLocation.longitude.trim()) {
      setError(t('treasureBox.errorCoordinatesRequired'));
      return false;
    }
    
    const lat = parseFloat(privateLocation.latitude);
    const lng = parseFloat(privateLocation.longitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError(t('treasureBox.errorInvalidCoordinates'));
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!user?.wallet?.address) {
      setError(t('treasureBox.errorNoWallet'));
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Format the addresses
      const addresses = privateLocation.sharedWith
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0 && addr.startsWith('0x'));
      
      // Create the request body
      const requestBody = {
        locationName: privateLocation.name,
        latitude: parseFloat(privateLocation.latitude),
        longitude: parseFloat(privateLocation.longitude),
        description: privateLocation.description,
        locationType: privateLocation.type,
        ownerAddress: user.wallet.address,
        sharedAddresses: addresses,
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      // Call the TEEZone API endpoint (mock implementation)
      // In a real implementation, this would be a proper API call to the Marlin TEEZone service
      console.log("Sending private location data to TEEZone:", requestBody);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Success
      setSuccess(t('treasureBox.shareSuccess'));
      
      // Clear form
      setPrivateLocation({
        name: '',
        latitude: '',
        longitude: '',
        description: '',
        type: 'hidden-treasure',
        sharedWith: ''
      });
      
      // Call success callback
      if (onShareSuccess) {
        onShareSuccess();
      }
    } catch (err) {
      console.error("Error sharing private location:", err);
      setError(t('treasureBox.shareFailed'));
    } finally {
      setLoading(false);
    }
  };
  
  // Render the form in toolbox mode (info only, no interaction)
  if (isToolboxMode) {
    return (
      <div className="treasure-box-card-content">
        <div className="card-header tee-header">
          <button className="back-button" onClick={onBack}>
            ← {t('common.back')}
          </button>
          <h3>{t('treasureBox.teeCardTitle')}</h3>
        </div>
        
        <div className="tee-indicator">
          <span className="tee-dot"></span>
          Marlin TEEZone
        </div>
        
        <div className="card-description">
          <p>{t('treasureBox.teeCardDetailedDescription')}</p>
        </div>
        
        <div className="function-list">
          <h4>{t('treasureBox.availableFunctions')}</h4>
          <ul>
            <li>sharePrivateLocation(...) - {t('treasureBox.sharePrivateLocationDesc')}</li>
            <li>getSharedLocations() - {t('treasureBox.getSharedLocationsDesc')}</li>
            <li>revokeAccess(locationId, address) - {t('treasureBox.revokeAccessDesc')}</li>
          </ul>
        </div>
        
        <div className="technical-info">
          <h4>{t('treasureBox.technicalDetails')}</h4>
          <p>
            <strong>{t('treasureBox.teeProvider')}:</strong> Marlin <br />
            <strong>{t('treasureBox.encryptionType')}:</strong> End-to-end <br />
            <strong>{t('treasureBox.api')}:</strong> TEEZone API
          </p>
        </div>
        
        <div className="treasure-box-info">
          <p>{t('treasureBox.teeInfoText')}</p>
        </div>
      </div>
    );
  }
  
  // Render the form for actual data submission
  return (
    <div className="private-share-form-content">
      {selectedArea && (
        <div className="selected-area">
          <h3>{t('treasureBox.selectedArea')}: {selectedArea.name}</h3>
          <p>{t('treasureBox.coordinates')}: {selectedArea.coordinates[1].toFixed(4)}, {selectedArea.coordinates[0].toFixed(4)}</p>
        </div>
      )}
      
      <div className="form-container">
        <h3>{t('treasureBox.sharePrivateLocation')}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">{t('treasureBox.locationName')}*</label>
            <input
              type="text"
              id="name"
              name="name"
              value={privateLocation.name}
              onChange={handleInputChange}
              placeholder={t('treasureBox.locationNamePlaceholder')}
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="latitude">{t('treasureBox.latitude')}*</label>
              <input
                type="text"
                id="latitude"
                name="latitude"
                value={privateLocation.latitude}
                onChange={handleInputChange}
                placeholder="e.g. 37.7749"
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="longitude">{t('treasureBox.longitude')}*</label>
              <input
                type="text"
                id="longitude"
                name="longitude"
                value={privateLocation.longitude}
                onChange={handleInputChange}
                placeholder="e.g. -122.4194"
                disabled={loading}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="description">{t('treasureBox.locationDescription')}</label>
            <textarea
              id="description"
              name="description"
              value={privateLocation.description}
              onChange={handleInputChange}
              placeholder={t('treasureBox.locationDescriptionPlaceholder')}
              disabled={loading}
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="type">{t('treasureBox.locationType')}</label>
            <select
              id="type"
              name="type"
              value={privateLocation.type}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="hidden-treasure">{t('treasureBox.typeHiddenTreasure')}</option>
              <option value="secret-spot">{t('treasureBox.typeSecretSpot')}</option>
              <option value="private-landmark">{t('treasureBox.typePrivateLandmark')}</option>
              <option value="custom">{t('treasureBox.typeCustom')}</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="sharedWith">{t('treasureBox.shareWith')}</label>
            <input
              type="text"
              id="sharedWith"
              name="sharedWith"
              value={privateLocation.sharedWith}
              onChange={handleInputChange}
              placeholder={t('treasureBox.shareWithPlaceholder')}
              disabled={loading}
            />
            <small className="help-text">{t('treasureBox.shareWithHelp')}</small>
          </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="share-button"
              disabled={loading}
            >
              {loading ? t('treasureBox.sharing') : t('treasureBox.share')}
            </button>
          </div>
        </form>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="privacy-notice">
        <h4>{t('treasureBox.privacyNotice')}</h4>
        <p>{t('treasureBox.privacyDescription')}</p>
      </div>
    </div>
  );
} 