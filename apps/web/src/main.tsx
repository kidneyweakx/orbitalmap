import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import i18n from './i18n'
import { PrivyProvider } from './providers/PrivyProvider'
import { AuthProvider } from './providers/AuthContext'

// Ensure i18n is initialized
i18n.on('initialized', () => {
  console.log('i18n initialized with languages:', i18n.languages);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </PrivyProvider>
  </React.StrictMode>,
)
