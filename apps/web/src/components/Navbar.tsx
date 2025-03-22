import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '../App';
import '../App.css';
import { ZKVerification } from './ZKVerification';
import { TEEZone } from './TEEZone';
import { NillionLLM } from './NillionLLM';
import { TestAPI } from './TestAPI';
import { UserProfile } from './UserProfile';
import { useAuth } from '../providers/AuthContext';

interface NavbarProps {
  toggleTheme: () => void;
  currentTheme: ThemeMode;
  showHoverEffects?: boolean;
  setShowHoverEffects?: React.Dispatch<React.SetStateAction<boolean>>;
  onTitleClick?: () => void;
  handleShowBadgesModal: () => void;
}

export function Navbar({ toggleTheme, currentTheme, showHoverEffects = false, setShowHoverEffects, onTitleClick, handleShowBadgesModal }: NavbarProps) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, login } = useAuth();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showZKVerification, setShowZKVerification] = useState(false);
  const [showTEEZone, setShowTEEZone] = useState(false);
  const [showNillionLLM, setShowNillionLLM] = useState(false);
  const [showTestAPI, setShowTestAPI] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  const toggleHoverEffects = () => {
    if (setShowHoverEffects) {
      setShowHoverEffects(prev => !prev);
    }
  };

  const handleOpenZKVerification = () => {
    setShowZKVerification(true);
    setShowToolbox(false);
  };

  const handleOpenTEEZone = () => {
    setShowTEEZone(true);
    setShowToolbox(false);
  };

  const handleOpenNillionLLM = () => {
    setShowNillionLLM(true);
    setShowToolbox(false);
  };

  const handleOpenTestAPI = () => {
    setShowTestAPI(true);
    setShowToolbox(false);
  };

  return (
    <>
      <div className="navbar">
        <div className="navbar-title" onClick={onTitleClick} style={{ cursor: 'pointer' }}>{t('navbar.title')}</div>
        <div className="navbar-controls">
          <div className="toolbox-dropdown">
            <button
              className="toolbox-menu-button"
              onClick={() => setShowToolbox(!showToolbox)}
              aria-label={t('navbar.toolbox')}
            >
              🧰 {t('navbar.toolbox')}
            </button>
            {showToolbox && (
              <div className="toolbox-menu">
                <button onClick={handleOpenZKVerification}>
                  <span className="emoji">🔐</span> {t('navbar.zkVerification')}
                </button>
                <button onClick={handleOpenTEEZone}>
                  <span className="emoji">🔒</span> {t('navbar.teeZone')}
                </button>
                <button onClick={handleOpenNillionLLM}>
                  <span className="emoji">🤖</span> {t('navbar.nillionLLM')}
                </button>
                <button onClick={handleOpenTestAPI}>
                  <span className="emoji">🧪</span> {t('navbar.testAPI')}
                </button>
              </div>
            )}
          </div>
          {setShowHoverEffects && (
            <button
              className={`hover-toggle-btn ${showHoverEffects ? 'active' : ''}`}
              onClick={toggleHoverEffects}
              aria-label={showHoverEffects ? t('navbar.hideRewards') : t('navbar.showRewards')}
            >
              {showHoverEffects ? '👁️' : '👁️‍🗨️'}
            </button>
          )}
          <button 
            className="theme-toggle-button" 
            onClick={toggleTheme}
            aria-label={currentTheme === 'dark' ? t('navbar.switchToLight') : t('navbar.switchToDark')}
          >
            {currentTheme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="language-selector">
            <button 
              className="language-button" 
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            >
              {t('navbar.language')}
            </button>
            {showLanguageMenu && (
              <div className="language-menu">
                <button onClick={() => changeLanguage('en')}>English</button>
                <button onClick={() => changeLanguage('zh')}>中文</button>
                <button onClick={() => changeLanguage('ja')}>日本語</button>
              </div>
            )}
          </div>
          
          {isAuthenticated ? (
            <UserProfile 
              onShowBadges={handleShowBadgesModal}
            />
          ) : (
            <button 
              className="login-nav-button" 
              onClick={login}
            >
              {t('navbar.login')}
            </button>
          )}
        </div>
      </div>
      
      {showZKVerification && (
        <>
          <div className="modal-backdrop" onClick={() => setShowZKVerification(false)}></div>
          <ZKVerification onClose={() => setShowZKVerification(false)} />
        </>
      )}

      {showTEEZone && (
        <>
          <div className="modal-backdrop" onClick={() => setShowTEEZone(false)}></div>
          <TEEZone onClose={() => setShowTEEZone(false)} />
        </>
      )}

      {showNillionLLM && (
        <>
          <div className="modal-backdrop" onClick={() => setShowNillionLLM(false)}></div>
          <NillionLLM onClose={() => setShowNillionLLM(false)} />
        </>
      )}

      {showTestAPI && (
        <>
          <div className="modal-backdrop" onClick={() => setShowTestAPI(false)}></div>
          <TestAPI onClose={() => setShowTestAPI(false)} />
        </>
      )}
    </>
  );
} 