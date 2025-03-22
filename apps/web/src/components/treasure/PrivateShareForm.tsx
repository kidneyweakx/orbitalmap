import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';

interface PrivateShareFormProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export function PrivateShareForm({ onBack, onSuccess }: PrivateShareFormProps) {
  const { t } = useTranslation();
  const { authenticated, user } = usePrivy();
  
  const [privateLocation, setPrivateLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
    description: string;
  }>({
    lat: 0,
    lng: 0,
    name: '',
    description: ''
  });
  
  const [sharingLocation, setSharingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'lat' || name === 'lng') {
      // Convert latitude/longitude to numbers
      setPrivateLocation(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0
      }));
    } else {
      setPrivateLocation(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Validate form data
  const validateForm = () => {
    // Reset any previous errors
    setError(null);
    
    if (!privateLocation.name.trim()) {
      setError(t('treasureBox.formValidationError'));
      return false;
    }
    
    if (privateLocation.lat === 0 && privateLocation.lng === 0) {
      setError(t('treasureBox.invalidCoordinates'));
      return false;
    }
    
    // Check if the coordinates are within valid ranges
    if (
      privateLocation.lat < -90 || 
      privateLocation.lat > 90 || 
      privateLocation.lng < -180 || 
      privateLocation.lng > 180
    ) {
      setError(t('treasureBox.coordinatesOutOfRange'));
      return false;
    }
    
    return true;
  };

  // Handle location sharing via Marlin TEEZone
  const sharePrivateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSharingLocation(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the TEE API endpoint from environment variables
      const teeApiEndpoint = import.meta.env.VITE_TEE_API_ENDPOINT || 'http://localhost:8080';
      
      // Prepare the data to be shared
      const locationData = {
        name: privateLocation.name,
        description: privateLocation.description,
        lat: privateLocation.lat,
        lng: privateLocation.lng,
        owner: authenticated ? user?.id || 'anonymous' : 'anonymous',
        timestamp: Date.now(),
        isPrivate: true
      };

      // Send the data to the Marlin TEEZone API
      const response = await axios.post(`${teeApiEndpoint}/api/locations/share`, locationData);
      
      if (response.status === 200 || response.status === 201) {
        setSuccess(t('treasureBox.locationShared'));
        // Reset form
        setPrivateLocation({
          lat: 0,
          lng: 0,
          name: '',
          description: ''
        });
        
        // Call onSuccess if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(t('treasureBox.errorSharingLocation'));
      }
    } catch (err) {
      console.error('Error sharing location via TEEZone:', err);
      setError(t('treasureBox.errorSharingLocation'));
    } finally {
      setSharingLocation(false);
    }
  };

  return (
    <div className="private-share-form-container">
      <div className="card-header">
        <button className="back-button" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <h3>{t('treasureBox.privateShareTitle')}</h3>
      </div>
      
      <div className="description">
        <p>{t('treasureBox.privateShareExplanation')}</p>
      </div>
      
      <form className="private-share-form" onSubmit={sharePrivateLocation}>
        <div className="form-group">
          <label htmlFor="name">{t('treasureBox.locationName')}*</label>
          <input
            type="text"
            id="name"
            name="name"
            value={privateLocation.name}
            onChange={handleInputChange}
            placeholder={t('treasureBox.locationNamePlaceholder')}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="lat">{t('treasureBox.latitude')}*</label>
          <input
            type="number"
            id="lat"
            name="lat"
            value={privateLocation.lat || ''}
            onChange={handleInputChange}
            min="-90"
            max="90"
            step="0.000001"
            placeholder="e.g. 35.6812"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="lng">{t('treasureBox.longitude')}*</label>
          <input
            type="number"
            id="lng"
            name="lng"
            value={privateLocation.lng || ''}
            onChange={handleInputChange}
            min="-180"
            max="180"
            step="0.000001"
            placeholder="e.g. 139.7671"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">{t('treasureBox.locationDescription')}</label>
          <textarea
            id="description"
            name="description"
            value={privateLocation.description}
            onChange={handleInputChange}
            placeholder={t('treasureBox.locationDescriptionPlaceholder')}
            rows={3}
          />
        </div>
        
        <div className="tee-protection-info">
          <span className="tee-badge">{t('treasureBox.teeProtection')}</span>
          <p>{t('treasureBox.teeExplanation')}</p>
        </div>
        
        <button
          type="submit"
          className="share-button"
          disabled={sharingLocation}
        >
          {sharingLocation ? '...' : t('treasureBox.shareLocation')}
        </button>
      </form>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
} 