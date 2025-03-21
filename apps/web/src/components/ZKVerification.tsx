import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  generateProofOfVisit,
  generateReputationProof,
  generateOwnershipProof,
  generateCommitmentProof,
  generateExplorerBadgeProof,
  verifyProof,
  ProofData
} from '../utils/ZKService';

enum VerificationType {
  PROOF_OF_VISIT = 'proof_of_visit',
  REPUTATION = 'reputation',
  OWNERSHIP = 'ownership',
  COMMITMENT = 'commitment',
  EXPLORER_BADGE = 'explorer_badge'
}

interface ZKVerificationProps {
  onClose: () => void;
}

export function ZKVerification({ onClose }: ZKVerificationProps) {
  const { t } = useTranslation();
  const [verificationType, setVerificationType] = useState<VerificationType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verifyStep, setVerifyStep] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Default values based on the test cases in the Noir code
  const [formData, setFormData] = useState({
    // Proof of Visit defaults (based on proof_of_visit.nr test)
    latitude: '37.123456',
    longitude: '-122.987654',
    visitTimestamp: '1649700000',
    
    // Reputation Proof defaults (based on reputation_proofs.nr test)
    actualScore: '95',
    threshold: '80',
    
    // Ownership Proof defaults (based on ownership_proofs.nr test)
    tokenBalance: '5000',
    minRequired: '1000',
    
    // Commitment Proof defaults (based on trustless_commitments.nr test)
    taskDescription: 'Complete the hackathon project',
    deadline: '1650000000',
    
    // Explorer Badge Proof defaults
    jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aXNpdGVkX3BsYWNlcyI6MTUsImV4cCI6MTY4MDAwMDAwMCwiaWF0IjoxNTE2MjM5MDIyfQ',
    requiredVisits: '10'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear any error when user edits the form
    setError(null);
  };

  const resetForm = () => {
    setVerificationType(null);
    setResult(null);
    setVerifyStep(null);
    setError(null);
    // Reset to defaults
    setFormData({
      latitude: '37.123456',
      longitude: '-122.987654',
      visitTimestamp: '1649700000',
      actualScore: '95',
      threshold: '80',
      tokenBalance: '5000',
      minRequired: '1000',
      taskDescription: 'Complete the hackathon project',
      deadline: '1650000000',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aXNpdGVkX3BsYWNlcyI6MTUsImV4cCI6MTY4MDAwMDAwMCwiaWF0IjoxNTE2MjM5MDIyfQ',
      requiredVisits: '10'
    });
  };

  const validateInput = () => {
    switch (verificationType) {
      case VerificationType.PROOF_OF_VISIT:
        if (isNaN(parseFloat(formData.latitude)) || isNaN(parseFloat(formData.longitude))) {
          setError(t('zkVerification.invalidCoordinates'));
          return false;
        }
        if (isNaN(parseInt(formData.visitTimestamp))) {
          setError(t('zkVerification.invalidTimestamp'));
          return false;
        }
        break;
      case VerificationType.REPUTATION:
        if (isNaN(parseInt(formData.actualScore)) || isNaN(parseInt(formData.threshold))) {
          setError(t('zkVerification.invalidScores'));
          return false;
        }
        break;
      case VerificationType.OWNERSHIP:
        if (isNaN(parseInt(formData.tokenBalance)) || isNaN(parseInt(formData.minRequired))) {
          setError(t('zkVerification.invalidTokenValues'));
          return false;
        }
        break;
      case VerificationType.COMMITMENT:
        if (!formData.taskDescription.trim()) {
          setError(t('zkVerification.emptyTaskDescription'));
          return false;
        }
        if (isNaN(parseInt(formData.deadline))) {
          setError(t('zkVerification.invalidDeadline'));
          return false;
        }
        break;
      case VerificationType.EXPLORER_BADGE:
        if (!formData.jwtToken.trim()) {
          setError(t('zkVerification.emptyJwtToken'));
          return false;
        }
        if (isNaN(parseInt(formData.requiredVisits))) {
          setError(t('zkVerification.invalidRequiredVisits'));
          return false;
        }
        break;
    }
    return true;
  };

  const handleVerify = async () => {
    if (!validateInput()) {
      return;
    }
    
    setIsLoading(true);
    setResult(null);
    setVerifyStep('initializing');
    setError(null);

    try {
      let proof: ProofData;
      
      setVerifyStep('generating_proof');
      switch (verificationType) {
        case VerificationType.PROOF_OF_VISIT:
          proof = await generateProofOfVisit(
            parseFloat(formData.latitude),
            parseFloat(formData.longitude),
            parseInt(formData.visitTimestamp)
          );
          break;
        case VerificationType.REPUTATION:
          proof = await generateReputationProof(
            parseInt(formData.actualScore),
            parseInt(formData.threshold)
          );
          break;
        case VerificationType.OWNERSHIP:
          proof = await generateOwnershipProof(
            parseInt(formData.tokenBalance),
            parseInt(formData.minRequired)
          );
          break;
        case VerificationType.COMMITMENT:
          proof = await generateCommitmentProof(
            formData.taskDescription,
            parseInt(formData.deadline)
          );
          break;
        case VerificationType.EXPLORER_BADGE:
          proof = await generateExplorerBadgeProof(
            formData.jwtToken,
            parseInt(formData.requiredVisits)
          );
          break;
        default:
          throw new Error('Invalid verification type');
      }
      
      setVerifyStep('verifying_proof');
      const verified = await verifyProof(proof);
      
      setVerifyStep('complete');
      setResult({
        success: verified,
        message: verified
          ? t('zkVerification.success')
          : t('zkVerification.failure')
      });
    } catch (error) {
      console.error('Verification error:', error);
      setVerifyStep('error');
      
      // Create a more user-friendly error message
      let errorMessage = '';
      if (error instanceof Error) {
        // Extract the most relevant part of the error message
        const fullMessage = error.message;
        
        if (fullMessage.includes('unwrap_throw')) {
          errorMessage = t('zkVerification.zkErrors.unwrap_throw');
        } else if (fullMessage.includes('TypeError')) {
          errorMessage = t('zkVerification.zkErrors.typeError');
        } else if (fullMessage.includes('Failed to load circuit')) {
          errorMessage = t('zkVerification.zkErrors.loadCircuit');
        } else if (fullMessage.includes('backend not initialized')) {
          errorMessage = t('zkVerification.zkErrors.initBackend');
        } else if (fullMessage.includes('zkErrors.locationHash')) {
          errorMessage = t('zkVerification.zkErrors.locationHash');
        } else if (fullMessage.includes('zkErrors.reputation')) {
          errorMessage = t('zkVerification.zkErrors.reputation');
        } else if (fullMessage.includes('zkErrors.tokenBalance')) {
          errorMessage = t('zkVerification.zkErrors.tokenBalance');
        } else if (fullMessage.includes('zkErrors.commitment')) {
          errorMessage = t('zkVerification.zkErrors.commitment');
        } else if (fullMessage.includes('zkErrors.jwt')) {
          errorMessage = t('zkVerification.zkErrors.jwt');
        } else if (fullMessage.includes('zkErrors.visitTime')) {
          errorMessage = t('zkVerification.zkErrors.visitTime');
        } else if (fullMessage.includes('zkErrors.deadline')) {
          errorMessage = t('zkVerification.zkErrors.deadline');
        } else if (fullMessage.includes('zkErrors.requiredVisits')) {
          errorMessage = t('zkVerification.zkErrors.requiredVisits');
        } else {
          // Use the original error message if we can't identify a specific pattern
          errorMessage = fullMessage;
        }
      } else {
        errorMessage = t('zkVerification.zkErrors.unknown');
      }
      
      setResult({
        success: false,
        message: `ZK Verification Error: ${errorMessage}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    switch (verificationType) {
      case VerificationType.PROOF_OF_VISIT:
        return (
          <>
            <div className="form-description">
              {t('zkVerification.proof_of_visitDescription')}
            </div>
            <div className="form-group">
              <label>{t('zkVerification.latitude')}</label>
              <input
                type="text"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder={t('zkVerification.latitudePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.longitude')}</label>
              <input
                type="text"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder={t('zkVerification.longitudePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.visitTimestamp')}</label>
              <input
                type="number"
                name="visitTimestamp"
                value={formData.visitTimestamp}
                onChange={handleChange}
                placeholder={t('zkVerification.visitTimestampPlaceholder')}
              />
            </div>
          </>
        );

      case VerificationType.REPUTATION:
        return (
          <>
            <div className="form-description">
              {t('zkVerification.reputationDescription')}
            </div>
            <div className="form-group">
              <label>{t('zkVerification.actualScore')}</label>
              <input
                type="number"
                name="actualScore"
                value={formData.actualScore}
                onChange={handleChange}
                placeholder={t('zkVerification.actualScorePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.threshold')}</label>
              <input
                type="number"
                name="threshold"
                value={formData.threshold}
                onChange={handleChange}
                placeholder={t('zkVerification.thresholdPlaceholder')}
              />
            </div>
          </>
        );

      case VerificationType.OWNERSHIP:
        return (
          <>
            <div className="form-description">
              {t('zkVerification.ownershipDescription')}
            </div>
            <div className="form-group">
              <label>{t('zkVerification.tokenBalance')}</label>
              <input
                type="number"
                name="tokenBalance"
                value={formData.tokenBalance}
                onChange={handleChange}
                placeholder={t('zkVerification.tokenBalancePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.minRequired')}</label>
              <input
                type="number"
                name="minRequired"
                value={formData.minRequired}
                onChange={handleChange}
                placeholder={t('zkVerification.minRequiredPlaceholder')}
              />
            </div>
          </>
        );

      case VerificationType.COMMITMENT:
        return (
          <>
            <div className="form-description">
              {t('zkVerification.commitmentDescription')}
            </div>
            <div className="form-group">
              <label>{t('zkVerification.taskDescription')}</label>
              <textarea
                name="taskDescription"
                value={formData.taskDescription}
                onChange={handleChange}
                placeholder={t('zkVerification.taskDescriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.deadline')}</label>
              <input
                type="number"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                placeholder={t('zkVerification.deadlinePlaceholder')}
              />
            </div>
          </>
        );

      case VerificationType.EXPLORER_BADGE:
        return (
          <>
            <div className="form-description">
              {t('zkVerification.explorerBadgeDescription')}
            </div>
            <div className="form-group">
              <label>{t('zkVerification.jwtToken')}</label>
              <input
                type="text"
                name="jwtToken"
                value={formData.jwtToken}
                onChange={handleChange}
                placeholder={t('zkVerification.jwtTokenPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('zkVerification.requiredVisits')}</label>
              <input
                type="number"
                name="requiredVisits"
                value={formData.requiredVisits}
                onChange={handleChange}
                placeholder={t('zkVerification.requiredVisitsPlaceholder')}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const renderVerificationSteps = () => {
    if (!verifyStep) return null;
    
    return (
      <div className="verification-steps">
        <div className={`step ${verifyStep === 'initializing' ? 'active' : verifyStep !== 'error' ? 'completed' : 'error'}`}>
          <span className="step-number">1</span>
          <span className="step-text">{t('zkVerification.initializingBackend')}</span>
        </div>
        <div className={`step ${verifyStep === 'generating_proof' ? 'active' : (verifyStep === 'verifying_proof' || verifyStep === 'complete') ? 'completed' : verifyStep === 'error' ? 'error' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-text">{t('zkVerification.generatingProof')}</span>
        </div>
        <div className={`step ${verifyStep === 'verifying_proof' ? 'active' : verifyStep === 'complete' ? 'completed' : verifyStep === 'error' ? 'error' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-text">{t('zkVerification.verifyingProof')}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="zk-verification-modal">
      <div className="modal-header">
        <h2>{t('zkVerification.title')}</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="modal-content">
        {!verificationType ? (
          <div className="verification-types">
            <h3>{t('zkVerification.selectType')}</h3>
            <div className="verification-type-grid">
              <button
                className="verification-type-button"
                onClick={() => setVerificationType(VerificationType.PROOF_OF_VISIT)}
              >
                <span className="emoji">🗺️</span>
                <span>{t('zkVerification.proofOfVisit')}</span>
              </button>
              <button
                className="verification-type-button"
                onClick={() => setVerificationType(VerificationType.REPUTATION)}
              >
                <span className="emoji">⭐</span>
                <span>{t('zkVerification.reputation')}</span>
              </button>
              <button
                className="verification-type-button"
                onClick={() => setVerificationType(VerificationType.OWNERSHIP)}
              >
                <span className="emoji">🏆</span>
                <span>{t('zkVerification.ownership')}</span>
              </button>
              <button
                className="verification-type-button"
                onClick={() => setVerificationType(VerificationType.COMMITMENT)}
              >
                <span className="emoji">🤝</span>
                <span>{t('zkVerification.commitment')}</span>
              </button>
              <button
                className="verification-type-button"
                onClick={() => setVerificationType(VerificationType.EXPLORER_BADGE)}
              >
                <span className="emoji">🌍</span>
                <span>{t('zkVerification.explorerBadge')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="verification-form">
            <h3>
              {t(`zkVerification.${verificationType}Title`)}
              <button className="back-button" onClick={resetForm}>
                ↩ {t('zkVerification.back')}
              </button>
            </h3>
            <div className="form-container">
              {renderForm()}
              
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              
              <div className="form-actions">
                <button
                  className="verify-button"
                  onClick={handleVerify}
                  disabled={isLoading}
                >
                  {isLoading ? t('zkVerification.verifying') : t('zkVerification.verify')}
                </button>
              </div>
            </div>

            {isLoading && renderVerificationSteps()}

            {result && (
              <div className={`result ${result.success ? 'success' : 'error'}`}>
                <p>{result.message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 