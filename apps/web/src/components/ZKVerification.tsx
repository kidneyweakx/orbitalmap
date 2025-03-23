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
  const [selectedType, setSelectedType] = useState<VerificationType | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({
    latitude: '37.123456',
    longitude: '-122.987654',
    visitTimestamp: Math.floor(Date.now() / 1000).toString(),
    actualScore: '100',
    threshold: '80',
    tokenBalance: '42',
    minRequired: '10',
    taskDescription: 'Complete the hackathon project',
    deadline: '1650000000',
    jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aXNpdGVkX3BsYWNlcyI6MTUsImV4cCI6MTY4MDAwMDAwMCwiaWF0IjoxNTE2MjM5MDIyfQ',
    requiredVisits: '10'
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [step, setStep] = useState<'init' | 'generating' | 'verifying' | 'complete'>('init');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormValues({
      latitude: '37.123456',
      longitude: '-122.987654',
      visitTimestamp: Math.floor(Date.now() / 1000).toString(),
      actualScore: '100',
      threshold: '80',
      tokenBalance: '42',
      minRequired: '10',
      taskDescription: 'Complete the hackathon project',
      deadline: '1650000000',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aXNpdGVkX3BsYWNlcyI6MTUsImV4cCI6MTY4MDAwMDAwMCwiaWF0IjoxNTE2MjM5MDIyfQ',
      requiredVisits: '10'
    });
    setResult(null);
    setStep('init');
  };

  const handleBack = () => {
    setSelectedType(null);
    resetForm();
  };

  const validateInput = () => {
    let isValid = true;
    let errorMessage = '';

    switch (selectedType) {
      case VerificationType.PROOF_OF_VISIT: {
        const lat = parseFloat(formValues.latitude || '0');
        const lng = parseFloat(formValues.longitude || '0');
        const visitTime = parseInt(formValues.visitTimestamp || '0');
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          errorMessage = t('zkVerification.invalidCoordinates');
          isValid = false;
        } else if (isNaN(visitTime) || visitTime <= 0) {
          errorMessage = t('zkVerification.invalidTimestamp');
          isValid = false;
        }
        break;
      }
        
      case VerificationType.REPUTATION: {
        const actualScore = parseFloat(formValues.actualScore || '0');
        const threshold = parseFloat(formValues.threshold || '0');
        
        if (isNaN(actualScore) || isNaN(threshold) || actualScore < 0 || threshold < 0) {
          errorMessage = t('zkVerification.invalidScores');
          isValid = false;
        }
        break;
      }
        
      case VerificationType.OWNERSHIP: {
        const tokenBalance = parseFloat(formValues.tokenBalance || '0');
        const minRequired = parseFloat(formValues.minRequired || '0');
        
        if (isNaN(tokenBalance) || isNaN(minRequired) || tokenBalance < 0 || minRequired < 0) {
          errorMessage = t('zkVerification.invalidTokenValues');
          isValid = false;
        }
        break;
      }
        
      case VerificationType.COMMITMENT: {
        const taskDescription = formValues.taskDescription || '';
        const deadline = parseInt(formValues.deadline || '0');
        
        if (!taskDescription.trim()) {
          errorMessage = t('zkVerification.emptyTaskDescription');
          isValid = false;
        } else if (isNaN(deadline) || deadline <= 0) {
          errorMessage = t('zkVerification.invalidDeadline');
          isValid = false;
        }
        break;
      }
        
      case VerificationType.EXPLORER_BADGE: {
        const jwtToken = formValues.jwtToken || '';
        const requiredVisits = parseInt(formValues.requiredVisits || '0');
        
        if (!jwtToken.trim()) {
          errorMessage = t('zkVerification.emptyJwtToken');
          isValid = false;
        } else if (isNaN(requiredVisits) || requiredVisits <= 0) {
          errorMessage = t('zkVerification.invalidRequiredVisits');
          isValid = false;
        }
        break;
      }
    }
    
    if (!isValid) {
      setResult({ success: false, message: errorMessage });
    }
    
    return isValid;
  };

  const handleVerify = async () => {
    if (!validateInput()) return;
    
    try {
      setIsVerifying(true);
      setResult(null);
      setStep('init');
      
      // Wait for UI to update before continuing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setStep('generating');
      
      let proofData: ProofData | null = null;
      
      // Generate the appropriate proof based on the selected type
      switch (selectedType) {
        case VerificationType.PROOF_OF_VISIT: {
          // Ensure values are valid numbers and not NaN
          const latitude = parseFloat(formValues.latitude || '0');
          const longitude = parseFloat(formValues.longitude || '0');
          const visitTimestamp = parseInt(formValues.visitTimestamp || '0');
          
          if (isNaN(latitude) || isNaN(longitude) || isNaN(visitTimestamp)) {
            throw new Error('Invalid input values');
          }
          
          proofData = await generateProofOfVisit(
            latitude,
            longitude,
            visitTimestamp
          );
          break;
        }
          
        case VerificationType.REPUTATION: {
          // Ensure values are valid numbers and not NaN
          const actualScore = parseFloat(formValues.actualScore || '0');
          const threshold = parseFloat(formValues.threshold || '0');
          
          if (isNaN(actualScore) || isNaN(threshold)) {
            throw new Error('Invalid input values');
          }
          
          proofData = await generateReputationProof(
            actualScore,
            threshold
          );
          break;
        }
          
        case VerificationType.OWNERSHIP: {
          // Ensure values are valid numbers and not NaN
          const tokenBalance = parseFloat(formValues.tokenBalance || '0');
          const minRequired = parseFloat(formValues.minRequired || '0');
          
          if (isNaN(tokenBalance) || isNaN(minRequired)) {
            throw new Error('Invalid input values');
          }
          
          proofData = await generateOwnershipProof(
            tokenBalance,
            minRequired
          );
          break;
        }
          
        case VerificationType.COMMITMENT: {
          // Ensure values are valid
          const taskDescription = formValues.taskDescription || '';
          const deadline = parseInt(formValues.deadline || '0');
          
          if (taskDescription.trim() === '' || isNaN(deadline)) {
            throw new Error('Invalid input values');
          }
          
          proofData = await generateCommitmentProof(
            taskDescription,
            deadline
          );
          break;
        }
          
        case VerificationType.EXPLORER_BADGE: {
          // Ensure values are valid
          const jwtToken = formValues.jwtToken || '';
          const requiredVisits = parseInt(formValues.requiredVisits || '0');
          
          if (jwtToken.trim() === '' || isNaN(requiredVisits)) {
            throw new Error('Invalid input values');
          }
          
          proofData = await generateExplorerBadgeProof(
            jwtToken,
            requiredVisits
          );
          break;
        }
      }
      
      if (!proofData) {
        throw new Error('Failed to generate proof');
      }
      
      setStep('verifying');
      
      // Verify the generated proof
      const verificationResult = await verifyProof(proofData);
      
      setStep('complete');
      setResult({
        success: verificationResult,
        message: verificationResult 
          ? t('zkVerification.success') 
          : t('zkVerification.failure')
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Verification error:', error);
      
      // Extract known error types for better messages
      let userMessage = t('zkVerification.error', { message: errorMessage });
      
      // Check for specific error types
      if (errorMessage.includes('unwrap_throw')) {
        userMessage = t('zkVerification.zkErrors.unwrap_throw');
      } else if (errorMessage.includes('TypeError')) {
        userMessage = t('zkVerification.zkErrors.typeError');
      } else if (errorMessage.includes('load circuit')) {
        userMessage = t('zkVerification.zkErrors.loadCircuit');
      } else if (errorMessage.includes('init backend')) {
        userMessage = t('zkVerification.zkErrors.initBackend');
      }
      
      setResult({ success: false, message: userMessage });
      setStep('complete');
    } finally {
      setIsVerifying(false);
    }
  };

  const renderForm = () => {
    if (!selectedType) return null;
    
    const typeTitle = t(`zkVerification.${selectedType}Title`);
    
    return (
      <div>
        <button className="back-button" onClick={handleBack}>
          ← {t('zkVerification.back')}
        </button>
        
        <h3>{typeTitle}</h3>
        
        {selectedType === VerificationType.PROOF_OF_VISIT && (
          <>
            <div className="form-group">
              <label htmlFor="latitude">{t('zkVerification.latitude')}</label>
              <input
                type="text"
                id="latitude"
                name="latitude"
                value={formValues.latitude || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.latitudePlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="longitude">{t('zkVerification.longitude')}</label>
              <input
                type="text"
                id="longitude"
                name="longitude"
                value={formValues.longitude || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.longitudePlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="visitTimestamp">{t('zkVerification.visitTimestamp')}</label>
              <input
                type="text"
                id="visitTimestamp"
                name="visitTimestamp"
                value={formValues.visitTimestamp || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.visitTimestampPlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
          </>
        )}
        
        {selectedType === VerificationType.REPUTATION && (
          <>
            <div className="form-group">
              <label htmlFor="actualScore">{t('zkVerification.actualScore')}</label>
              <input
                type="text"
                id="actualScore"
                name="actualScore"
                value={formValues.actualScore || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.actualScorePlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="threshold">{t('zkVerification.threshold')}</label>
              <input
                type="text"
                id="threshold"
                name="threshold"
                value={formValues.threshold || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.thresholdPlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
          </>
        )}
        
        {selectedType === VerificationType.OWNERSHIP && (
          <>
            <div className="form-group">
              <label htmlFor="tokenBalance">{t('zkVerification.tokenBalance')}</label>
              <input
                type="text"
                id="tokenBalance"
                name="tokenBalance"
                value={formValues.tokenBalance || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.tokenBalancePlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="minRequired">{t('zkVerification.minRequired')}</label>
              <input
                type="text"
                id="minRequired"
                name="minRequired"
                value={formValues.minRequired || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.minRequiredPlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
          </>
        )}
        
        {selectedType === VerificationType.COMMITMENT && (
          <>
            <div className="form-group">
              <label htmlFor="taskDescription">{t('zkVerification.taskDescription')}</label>
              <textarea
                id="taskDescription"
                name="taskDescription"
                value={formValues.taskDescription || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.taskDescriptionPlaceholder')}
                className="form-control"
                disabled={isVerifying}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="deadline">{t('zkVerification.deadline')}</label>
              <input
                type="text"
                id="deadline"
                name="deadline"
                value={formValues.deadline || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.deadlinePlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
          </>
        )}
        
        {selectedType === VerificationType.EXPLORER_BADGE && (
          <>
            <div className="form-group">
              <label htmlFor="jwtToken">{t('zkVerification.jwtToken')}</label>
              <input
                type="text"
                id="jwtToken"
                name="jwtToken"
                value={formValues.jwtToken || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.jwtTokenPlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="requiredVisits">{t('zkVerification.requiredVisits')}</label>
              <input
                type="text"
                id="requiredVisits"
                name="requiredVisits"
                value={formValues.requiredVisits || ''}
                onChange={handleChange}
                placeholder={t('zkVerification.requiredVisitsPlaceholder')}
                className="form-control"
                disabled={isVerifying}
              />
            </div>
          </>
        )}
        
        {result && (
          <div className={`status-message ${result.success ? 'success-message' : 'error-message'}`}>
            {result.message}
          </div>
        )}
        
        {renderVerificationSteps()}
        
        <button 
          className="action-button"
          onClick={handleVerify}
          disabled={isVerifying}
        >
          {isVerifying ? t('zkVerification.verifying') : t('zkVerification.verify')}
        </button>
      </div>
    );
  };

  const renderVerificationSteps = () => {
    if (step === 'init' && !isVerifying) return null;
    
    return (
      <div className="verification-steps">
        <div className={`step ${step === 'init' ? 'active' : (step === 'generating' || step === 'verifying' || step === 'complete' ? 'complete' : '')}`}>
          {t('zkVerification.initializingBackend')}
        </div>
        <div className={`step ${step === 'generating' ? 'active' : ((step === 'verifying' || step === 'complete') ? 'complete' : '')}`}>
          {t('zkVerification.generatingProof')}
        </div>
        <div className={`step ${step === 'verifying' ? 'active' : (step === 'complete' ? 'complete' : '')}`}>
          {t('zkVerification.verifyingProof')}
        </div>
      </div>
    );
  };

  const renderTypeSelector = () => {
    return (
      <div className="treasure-box-card-selector">
        <h3>{t('zkVerification.selectType')}</h3>
        
        <div className="card-options">
          <div 
            className="card-option"
            onClick={() => setSelectedType(VerificationType.PROOF_OF_VISIT)}
            title={t('zkVerification.proof_of_visitDescription')}
          >
            <div className="option-icon l1-icon">👣</div>
            <h4>{t('zkVerification.proofOfVisit')}</h4>
          </div>
          
          <div 
            className="card-option"
            onClick={() => setSelectedType(VerificationType.REPUTATION)}
            title={t('zkVerification.reputationDescription')}
          >
            <div className="option-icon l2-icon">⭐</div>
            <h4>{t('zkVerification.reputation')}</h4>
          </div>
          
          <div 
            className="card-option"
            onClick={() => setSelectedType(VerificationType.OWNERSHIP)}
            title={t('zkVerification.ownershipDescription')}
          >
            <div className="option-icon private-icon">💰</div>
            <h4>{t('zkVerification.ownership')}</h4>
          </div>
          
          <div 
            className="card-option"
            onClick={() => setSelectedType(VerificationType.COMMITMENT)}
            title={t('zkVerification.commitmentDescription')}
          >
            <div className="option-icon l1-icon">📝</div>
            <h4>{t('zkVerification.commitment')}</h4>
          </div>
          
          <div 
            className="card-option"
            onClick={() => setSelectedType(VerificationType.EXPLORER_BADGE)}
            title={t('zkVerification.explorerBadgeDescription')}
          >
            <div className="option-icon l2-icon">🏅</div>
            <h4>{t('zkVerification.explorerBadge')}</h4>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="treasure-box-container">
      <div className="treasure-box-overlay" onClick={onClose}></div>
      
      <div className="treasure-box-content">
        <div className="treasure-box-header">
          <h2>{t('zkVerification.title')}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="treasure-box-body">
          {selectedType ? renderForm() : renderTypeSelector()}
        </div>
      </div>
    </div>
  );
} 