import React, { useEffect, useRef, useState } from 'react';
import { Message, ActionUsage } from '../types';

interface DebugViewProps {
  messages: Message[];
  usedActions: ActionUsage[];
}

const DebugView: React.FC<DebugViewProps> = ({ messages, usedActions }) => {
  // State for current time to force re-renders
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  
  // Refs for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionsEndRef = useRef<HTMLDivElement>(null);
  
  // Previous counts to detect new items
  const prevMessagesCountRef = useRef(0);
  const prevActionsCountRef = useRef(0);
  
  // Update time every second to ensure component refreshes
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Track connected devices
  useEffect(() => {
    const devices = new Set<string>();
    
    // Add devices from messages
    messages.forEach(message => {
      if (message.deviceId) {
        devices.add(message.deviceId);
      }
    });
    
    // Add devices from actions
    usedActions.forEach(action => {
      if (action.deviceId) {
        devices.add(action.deviceId);
      }
    });
    
    setConnectedDevices(Array.from(devices));
  }, [messages, usedActions]);
  
  // Auto-scroll when new messages or actions are added
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevMessagesCountRef.current = messages.length;
    }
  }, [messages.length]);
  
  useEffect(() => {
    if (usedActions.length > prevActionsCountRef.current) {
      actionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      prevActionsCountRef.current = usedActions.length;
    }
  }, [usedActions.length]);
  
  // Get the most recent message and action for highlighting
  const latestMessageTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp.getTime() : 0;
  const latestActionTimestamp = usedActions.length > 0 ? usedActions[usedActions.length - 1].timestamp.getTime() : 0;
  
  // Function to check if an item is recent (within the last 2 seconds)
  const isRecent = (timestamp: Date) => {
    return Date.now() - timestamp.getTime() < 2000;
  };
  
  // Function to format time difference
  const getTimeSince = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };
  
  // Function to get device label
  const getDeviceLabel = (deviceId?: string) => {
    if (!deviceId) return 'Unknown';
    
    const deviceIndex = connectedDevices.indexOf(deviceId);
    if (deviceIndex === -1) return 'Unknown';
    
    return `Device ${deviceIndex + 1}`;
  };
  
  // Function to get device color
  const getDeviceColor = (deviceId?: string) => {
    if (!deviceId) return 'gray-500';
    
    const colors = [
      'blue-500',
      'green-500',
      'yellow-500',
      'purple-500',
      'pink-500',
      'indigo-500',
      'red-500',
      'orange-500'
    ];
    
    const deviceIndex = connectedDevices.indexOf(deviceId);
    if (deviceIndex === -1) return 'gray-500';
    
    return colors[deviceIndex % colors.length];
  };
  
  return (
    <div className="flex flex-col h-full overflow-auto p-4 bg-black/20 backdrop-blur-sm rounded-lg border border-gray-800/50">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">Debug Mode</h2>
        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full ${messages.length > 0 && isRecent(messages[messages.length - 1].timestamp) ? 'bg-green-500 animate-pulse' : 'bg-gray-500'} mr-1`}></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-black/30 p-3 rounded-lg">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 rounded-full bg-[#f58435] mr-2"></div>
            <h3 className="text-sm font-semibold text-white">Messages</h3>
          </div>
          <div className="text-xs text-gray-400">
            {messages.length} total messages ({messages.filter(m => m.isUser).length} user, {messages.filter(m => !m.isUser).length} assistant)
          </div>
        </div>
        
        <div className="bg-black/30 p-3 rounded-lg">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 rounded-full bg-[#224f81] mr-2"></div>
            <h3 className="text-sm font-semibold text-white">Actions</h3>
          </div>
          <div className="text-xs text-gray-400">
            {usedActions.length} total actions used
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div className="bg-black/30 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white">Connected Devices</h3>
              <div className="text-xs text-gray-400">{connectedDevices.length} device(s)</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {connectedDevices.map((deviceId, index) => (
                <div 
                  key={deviceId} 
                  className={`px-2 py-1 rounded-full text-xs bg-${getDeviceColor(deviceId)}/20 border border-${getDeviceColor(deviceId)}/50`}
                >
                  Device {index + 1}
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-black/30 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white">Conversation Log</h3>
              <div className="text-xs text-gray-400">Real-time updates</div>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 conversation-log">
              {messages.map((message, index) => {
                const isLatest = message.timestamp.getTime() === latestMessageTimestamp && isRecent(message.timestamp);
                return (
                  <div 
                    key={index} 
                    className={`p-2 rounded text-xs ${
                      message.isUser 
                        ? 'bg-[#f58435]/10 border-l-2 border-[#f58435]' 
                        : 'bg-[#224f81]/10 border-l-2 border-[#224f81]'
                    } ${isLatest ? 'animate-pulse-soft border-r-2' : ''}`}
                  >
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center">
                        <span className="font-medium">{message.isUser ? 'User' : 'Assistant'}</span>
                        {message.deviceId && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-${getDeviceColor(message.deviceId)}/20 text-${getDeviceColor(message.deviceId)}`}>
                            {getDeviceLabel(message.deviceId)}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500">{getTimeSince(message.timestamp)}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{message.text}</div>
                    {message.imageUrl && (
                      <div className="mt-1">
                        <img 
                          src={message.imageUrl} 
                          alt="Generated content" 
                          className="max-h-32 rounded border border-gray-700"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          <div className="bg-black/30 p-3 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-white">Actions Used</h3>
              <div className="text-xs text-gray-400">Real-time updates</div>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 actions-log">
              {usedActions.length === 0 ? (
                <div className="text-xs text-gray-500 italic">No actions used yet</div>
              ) : (
                usedActions.map((action, index) => {
                  const isLatest = action.timestamp.getTime() === latestActionTimestamp && isRecent(action.timestamp);
                  return (
                    <div 
                      key={index} 
                      className={`p-2 bg-black/20 rounded text-xs border-l-2 border-[#f58435] ${isLatest ? 'animate-pulse-soft border-r-2 border-r-[#f58435]' : ''}`}
                    >
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center">
                          <span className="font-medium text-[#f58435]">{action.name}</span>
                          {action.deviceId && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-${getDeviceColor(action.deviceId)}/20 text-${getDeviceColor(action.deviceId)}`}>
                              {getDeviceLabel(action.deviceId)}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-500">{getTimeSince(action.timestamp)}</span>
                      </div>
                      <div className="text-gray-300">{action.description}</div>
                    </div>
                  );
                })
              )}
              <div ref={actionsEndRef} />
            </div>
          </div>
          
          <div className="bg-black/30 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-2">System Information</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-black/20 rounded">
                <div className="font-medium mb-1">Browser</div>
                <div className="text-gray-400">{navigator.userAgent}</div>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <div className="font-medium mb-1">Time</div>
                <div className="text-gray-400">{currentTime.toLocaleString()}</div>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <div className="font-medium mb-1">Screen</div>
                <div className="text-gray-400">{window.innerWidth}x{window.innerHeight}</div>
              </div>
              <div className="p-2 bg-black/20 rounded">
                <div className="font-medium mb-1">Memory Usage</div>
                <div className="text-gray-400">
                  {performance && performance.memory ? 
                    `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB` : 
                    'Not available'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-black/30 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-white mb-2">WebSocket Status</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-gray-300">Connected and listening for updates</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Last update: {currentTime.toLocaleTimeString()}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Session ID: {messages.length > 0 && messages[0].sessionId ? messages[0].sessionId : 'Unknown'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugView; 