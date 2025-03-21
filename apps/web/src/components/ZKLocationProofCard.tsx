import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateProofOfVisit, verifyProof } from '../utils/ZKService';

interface ZKLocationProofCardProps {
  locationName: string;
  locationCoordinates: [number, number];
  onProofGenerated?: (isValid: boolean) => void;
}

export function ZKLocationProofCard({ 
  locationName, 
  locationCoordinates, 
  onProofGenerated 
}: ZKLocationProofCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'generating' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleGenerateProof = async () => {
    try {
      setStatus('generating');
      setErrorMessage(null);
      
      // Get current time
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Generate ZK proof of visit
      const proof = await generateProofOfVisit(
        locationCoordinates[1], // latitude
        locationCoordinates[0], // longitude 
        currentTime
      );
      
      // Verify the proof
      setStatus('verifying');
      const isValid = await verifyProof(proof);
      
      // Set status based on verification result
      if (isValid) {
        setStatus('success');
        if (onProofGenerated) onProofGenerated(true);
      } else {
        setStatus('error');
        setErrorMessage(t('zkLocationProof.invalidProof'));
        if (onProofGenerated) onProofGenerated(false);
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : t('zkLocationProof.unknownError')
      );
      if (onProofGenerated) onProofGenerated(false);
    }
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'generating':
      case 'verifying':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📍';
    }
  };
  
  const getStatusMessage = () => {
    switch (status) {
      case 'generating':
        return t('zkLocationProof.generating');
      case 'verifying':
        return t('zkLocationProof.verifying');
      case 'success':
        return t('zkLocationProof.success');
      case 'error':
        return errorMessage || t('zkLocationProof.error');
      default:
        return t('zkLocationProof.ready');
    }
  };
  
  return (
    <div className="zk-location-proof-card"
      style={{
        backgroundColor: '#333',
        borderRadius: '12px',
        padding: '20px',
        width: '100%',
        maxWidth: '500px',
        color: 'white',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        margin: '10px 0'
      }}
    >
      <div className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '15px'
        }}
      >
        <div className="location-icon"
          style={{
            fontSize: '24px',
            marginRight: '10px'
          }}
        >
          📍
        </div>
        <h3 style={{ margin: 0 }}>
          {locationName}
        </h3>
      </div>
      
      <div className="card-content"
        style={{
          fontSize: '14px'
        }}
      >
        <div className="coordinates"
          style={{
            color: '#999',
            marginBottom: '15px'
          }}
        >
          {t('zkLocationProof.coordinates', { 
            lat: locationCoordinates[1].toFixed(6), 
            lng: locationCoordinates[0].toFixed(6) 
          })}
        </div>
        
        <div className="zk-info"
          style={{
            backgroundColor: '#222',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {t('zkLocationProof.zkInfo')}
          </div>
          <div style={{ fontSize: '12px' }}>
            {t('zkLocationProof.zkExplainer')}
          </div>
        </div>
        
        <div className="status-section"
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >
          <div className="status-icon"
            style={{
              fontSize: '24px',
              marginRight: '10px',
              width: '30px',
              height: '30px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {getStatusIcon()}
          </div>
          <div className="status-message">
            {getStatusMessage()}
          </div>
        </div>
      </div>
      
      <div className="card-actions"
        style={{
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <button
          style={{
            backgroundColor: status === 'generating' || status === 'verifying' ? '#666' : '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '20px',
            cursor: status === 'generating' || status === 'verifying' ? 'not-allowed' : 'pointer',
            width: '100%',
            fontWeight: 'bold'
          }}
          onClick={handleGenerateProof}
          disabled={status === 'generating' || status === 'verifying'}
        >
          {status === 'idle' ? t('zkLocationProof.generateProof') : 
           status === 'success' ? t('zkLocationProof.regenerateProof') : 
           status === 'error' ? t('zkLocationProof.tryAgain') :
           t('zkLocationProof.processing')}
        </button>
      </div>
    </div>
  );
} 