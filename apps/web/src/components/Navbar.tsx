import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../App.css';

export function Navbar() {
  const { t, i18n } = useTranslation();
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setShowLanguageMenu(false);
  };

  return (
    <div className="navbar">
      <div className="navbar-title">{t('navbar.title')}</div>
      <div className="navbar-controls">
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
  );
} 