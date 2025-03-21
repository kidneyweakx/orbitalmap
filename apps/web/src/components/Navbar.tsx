import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '../App';
import '../App.css';
import { ZKVerification } from './ZKVerification';

interface NavbarProps {
  toggleTheme: () => void;
  currentTheme: ThemeMode;
  showHoverEffects?: boolean;
  setShowHoverEffects?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Navbar({ toggleTheme, currentTheme, showHoverEffects = false, setShowHoverEffects }: NavbarProps) {
  const { t, i18n } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showZKVerification, setShowZKVerification] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  const toggleHoverEffects = () => {
    if (setShowHoverEffects) {
      setShowHoverEffects(prev => !prev);
    }
  };

  return (
    <>
      <div className="navbar">
        <div className="navbar-title">{t('navbar.title')}</div>
        <div className="navbar-controls">
          <button
            className="zk-menu-button"
            onClick={() => setShowZKVerification(true)}
            aria-label={t('navbar.zkVerification')}
          >
            🔐 {t('navbar.zkVerification')}
          </button>
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
    </>
  );
} 