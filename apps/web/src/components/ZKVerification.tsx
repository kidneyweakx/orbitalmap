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
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState({
    latitude: '37.123456',
    longitude: '-122.987654',
    visitTimestamp: '1649700000',
    actualScore: '85',
    threshold: '70',
    tokenBalance: '1000',
    minRequired: '500',
    taskDescription: 'Complete the hackathon project',
    deadline: '1706745600',
    jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    requiredVisits: '10'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setVerificationType(null);
    setResult(null);
    setFormData({
      latitude: '37.123456',
      longitude: '-122.987654',
      visitTimestamp: '1649700000',
      actualScore: '85',
      threshold: '70',
      tokenBalance: '1000',
      minRequired: '500',
      taskDescription: 'Complete the hackathon project',
      deadline: '1706745600',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
      requiredVisits: '10'
    });
  };

  const handleVerify = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      let proof: ProofData;

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

      const verified = await verifyProof(proof);

      setResult({
        success: verified,
        message: verified
          ? t('zkVerification.success')
          : t('zkVerification.failure')
      });
    } catch (error) {
      console.error('Verification error:', error);
      setResult({
        success: false,
        message: t('zkVerification.error', { message: (error as Error).message })
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