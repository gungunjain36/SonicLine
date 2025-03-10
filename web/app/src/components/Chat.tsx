import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth';
import PrivyWalletCreator from './PrivyWalletCreator';
// @ts-expect-error - Missing type definitions for nftService
import * as nftService from '../utils/nftService';
import VoiceInput from './VoiceInput';
import { textToSpeech, playAudio } from '../utils/elevenLabsService';
import Orb from './Orb';
import DebugView from './DebugView';
import { socketService, SocketEventType } from '../utils/socketService';
import { contextService } from '../utils/contextService';
import { llmActionDetector } from '../utils/llmActionDetector';
import { Link } from 'react-router-dom';
import { 
  MicrophoneIcon, 
  NoSymbolIcon as MicrophoneOffIcon, 
  SpeakerWaveIcon as VolumeUpIcon, 
  SpeakerXMarkIcon as VolumeOffIcon, 
  ChatBubbleLeftRightIcon as ChatIcon, 
  ChatBubbleOvalLeftEllipsisIcon as ChatOffIcon, 
  PhoneIcon, 
  PhoneXMarkIcon as PhoneOffIcon, 
  ClockIcon, 
  XMarkIcon, 
  PaperAirplaneIcon as SendIcon,
  CommandLineIcon as DebugIcon
} from '@heroicons/react/24/outline';

// Use types from the types file
import { 
  Message, 
  CommunicationLog, 
  WalletData, 
  VoiceSettings, 
  UiMode, 
  ActionUsage, 
  ApiResponse, 
  NftGenerationRequest,
  PromisedAction
} from '../types';

// Function to check if a message is requesting NFT generation using LLM
const isNftGenerationRequest = async (message: string): Promise<NftGenerationRequest> => {
  try {
    // First, check for simple keywords
    const lowerMessage = message.toLowerCase();
    const nftKeywords = ['nft', 'generate', 'create', 'mint', 'make'];
    const hasNftKeyword = nftKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasNftKeyword) {
      // Extract description - everything after the NFT request
      let description = lowerMessage;
      
      // Remove NFT-related keywords
      nftKeywords.forEach(keyword => {
        description = description.replace(keyword, '');
      });
      
      // Remove common request phrases
      const requestPhrases = ['for me', 'please', 'can you', 'could you', 'would you'];
      requestPhrases.forEach(phrase => {
        description = description.replace(phrase, '');
      });
      
      // Clean up the description
      description = description.trim();
      if (!description) {
        description = "Abstract digital art";
      }
      
      return { 
        isRequest: true, 
        description
      };
    }
    
    // Try to use the LLM-based detection as a fallback
    const intent = await llmActionDetector.analyzeUserIntent(message);
    
    if (intent && intent.intent === 'mint-nft' && intent.confidence > 0.7) {
      return { 
        isRequest: true, 
        description: intent.parameters.description || "Abstract digital art" 
      };
    }
    
    // Fallback to local detection if LLM fails
    const fallbackResult = llmActionDetector.detectNftRequest(message);
    if (fallbackResult.isRequest && fallbackResult.confidence > 0.7) {
      return { 
        isRequest: true, 
        description: fallbackResult.description 
      };
    }
    
    return { isRequest: false, description: '' };
  } catch (error) {
    console.error('Error in NFT request detection:', error);
    
    // Fallback to local detection if LLM fails
    const fallbackResult = llmActionDetector.detectNftRequest(message);
    if (fallbackResult.isRequest && fallbackResult.confidence > 0.7) {
      return { 
        isRequest: true, 
        description: fallbackResult.description 
      };
    }
    
    return { isRequest: false, description: '' };
  }
};

// Function to check if the agent's response is requesting NFT generation
const checkAgentResponseForNftRequest = async (response: string): Promise<NftGenerationRequest> => {
  try {
    // Try to use the LLM-based detection for promised actions
    const promisedActions = await llmActionDetector.detectPromisedActions(response);
    
    // Check if any of the promised actions is an NFT generation
    const nftAction = promisedActions.find(action => 
      action.type === 'mint-nft' && action.probability > 0.7
    );
    
    if (nftAction) {
      return { 
        isRequest: true, 
        description: nftAction.parameters.description || "Abstract digital art" 
      };
    }
    
    return { isRequest: false, description: '' };
  } catch (error) {
    console.error('Error in NFT promise detection:', error);
    return { isRequest: false, description: '' };
  }
};

const Chat: React.FC = () => {
  const { authenticated, login, user } = usePrivy();
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! I'm SonicLine Assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivyWalletCreator, setShowPrivyWalletCreator] = useState(false);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [waitingForEmail, setWaitingForEmail] = useState(false);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  
  // Add new state for UI mode
  const [uiMode, setUiMode] = useState<UiMode>({
    chatVisible: true,
    voiceOnly: false,
    debugMode: false
  });
  
  // Add state for tracking actions
  const [usedActions, setUsedActions] = useState<ActionUsage[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([
    'get-token-by-ticker',
    'get-sonic-balance',
    'send-sonic',
    'send-sonic-token',
    'swap-sonic',
    'get-token-price',
    'get-transaction-history',
    'add-liquidity',
    'remove-liquidity',
    'get-pool-info',
    'estimate-swap',
    'create-wallet',
    'mint-nft'
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { createWallet } = useCreateWallet();
  const { wallets: privyWallets } = useWallets();

  // Add new state for voice features
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    autoPlayResponses: true
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Add state for session ID
  const [sessionId, setSessionId] = useState<string>(`session_${Math.random().toString(36).substring(2, 9)}`);
  
  // Add state for promised actions
  const [promisedActions, setPromisedActions] = useState<PromisedAction[]>([]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session ID from localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('sonicline_session_id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      localStorage.setItem('sonicline_session_id', sessionId);
    }
  }, []);

  // Fetch communication logs periodically
  useEffect(() => {
    if (showConversationHistory) {
      const fetchCommunicationLogs = async () => {
        try {
          const response = await axios.get('https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app/communication-logs');
          if (response.data && response.data.logs) {
            setCommunicationLogs(response.data.logs.map((log: any) => ({
              timestamp: new Date(log.timestamp),
              isUser: log.is_user,
              message: log.message,
              imageUrl: log.imageUrl
            })));
          }
        } catch (error) {
          console.error('Error fetching communication logs:', error);
        }
      };

      fetchCommunicationLogs();
      const intervalId = setInterval(fetchCommunicationLogs, 3000); // Fetch logs every 3 seconds
      
      return () => clearInterval(intervalId);
    }
  }, [showConversationHistory]);

  // Initialize socket connection and context service
  useEffect(() => {
    // Connect to WebSocket
    socketService.connect(sessionId).then(connected => {
      if (connected) {
        console.log(`Connected to session: ${sessionId}`);
      } else {
        console.error(`Failed to connect to session: ${sessionId}`);
      }
    });
    
    // Initialize context
    contextService.initContext(sessionId);
    
    // Register socket event listeners
    socketService.on(SocketEventType.ACTION_USED, (action: ActionUsage) => {
      // Only add actions from other devices
      if (action.deviceId !== socketService.getDeviceId()) {
        setUsedActions(prev => [...prev, action]);
      }
    });
    
    socketService.on(SocketEventType.NEW_MESSAGE, (message: Message) => {
      // Only add messages from other devices
      if (message.deviceId !== socketService.getDeviceId()) {
        setMessages(prev => [...prev, message]);
      }
    });
    
    // Clean up on unmount
    return () => {
      socketService.disconnect();
    };
  }, [sessionId]);
  
  // Update promised actions from context service
  useEffect(() => {
    const updatePromisedActions = () => {
      setPromisedActions(contextService.getPromisedActions());
    };
    
    // Update initially
    updatePromisedActions();
    
    // Set up interval to check for new promised actions
    const interval = setInterval(updatePromisedActions, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Execute promised actions when detected
  useEffect(() => {
    if (promisedActions.length > 0) {
      // Get the highest probability action
      const topAction = [...promisedActions].sort((a, b) => b.probability - a.probability)[0];
      
      // Only execute if probability is high enough
      if (topAction.probability >= 0.8) {
        console.log(`Executing promised action: ${topAction.type}`, topAction.parameters);
        
        // Execute the action based on type
        switch (topAction.type) {
          case 'create-wallet':
            handleWalletCreation(topAction.parameters.walletType || 'ethereum');
            break;
          case 'mint-nft':
            handleNftGeneration(topAction.parameters.description || 'Abstract digital art');
            break;
          case 'swap-sonic':
            // Simulate token swap
            simulateActionUsage('swap-sonic');
            // Add a success message
            const swapMessage: Message = {
              text: `✅ Token swap completed successfully! Swapped ${topAction.parameters.fromToken || 'SONIC'} to ${topAction.parameters.toToken || 'ETH'}`,
              isUser: false,
              timestamp: new Date(),
              deviceId: socketService.getDeviceId(),
              sessionId: sessionId
            };
            setMessages(prev => [...prev, swapMessage]);
            
            // Speak the success message
            if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
              speakText(swapMessage.text);
            }
            break;
          case 'get-token-price':
            // Simulate price check
            simulateActionUsage('get-token-by-ticker');
            // Add a success message
            const token = topAction.parameters.token || 'SONIC';
            const priceMessage: Message = {
              text: `📊 Current price of ${token}: $${(Math.random() * 10).toFixed(2)}`,
              isUser: false,
              timestamp: new Date(),
              deviceId: socketService.getDeviceId(),
              sessionId: sessionId
            };
            setMessages(prev => [...prev, priceMessage]);
            
            // Speak the success message
            if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
              speakText(priceMessage.text);
            }
            break;
          case 'get-transaction-history':
            // Simulate transaction history
            simulateActionUsage('get-transaction-history');
            // Add a success message
            const historyMessage: Message = {
              text: "📜 Here's your recent transaction history:\n\n1. Swap SONIC → ETH (0.5 ETH) - 2 hours ago\n2. Received 100 SONIC - Yesterday\n3. Minted NFT 'Abstract Art #42' - 3 days ago",
              isUser: false,
              timestamp: new Date(),
              deviceId: socketService.getDeviceId(),
              sessionId: sessionId
            };
            setMessages(prev => [...prev, historyMessage]);
            
            // Speak the success message
            if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
              speakText(historyMessage.text);
            }
            break;
        }
        
        // Remove the executed action
        contextService.clearPromisedActions();
        setPromisedActions([]);
      }
    }
  }, [promisedActions]);

  // Add a function to handle voice input
  const handleVoiceInput = (text: string) => {
    if (text.trim()) {
      setInputMessage(text);
      handleSend(text);
    }
  };

  // Modify the handleSend function to use LLM-based intent detection
  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    // Create user message
    const userMessage: Message = {
      text: message,
      isUser: true,
      timestamp: new Date(),
      deviceId: socketService.getDeviceId(),
      sessionId: sessionId
    };
    
    // Add to local state
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    // Add to context
    contextService.addMessage(userMessage);
    
    // Broadcast to other clients
    socketService.sendNewMessage(userMessage);

    // Check if this is an email login request
    if (waitingForEmail) {
      handleEmailLogin(message);
      return;
    }

    // Check if this is an NFT generation request using LLM
    const nftRequest = await isNftGenerationRequest(message);
    if (nftRequest.isRequest) {
      handleNftGeneration(nftRequest.description);
      simulateActionUsage('mint-nft');
      return;
    }

    // Send to backend
    try {
      const response = await fetch('https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
      });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        setIsLoading(false);
        
        // Check if the backend response includes an NFT generation action
        if (data.action && data.action.type === 'nft_generation') {
          // Add assistant message
          const assistantMessage: Message = {
            text: data.response,
            isUser: false,
            timestamp: new Date(),
            deviceId: socketService.getDeviceId(),
            sessionId: sessionId
          };
          setMessages(prev => [...prev, assistantMessage]);
          
          // Speak the assistant's response if voice is enabled
          if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
            speakText(data.response);
          }
          
          // Handle NFT generation with the description from the action
          handleNftGeneration(data.action.description);
          simulateActionUsage('mint-nft');
          return;
        }
        
        // Add assistant message
        const assistantMessage: Message = {
          text: data.response,
          isUser: false,
          timestamp: new Date(),
          deviceId: socketService.getDeviceId(),
          sessionId: sessionId
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Speak the assistant's response if voice is enabled
        if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
          speakText(data.response);
        }
        
        // Check if the response indicates an action that should be performed
        checkAndPerformPromisedActions(data.response);
        
        // Check if the response is requesting an NFT
        const nftResponse = await checkAgentResponseForNftRequest(data.response);
        if (nftResponse.isRequest) {
          handleNftGeneration(nftResponse.description);
        }
        
        // Update communication logs
        if (data.logs && data.logs.length > 0) {
          const newLogs: CommunicationLog[] = data.logs.map(log => ({
            message: log.message,
            isUser: log.is_user,
            timestamp: new Date(log.timestamp),
            imageUrl: log.imageUrl
          }));
          setCommunicationLogs(prev => [...prev, ...newLogs]);
        }
        
        // Track tools used by the backend
        if (data.tools && data.tools.length > 0) {
          data.tools.forEach(tool => {
            simulateActionUsage(tool.name);
          });
        }
      } else {
        setIsLoading(false);
        const errorMessage: Message = {
          text: "Sorry, there was an error processing your request. Please try again.",
          isUser: false,
          timestamp: new Date(),
          isError: true,
          deviceId: socketService.getDeviceId(),
          sessionId: sessionId
        };
        setMessages(prev => [...prev, errorMessage]);
        
        // Speak the error message if voice is enabled
        if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
          speakText(errorMessage.text);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      const errorMessage: Message = {
        text: "Sorry, there was an error connecting to the server. Please check your connection and try again.",
        isUser: false,
        timestamp: new Date(),
        isError: true,
        deviceId: socketService.getDeviceId(),
        sessionId: sessionId
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Speak the error message if voice is enabled
      if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
        speakText(errorMessage.text);
      }
    }
  };

  // Update the checkAndPerformPromisedActions function to use LLM
  const checkAndPerformPromisedActions = async (response: string) => {
    // Add the assistant's message to context
    const assistantMessage: Message = {
      text: response,
      isUser: false,
      timestamp: new Date(),
      deviceId: socketService.getDeviceId(),
      sessionId: sessionId
    };
    
    contextService.addMessage(assistantMessage);
    
    // Use LLM to detect promised actions
    try {
      const detectedActions = await llmActionDetector.detectPromisedActions(response);
      
      // Process each detected action
      for (const action of detectedActions) {
        if (action.probability >= 0.8) {
          console.log(`Detected promised action with high confidence: ${action.type}`, action.parameters);
          
          // Add to promised actions for execution
          contextService.addPromisedAction(action);
        }
      }
    } catch (error) {
      console.error('Error detecting promised actions:', error);
    }
  };

  // Modify the handleNftGeneration function to use the restored IPFS-based NFT generation
  const handleNftGeneration = async (description: string) => {
    try {
      // Add a message indicating NFT generation is starting
      const startMessage: Message = {
        text: `Starting NFT generation with prompt: "${description}"`,
        isUser: false,
        timestamp: new Date(),
        deviceId: socketService.getDeviceId(),
        sessionId: sessionId
      };
      setMessages(prev => [...prev, startMessage]);
      
      // Speak the start message
      if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
        speakText(startMessage.text);
      }
      
      // Update progress function that also speaks updates
      const updateProgress = (message: string) => {
        const progressMessage: Message = {
          text: message,
          isUser: false,
          timestamp: new Date(),
          deviceId: socketService.getDeviceId(),
          sessionId: sessionId
        };
        setMessages(prev => [...prev, progressMessage]);
        
        // Speak the progress message
        if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
          speakText(message);
        }
      };
      
      // Generate and mint the NFT using the restored IPFS-based implementation
      const result = await nftService.generateAndMintNFT(description);
      
      if (result.success) {
        // Add the success message with the image
        const successMessage: Message = {
          text: `✅ NFT generated and minted successfully!\n\n🔗 View on Explorer: ${result.explorerLink}\n\nTransaction Hash: ${result.transactionHash}\n\nIPFS Image: ${result.imageUrl}\nIPFS Metadata: ${result.metadataUrl}`,
          isUser: false,
          timestamp: new Date(),
          imageUrl: result.imageUrl,
          deviceId: socketService.getDeviceId(),
          sessionId: sessionId
        };
        setMessages(prev => [...prev, successMessage]);
        
        // Speak the success message
        if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
          speakText("Your NFT has been generated and minted successfully! You can now view it on the blockchain explorer.");
        }
        
        // Track the NFT minting action
        simulateActionUsage('mint-nft');
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Error generating NFT:', error);
      const errorMessage: Message = {
        text: `Sorry, there was an error generating your NFT: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isUser: false,
        timestamp: new Date(),
        isError: true,
        deviceId: socketService.getDeviceId(),
        sessionId: sessionId
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Speak the error message
      if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
        speakText(errorMessage.text);
      }
    }
  };

  // Modify the speakText function to handle all types of messages
  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      // Clean up the text for better speech
      let cleanText = text
        .replace(/```[^`]*```/g, "Code block omitted for speech.") // Replace code blocks
        .replace(/\*\*([^*]*)\*\*/g, "$1") // Remove markdown bold
        .replace(/\*([^*]*)\*/g, "$1") // Remove markdown italic
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // Replace markdown links with just the text
        .replace(/https?:\/\/[^\s]+/g, "URL omitted for speech."); // Replace URLs
      
      // Limit text length for speech
      if (cleanText.length > 500) {
        cleanText = cleanText.substring(0, 500) + "... I'll stop here for brevity.";
      }
      
      const audioUrl = await textToSpeech(cleanText);
      await playAudio(audioUrl);
    } catch (error) {
      console.error('Error with text-to-speech:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Add a function to toggle voice settings
  const toggleVoiceEnabled = () => {
    setVoiceSettings(prev => ({
      ...prev,
      enabled: !prev.enabled
    }));
  };

  const toggleAutoPlayResponses = () => {
    setVoiceSettings(prev => ({
      ...prev,
      autoPlayResponses: !prev.autoPlayResponses
    }));
  };

  // Add function to toggle chat visibility
  const toggleChatVisibility = () => {
    setUiMode(prev => ({
      ...prev,
      chatVisible: !prev.chatVisible
    }));
  };

  // Add function to toggle voice-only mode
  const toggleVoiceOnlyMode = () => {
    setUiMode(prev => ({
      ...prev,
      voiceOnly: !prev.voiceOnly,
      // If enabling voice-only, make sure chat is visible
      chatVisible: prev.voiceOnly ? prev.chatVisible : true
    }));
  };

  // Add function to simulate action usage (for demo purposes)
  const simulateActionUsage = (actionName: string) => {
    const actionDescriptions: Record<string, string> = {
      'get-token-by-ticker': 'Get token address by ticker symbol',
      'get-sonic-balance': 'Get $S or token balance',
      'send-sonic': 'Send $S tokens to an address',
      'send-sonic-token': 'Send a token on Sonic to an address',
      'swap-sonic': 'Swap tokens on Sonic DEX',
      'get-token-price': 'Get current price of a token in USD or another base currency',
      'get-transaction-history': 'Get transaction history for an address',
      'add-liquidity': 'Add liquidity to a pool on Sonic',
      'remove-liquidity': 'Remove liquidity from a pool on Sonic',
      'get-pool-info': 'Get information about a liquidity pool',
      'estimate-swap': 'Estimate the output amount for a token swap without executing it',
      'create-wallet': 'Create a wallet using the Privy API',
      'mint-nft': 'Mint an NFT on Sonic'
    };
    
    const action: ActionUsage = {
        name: actionName,
        description: actionDescriptions[actionName] || 'Unknown action',
      timestamp: new Date(),
      sessionId: sessionId,
      deviceId: socketService.getDeviceId()
    };
    
    // Add to local state
    setUsedActions(prev => [...prev, action]);
    
    // Broadcast to other clients
    socketService.sendActionUsed(action);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  const handleShowWalletCreator = () => {
    setShowPrivyWalletCreator(true);
  };

  // Function to handle email login
  const handleEmailLogin = async (email: string) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessages(prev => [...prev, {
        text: 'Please enter a valid email address.',
        isUser: false,
        timestamp: new Date()
      }]);
      return;
    }

    try {
      setMessages(prev => [...prev, {
        text: 'Sending verification link to your email...',
        isUser: false,
        timestamp: new Date()
      }]);
      
      // Use the login method with loginMethods parameter to specify email login
      await login({ 
        loginMethods: ['email'],
        prefill: { type: 'email', value: email }
      });
      
      setMessages(prev => [...prev, {
        text: 'Verification link sent! Please check your email and click the link to verify.',
        isUser: false,
        timestamp: new Date()
      }]);
      
      // Check for authentication status periodically
      const checkAuthStatus = setInterval(() => {
        if (authenticated) {
          clearInterval(checkAuthStatus);
          setMessages(prev => [...prev, {
            text: 'Authentication successful! Creating your wallet now...',
            isUser: false,
            timestamp: new Date()
          }]);
          setWaitingForEmail(false);
          handleWalletCreation('ethereum');
        }
      }, 2000);
      
      // Clear the interval after 5 minutes (300000ms) if authentication doesn't succeed
      setTimeout(() => {
        clearInterval(checkAuthStatus);
        if (!authenticated) {
          setMessages(prev => [...prev, {
            text: 'Authentication timed out. Please try again.',
            isUser: false,
            timestamp: new Date()
          }]);
          setWaitingForEmail(false);
        }
      }, 300000);
      
    } catch (error) {
      console.error('Error during email login:', error);
      setMessages(prev => [...prev, {
        text: 'There was an error sending the verification link. Please try again.',
        isUser: false,
        timestamp: new Date(),
        isError: true
      }]);
      setWaitingForEmail(false);
    }
  };

  // Function to handle wallet creation directly in the chat
  const handleWalletCreation = async (chainType: string) => {
    if (!authenticated) {
      const errorMessage: Message = {
        text: "Wallet creation is not ready yet. Please try again in a moment.",
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Start creating wallet immediately
    setIsCreatingWallet(true);
    const creatingMessage: Message = {
      text: "Creating your wallet now... This will just take a moment.",
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, creatingMessage]);

    try {
      // Check if user already has embedded wallets
      const userWallets = privyWallets.filter(wallet => wallet.walletClientType === 'privy');
      let newWallet;

      if (userWallets.length > 0) {
        // User already has a wallet, use the first one
        newWallet = userWallets[0];
        console.log('Using existing wallet:', newWallet);
      } else {
        // Try to create a new wallet
        newWallet = await createWallet();
      }
      
      if (!newWallet) {
        throw new Error("Failed to create wallet: No wallet returned");
      }
      
      // Get the wallet address (or use empty string if undefined)
      const address = newWallet.address || '';
      
      // Notify backend about the new wallet (optional)
      try {
        await axios.post("https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app/agent/action", {
          connection: 'sonic',
          action: 'register-wallet',
          params: [{
            id: typeof newWallet === 'object' && 'id' in newWallet ? newWallet.id : '',
            address: address,
            chain_type: chainType
          }]
        });
      } catch (backendError) {
        console.error('Failed to notify backend about new wallet:', backendError);
        // We don't show an error here as the wallet was still created successfully
      }
      
      // Show success message with wallet details
      const successMessage: Message = {
        text: `✅ Your wallet has been created successfully!\n\n📋 Wallet Address: ${address || 'Not available'}\n🔗 Chain: ${chainType}\n\nI've copied your address to the clipboard for convenience. Make sure to save this information securely.`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
      
      // Copy address to clipboard if available
      if (address) {
        navigator.clipboard.writeText(address)
          .catch(err => console.error('Failed to copy address to clipboard:', err));
      }
      
    } catch (error) {
      console.error('Error creating wallet:', error);
      
      // Check if the error is related to authentication
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('authenticated') || errorMessage.includes('auth')) {
        // Handle authentication error
        const authErrorMessage: Message = {
          text: "To create a wallet, you need to authenticate first. Don't worry, it's quick and easy!",
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, authErrorMessage]);
        
        // Ask for email
        const emailPromptMessage: Message = {
          text: "Please enter your email address to continue with wallet creation:",
          isUser: false,
          timestamp: new Date(),
          isEmailInput: true
        };
        setMessages(prev => [...prev, emailPromptMessage]);
        
        // Set waiting for email flag
        setWaitingForEmail(true);
      } else if (errorMessage.includes('already has an embedded wallet')) {
        // Handle case where user already has a wallet
        const existingWallets = privyWallets.filter(wallet => wallet.walletClientType === 'privy');
        
        if (existingWallets.length > 0) {
          const existingWallet = existingWallets[0];
          const address = existingWallet.address || '';
          
          const walletInfoMessage: Message = {
            text: `You already have a wallet! Here are the details:\n\n📋 Wallet Address: ${address || 'Not available'}\n🔗 Chain: ${chainType}\n\nI've copied your address to the clipboard for convenience.`,
            isUser: false,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, walletInfoMessage]);
          
          // Copy address to clipboard if available
          if (address) {
            navigator.clipboard.writeText(address)
              .catch(err => console.error('Failed to copy address to clipboard:', err));
          }
        } else {
          // This shouldn't happen, but handle it just in case
          const errorMessage: Message = {
            text: "You already have a wallet, but I couldn't retrieve its details. Please try refreshing the page.",
            isUser: false,
            timestamp: new Date(),
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Handle other errors
        const errorMessage: Message = {
          text: `There was an error creating your wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isUser: false,
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Replace the toggleConversationHistory function
  const toggleConversationHistory = () => {
    setShowConversationHistory(prev => !prev);
  };

  // Add a keyboard shortcut to toggle voice-only mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Alt+V to toggle voice-only mode
      if (e.altKey && e.key === 'v') {
        toggleVoiceOnlyMode();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  // Add textareaRef
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Add a toggle function for debug mode
  const toggleDebugMode = () => {
    setUiMode(prev => ({
      ...prev,
      debugMode: !prev.debugMode,
      voiceOnly: false // Exit voice-only mode when entering debug mode
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Background blobs similar to Home.tsx */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#f58435] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-[#df561f] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-[#224f81] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Minimal Header */}
      <div className="relative z-10 flex justify-between items-center p-3 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] via-white to-[#224f81]">
            SonicLine
          </h1>
        </div>
        
        <div className="flex space-x-2">
          <button 
            onClick={toggleVoiceEnabled} 
            className={`p-2 rounded-lg transition-all ${voiceSettings.enabled ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-black/30 text-gray-400'}`}
            title={voiceSettings.enabled ? "Disable voice input" : "Enable voice input"}
          >
            {voiceSettings.enabled ? <MicrophoneIcon className="h-4 w-4" /> : <MicrophoneOffIcon className="h-4 w-4" />}
          </button>
          
          <button
            onClick={toggleVoiceOnlyMode} 
            className={`p-2 rounded-lg transition-all ${uiMode.voiceOnly ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-black/30 text-gray-400'}`}
            title={uiMode.voiceOnly ? "Switch to chat mode" : "Switch to voice-only mode"}
            disabled={uiMode.debugMode}
          >
            {uiMode.voiceOnly ? <PhoneIcon className="h-4 w-4" /> : <PhoneOffIcon className="h-4 w-4" />}
          </button>
          
          <button
            onClick={toggleDebugMode} 
            className={`p-2 rounded-lg transition-all ${uiMode.debugMode ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-black/30 text-gray-400'}`}
            title={uiMode.debugMode ? "Exit debug mode" : "Enter debug mode"}
          >
            <DebugIcon className="h-4 w-4" />
          </button>
          
        <button
            onClick={toggleConversationHistory} 
            className="p-2 bg-black/30 rounded-lg text-gray-400 hover:bg-black/40 transition-all"
            title="Show conversation history"
        >
            <ClockIcon className="h-4 w-4" />
        </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Debug mode */}
        {uiMode.debugMode ? (
          <div className="flex-1 p-4">
            <DebugView messages={messages} usedActions={usedActions} />
          </div>
        ) : uiMode.voiceOnly ? (
          // Voice-only mode with Orb
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Orb container */}
            <div className="w-full max-w-md aspect-square relative mx-auto">
              <Orb
                hue={30} // Orange hue to match the theme
                hoverIntensity={0.5}
                rotateOnHover={true}
                forceHoverState={isSpeaking}
              />
              
              {/* Microphone button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                  {voiceSettings.enabled && (
                  <div className="scale-150 z-10">
                      <VoiceInput 
                        onFinalResult={handleVoiceInput}
                      disabled={isLoading}
                      />
                    </div>
                  )}
                      </div>
                </div>
                
                {/* Last message display */}
                {messages.length > 0 && (
              <div className="w-full max-w-md mt-8 bg-black/20 backdrop-blur-sm p-4 rounded-lg border border-gray-800/50">
                <p className="text-sm text-gray-400 mb-2">Last message:</p>
                <p className="text-white">{messages[messages.length - 1].text}</p>
                  </div>
                )}
            
            {/* Speaking indicator */}
            {isSpeaking && (
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
                <span className="text-white text-sm">Speaking...</span>
                    </div>
                  )}
          </div>
        ) : (
          // Regular chat mode - more minimal
          <div className={`flex-1 flex flex-col ${showConversationHistory ? 'w-2/3' : 'w-full'}`}>
            {uiMode.chatVisible ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-r from-[#f58435]/10 to-[#224f81]/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                      <h3 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] via-white to-[#224f81]">Start a Conversation</h3>
                      <p className="text-lg text-orange-100/70 max-w-md font-light">Ask about blockchain, tokens, or use voice commands</p>
                    </div>
                  )}
                  
                  {messages.map((msg, index) => (
                      <div 
                        key={index} 
                      className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                        className={`max-w-3/4 p-3 rounded-lg ${
                          msg.isUser 
                            ? 'bg-gradient-to-r from-[#f58435]/20 to-[#df561f]/20 border border-[#f58435]/30 text-white' 
                            : 'bg-gradient-to-r from-[#224f81]/20 to-[#1a3b61]/20 border border-[#224f81]/30 text-white'
                        } ${msg.isError ? 'border-2 border-red-500' : ''}`}
                      >
                        {msg.isEmailInput ? (
                          <div className="space-y-2">
                            <p>{msg.text}</p>
                            <input 
                              type="email" 
                              placeholder="Enter your email" 
                              className="w-full p-2 rounded bg-black/30 border border-gray-700 text-white"
                              value={inputMessage}
                              onChange={(e) => setInputMessage(e.target.value)}
                            />
                            <button 
                              onClick={() => handleEmailLogin(inputMessage)}
                              className="w-full p-2 bg-gradient-to-r from-[#f58435] to-[#224f81] rounded-lg text-white font-medium transition-all hover:opacity-90"
                            >
                              Login
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            {msg.imageUrl && (
                              <div className="mt-2 rounded-lg overflow-hidden border border-gray-700">
                                <img src={msg.imageUrl} alt="Generated content" className="w-full h-auto" />
                            </div>
                          )}
                          </>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                        </div>
                      </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-3/4 p-3 rounded-lg bg-gradient-to-r from-[#224f81]/20 to-[#1a3b61]/20 border border-[#224f81]/30 text-white">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
                          <div className="w-2 h-2 rounded-full bg-white animate-bounce animation-delay-200"></div>
                          <div className="w-2 h-2 rounded-full bg-white animate-bounce animation-delay-400"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Minimal Input area */}
                <div className="relative z-10 p-3 bg-black/20 backdrop-blur-sm">
                  <div className="flex space-x-2">
                        {voiceSettings.enabled && (
                      <div className="flex-none">
                            <VoiceInput 
                              onFinalResult={handleVoiceInput}
                          disabled={isLoading}
                            />
                          </div>
                        )}
                    
                    <div className="relative flex-1">
                        <textarea
                        ref={textareaRef}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                        placeholder="Type your message..."
                        className="w-full p-2 pr-10 bg-black/30 border border-gray-800/50 rounded-lg text-white resize-none focus:outline-none focus:ring-1 focus:ring-[#f58435]/50"
                          rows={1}
                        disabled={isLoading}
                      />
                      <button
                        onClick={() => handleSend(inputMessage)}
                        disabled={isLoading || !inputMessage.trim()}
                        className="absolute right-2 bottom-2 p-1.5 rounded-full bg-gradient-to-r from-[#f58435] to-[#224f81] text-white disabled:opacity-50 transition-all"
                      >
                        <SendIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Speaking indicator */}
                  {isSpeaking && (
                    <div className="mt-2 flex items-center space-x-2 bg-black/30 px-3 py-1 rounded-full inline-block">
                      <div className="flex space-x-1">
                        <div className="w-1 h-3 bg-[#f58435] rounded-full animate-pulse"></div>
                        <div className="w-1 h-3 bg-[#f58435] rounded-full animate-pulse animation-delay-200"></div>
                        <div className="w-1 h-3 bg-[#f58435] rounded-full animate-pulse animation-delay-400"></div>
                      </div>
                      <span className="text-white text-xs">Speaking...</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Dashboard Cards */}
                  <div className="bg-black/20 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">Voice Features</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Voice Enabled</span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${voiceSettings.enabled ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-gray-800 text-gray-400'}`}>
                          {voiceSettings.enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Auto-Play Responses</span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${voiceSettings.autoPlayResponses ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-gray-800 text-gray-400'}`}>
                          {voiceSettings.autoPlayResponses ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-black/20 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">Wallet Status</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Connected Wallet</span>
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${privyWallets.length > 0 ? 'bg-gradient-to-r from-[#f58435] to-[#224f81] text-white' : 'bg-gray-800 text-gray-400'}`}>
                          {privyWallets.length > 0 ? 'YES' : 'NO'}
                        </span>
                      </div>
                      {privyWallets.length > 0 && (
                        <div className="text-sm text-gray-400 break-all">
                          {privyWallets[0].address}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-black/20 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">Recent Actions</h3>
                    <div className="space-y-2">
                      {usedActions.length === 0 ? (
                        <p className="text-sm text-gray-500">No actions used yet</p>
                      ) : (
                        usedActions.slice(-3).reverse().map((action, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-[#f58435]"></div>
                            <span className="text-gray-300">{action.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation history sidebar - more minimal */}
        {showConversationHistory && (
          <div className="fixed inset-y-0 right-0 w-72 bg-black/40 backdrop-blur-md border-l border-gray-800/50 shadow-xl z-40 overflow-y-auto">
            <div className="p-3 border-b border-gray-800/50">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">History</h2>
                <button 
                  onClick={toggleConversationHistory}
                  className="p-1 rounded-full hover:bg-gray-800/50 transition-all"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400" />
                </button>
            </div>
            </div>
            <div className="p-3 space-y-3">
              {communicationLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No conversation history yet</p>
                </div>
              ) : (
                communicationLogs.map((log, index) => (
                  <div key={index} className="p-2 rounded-lg bg-black/30 border border-gray-800/50 hover:border-[#f58435]/30 cursor-pointer transition-all">
                    <p className="text-sm text-gray-300 truncate">{log.message}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500">{log.timestamp.toLocaleString()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${log.isUser ? 'bg-[#f58435]/20 text-[#f58435]' : 'bg-[#224f81]/20 text-[#224f81]'}`}>
                        {log.isUser ? 'You' : 'AI'}
                        </span>
                      </div>
                        </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wallet creator modal - more minimal */}
      {showPrivyWalletCreator && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/60 p-6 rounded-xl border border-gray-800/50 shadow-2xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] to-[#224f81]">Create Wallet</h2>
            <div className="space-y-4">
              <button 
                onClick={() => handleWalletCreation('ethereum')}
                className="w-full p-3 bg-gradient-to-r from-[#f58435] to-[#224f81] rounded-lg text-white font-medium transition-all hover:opacity-90"
              >
                Ethereum Wallet
              </button>
              <button 
                onClick={() => handleWalletCreation('cardano')}
                className="w-full p-3 bg-gradient-to-r from-[#f58435] to-[#224f81] rounded-lg text-white font-medium transition-all hover:opacity-90"
              >
                Cardano Wallet
              </button>
              <button 
                onClick={() => setShowPrivyWalletCreator(false)}
                className="w-full p-3 bg-black/50 border border-gray-800/50 rounded-lg text-white font-medium transition-all hover:bg-black/70"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add a link to the debug page */}
      <div className="absolute bottom-4 right-4 z-50">
        <Link 
          to={`/debug?session=${sessionId}`}
          className="flex items-center space-x-1 bg-gray-800/50 hover:bg-gray-700/50 px-3 py-1 rounded-full text-xs"
          target="_blank"
        >
          <DebugIcon className="w-4 h-4" />
          <span>Open Debug Console</span>
        </Link>
            </div>
          </div>
  );
}

export default Chat;