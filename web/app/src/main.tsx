import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth'

// Get Privy App ID from environment variables
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

if (!privyAppId) {
  console.error('VITE_PRIVY_APP_ID is not defined in environment variables. Wallet creation functionality will not work.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={privyAppId || 'placeholder-app-id'}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#4F46E5', // Indigo color to match our theme
          logo: 'https://your-logo-url.com/logo.png', // Replace with your logo URL
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets', // Create wallets for users without them
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
)
