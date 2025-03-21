import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../providers/AuthContext';
import { usePrivy } from '@privy-io/react-auth';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const { t } = useTranslation();
  const { isAuthenticated, setIsAuthenticated } = useAuth();
  const { login, ready, authenticated } = usePrivy();

  // When Privy auth state changes, update our own auth context
  useEffect(() => {
    if (ready && authenticated) {
      setIsAuthenticated(true);
      onLoginSuccess();
    }
  }, [ready, authenticated, setIsAuthenticated, onLoginSuccess]);

  const handleLoginClick = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{t('login.title', 'Welcome to OrbitalMap')}</h1>
        <p>{t('login.description', 'Explore and interact with locations around the world.')}</p>
        
        <div className="login-methods">
          <button 
            className="login-button primary-button"
            onClick={handleLoginClick}
            disabled={isAuthenticated}
          >
            {isAuthenticated 
              ? t('login.authenticated', 'Authenticated') 
              : t('login.connectWallet', 'Connect your wallet')}
          </button>
        </div>
        
        <div className="login-footer">
          <p>{t('login.privacyNotice', 'Your privacy is important to us. We use secure authentication methods.')}</p>
        </div>
      </div>
    </div>
  );
} 