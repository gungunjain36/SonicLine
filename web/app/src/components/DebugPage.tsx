import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DebugView from './DebugView';
import { Message, ActionUsage } from '../types';
import { socketService, SocketEventType } from '../utils/socketService';

const DebugPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [usedActions, setUsedActions] = useState<ActionUsage[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 3 seconds
  
  // Initialize on component mount
  useEffect(() => {
    // Get session ID from localStorage or URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get('session');
    const storedSessionId = localStorage.getItem('sonicline_session_id');
    const activeSessionId = sessionParam || storedSessionId || `session_${Math.random().toString(36).substring(2, 9)}`;
    
    setSessionId(activeSessionId);
    
    // Connect to WebSocket
    socketService.connect(activeSessionId).then(connected => {
      setIsConnected(connected);
      if (connected) {
        console.log(`Debug view connected to session: ${activeSessionId}`);
      } else {
        console.error(`Failed to connect debug view to session: ${activeSessionId}`);
      }
    });
    
    // Register socket event listeners
    socketService.on(SocketEventType.ACTION_USED, (action: ActionUsage) => {
      setUsedActions(prev => {
        // Check if action already exists to avoid duplicates
        const exists = prev.some(a => 
          a.name === action.name && 
          a.timestamp.getTime() === new Date(action.timestamp).getTime()
        );
        
        if (exists) return prev;
        
        // Add new action with proper Date object
        return [...prev, {
          ...action,
          timestamp: new Date(action.timestamp)
        }];
      });
      setLastUpdate(new Date());
    });
    
    socketService.on(SocketEventType.NEW_MESSAGE, (message: Message) => {
      setMessages(prev => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some(m => 
          m.text === message.text && 
          m.isUser === message.isUser && 
          m.timestamp.getTime() === new Date(message.timestamp).getTime()
        );
        
        if (exists) return prev;
        
        // Add new message with proper Date object
        return [...prev, {
          ...message,
          timestamp: new Date(message.timestamp)
        }];
      });
      setLastUpdate(new Date());
    });
    
    // Initial data fetch
    fetchData(activeSessionId);
    
    // Set up polling for updates
    const intervalId = setInterval(() => {
      fetchData(activeSessionId);
    }, refreshInterval);
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId);
      socketService.disconnect();
    };
  }, []);
  
  // Fetch data from backend
  const fetchData = async (sessionId: string) => {
    try {
      // Fetch communication logs
      const logsResponse = await axios.get('http://localhost:8000/communication-logs');
      if (logsResponse.data && logsResponse.data.logs) {
        const newMessages: Message[] = logsResponse.data.logs.map((log: any) => ({
          text: log.message,
          isUser: log.is_user,
          timestamp: new Date(log.timestamp),
          imageUrl: log.imageUrl,
          sessionId: sessionId
        }));
        
        // Update messages, avoiding duplicates
        setMessages(prev => {
          const uniqueMessages = [...prev];
          
          newMessages.forEach(newMsg => {
            const exists = uniqueMessages.some(m => 
              m.text === newMsg.text && 
              m.isUser === newMsg.isUser && 
              m.timestamp.getTime() === newMsg.timestamp.getTime()
            );
            
            if (!exists) {
              uniqueMessages.push(newMsg);
            }
          });
          
          return uniqueMessages;
        });
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
  
  // Handle refresh interval change
  const handleRefreshIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newInterval = parseInt(e.target.value, 10);
    setRefreshInterval(newInterval);
  };
  
  // Manual refresh button handler
  const handleManualRefresh = () => {
    fetchData(sessionId);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">
            SonicLine Debug Console
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} mr-2`}></div>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label htmlFor="refresh-interval" className="text-sm">Refresh:</label>
              <select 
                id="refresh-interval" 
                value={refreshInterval} 
                onChange={handleRefreshIntervalChange}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              >
                <option value={1000}>1s</option>
                <option value={3000}>3s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>
            </div>
            
            <button 
              onClick={handleManualRefresh}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              Refresh Now
            </button>
          </div>
        </div>
        
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-2 mb-4">
          <div className="flex items-center">
            <span className="text-sm mr-2">Session ID:</span>
            <code className="bg-black/30 px-2 py-1 rounded text-xs font-mono">{sessionId}</code>
            <span className="text-xs text-gray-400 ml-4">Last update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
        
        <DebugView messages={messages} usedActions={usedActions} />
      </div>
    </div>
  );
};

export default DebugPage; 