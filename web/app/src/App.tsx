import React, { useEffect } from 'react';
import './App.css'
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom'
import Chat from './components/Chat'
import Home from './components/Home.tsx'
import TwilioCalls from './components/TwilioCalls.tsx'
import DebugPage from './components/DebugPage'
import { PrivyProvider } from '@privy-io/react-auth';
import { socketService } from './utils/socketService';

const App: React.FC = () => {
  // Initialize socket connection
  useEffect(() => {
    // Generate a random session ID if not already in localStorage
    const storedSessionId = localStorage.getItem('sonicline_session_id');
    const sessionId = storedSessionId || `session_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store session ID in localStorage
    if (!storedSessionId) {
      localStorage.setItem('sonicline_session_id', sessionId);
    }
    
    // Connect to WebSocket
    socketService.connect(sessionId).then(connected => {
      if (connected) {
        console.log(`Connected to session: ${sessionId}`);
      } else {
        console.error(`Failed to connect to session: ${sessionId}`);
      }
    });
    
    // Clean up on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);
  
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID || ''}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#f58435',
          logo: 'https://i.imgur.com/3jhrVDq.png'
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: true
        }
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
        <Router>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/agent/chat' element={<Chat />} />
            <Route path='/twilio/calls' element={<TwilioCalls />} />
            <Route path='/debug' element={<DebugPage />} />
          </Routes>
        </Router>
      </div>
    </PrivyProvider>
  )
}

export default App
