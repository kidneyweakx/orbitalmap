import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '../App';
import '../App.css';
import { ZKVerification } from './ZKVerification';
import { TEEZone } from './TEEZone';

interface NavbarProps {
  toggleTheme: () => void;
  currentTheme: ThemeMode;
  showHoverEffects?: boolean;
  setShowHoverEffects?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Navbar({ toggleTheme, currentTheme, showHoverEffects = false, setShowHoverEffects }: NavbarProps) {
  const { t, i18n } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showToolbox, setShowToolbox] = useState(false);
  const [showZKVerification, setShowZKVerification] = useState(false);
  const [showTEEZone, setShowTEEZone] = useState(false);

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

  return (
    <>
      <div className="navbar">
        <div className="navbar-title">{t('navbar.title')}</div>
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
    </>
  );
} 