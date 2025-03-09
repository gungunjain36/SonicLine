import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth';
import PrivyWalletCreator from './PrivyWalletCreator';
// @ts-expect-error - Missing type definitions for nftService
import * as nftService from '../utils/nftService';
import VoiceInput from './VoiceInput';
import { textToSpeech, playAudio } from '../utils/elevenLabsService';
import Orb from './Orb';
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
  PaperAirplaneIcon as SendIcon 
} from '@heroicons/react/24/outline';

interface Message {
  text: string;
  isUser: boolean;
  is_user?: boolean;
  timestamp: Date;
  isEmailInput?: boolean;
  imageUrl?: string;
  isError?: boolean;
}

interface CommunicationLog {
  message: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
}

interface WalletData {
  id: string;
  address: string | null | undefined;
  chain_type: string;
  policy_ids?: string[];
}

// Add a new interface for voice settings
interface VoiceSettings {
  enabled: boolean;
  autoPlayResponses: boolean;
}

// Add interface for UI mode
interface UiMode {
  chatVisible: boolean;
  voiceOnly: boolean;
}

// Add interface for tracking actions
interface ActionUsage {
  name: string;
  description: string;
  timestamp: Date;
}

// Define the type for the API response
interface ApiResponse {
  message: string;
  response: string;
  logs: Array<{
    timestamp: string;
    is_user: boolean;
    message: string;
    imageUrl?: string;
  }>;
}

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
    voiceOnly: false
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch communication logs periodically
  useEffect(() => {
    if (showConversationHistory) {
      const fetchCommunicationLogs = async () => {
        try {
          const response = await axios.get('http://localhost:8000/communication-logs');
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

  // Use the availableActions state
  useEffect(() => {
    // Initialize available actions
    setAvailableActions([
      'get-token-by-ticker',
      'get-sonic-balance',
      'send-sonic',
      'swap-sonic',
      'get-transaction-history',
      'create-wallet',
      'mint-nft'
    ]);
  }, []);

  // Add a function to handle voice input
  const handleVoiceInput = (text: string) => {
    if (text.trim()) {
      setInputMessage(text);
      handleSend(text);
    }
  };

  // Modify the handleSend function to include voice feedback
  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: Message = {
      text: message,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Check if this is an email login request
    if (waitingForEmail) {
      handleEmailLogin(message);
      return;
    }

    // Check if this is an NFT generation request
    const nftRequest = isNftGenerationRequest(message);
    if (nftRequest.isRequest) {
      handleNftGeneration(nftRequest.description);
      simulateActionUsage('mint-nft');
      return;
    }

    // Simulate action usage based on message content
    if (message.toLowerCase().includes('balance')) {
      simulateActionUsage('get-sonic-balance');
    } else if (message.toLowerCase().includes('price')) {
      simulateActionUsage('get-token-price');
    } else if (message.toLowerCase().includes('swap')) {
      simulateActionUsage('swap-sonic');
    } else if (message.toLowerCase().includes('transaction') || message.toLowerCase().includes('history')) {
      simulateActionUsage('get-transaction-history');
    } else if (message.toLowerCase().includes('wallet')) {
      simulateActionUsage('create-wallet');
    }

    // Send to backend
    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message }),
      });

      if (response.ok) {
        const data: ApiResponse = await response.json();
        setIsLoading(false);
        
        // Add assistant message
        const assistantMessage: Message = {
          text: data.response,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Check if the response indicates an NFT request
        const nftResponse = checkAgentResponseForNftRequest(data.response);
        if (nftResponse.isNftResponse) {
          handleNftGeneration(nftResponse.description);
          simulateActionUsage('mint-nft');
        }
        
        // Auto-play response if enabled
        if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
          speakText(data.response);
        }
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Error:', error);
      
      // Add error message
      const errorMessage: Message = {
        text: "Sorry, there was an error processing your request. Please try again.",
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Add a function to speak text using Eleven Labs
  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      const audioBlob = await textToSpeech(text);
      await playAudio(audioBlob);
    } catch (error) {
      console.error('Error speaking text:', error);
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
    
    setUsedActions(prev => [
      ...prev, 
      {
        name: actionName,
        description: actionDescriptions[actionName] || 'Unknown action',
        timestamp: new Date()
      }
    ]);
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
        await axios.post("http://localhost:8000/agent/action", {
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

  // Function to handle NFT generation requests
  const handleNftGeneration = async (description: string) => {
    try {
      setIsLoading(true);
      
      // Update progress messages
      const updateProgress = (message: string) => {
        setMessages(prev => [...prev, {
          text: message,
          isUser: false,
          timestamp: new Date()
        }]);
      };
      
      // Call the NFT generation service with progress updates
      updateProgress("🖼️ Generating image using AI... (this may take up to a minute)");
      
      // Call the NFT generation service
      const result = await nftService.generateAndMintNFT(description);
      
      if (result.success) {
        // Show image preview
        updateProgress(`✅ Image generated successfully! Preview:`);
        
        // Add a message with the image preview
        const imagePreviewMessage: Message = {
          text: "NFT Preview:",
          isUser: false,
          timestamp: new Date(),
          imageUrl: result.imageUrl
        };
        setMessages(prev => [...prev, imagePreviewMessage]);
        
        // Show IPFS upload progress
        updateProgress(`📤 Uploaded to IPFS with Image CID: ${result.imageCid}`);
        updateProgress(`🔗 View on IPFS: ${result.imageUrl}`);
        
        // Show metadata progress
        updateProgress(`📝 Created and uploaded metadata with CID: ${result.metadataCid}`);
        if (result.metadataUrl) {
          updateProgress(`🔗 View metadata on IPFS: ${result.metadataUrl}`);
        }
        
        // Show minting progress
        updateProgress(`⛓️ Minting NFT on Sonic blockchain...`);
        
        // Mint the NFT
        try {
          const mintResponse = await axios.post('http://localhost:8000/api/mint-nft', {
            uri: result.imageUrl,
            description: description
          });
          
          if (mintResponse.data.success) {
            updateProgress(`✅ NFT minted successfully!`);
            if (mintResponse.data.transaction_hash) {
              updateProgress(`🔍 Transaction: ${mintResponse.data.transaction_hash}`);
            }
            if (mintResponse.data.explorer_link) {
              updateProgress(`🔍 View on explorer: ${mintResponse.data.explorer_link}`);
            }
          } else {
            updateProgress(`❌ Failed to mint NFT: ${mintResponse.data.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('Error minting NFT:', error);
          updateProgress(`❌ Error minting NFT: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        updateProgress(`❌ Failed to generate NFT: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating NFT:', error);
      const errorMessage: Message = {
        text: `❌ Error generating NFT: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isUser: false,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check if a message is an NFT generation request
  const isNftGenerationRequest = (message: string): { isRequest: boolean, description: string } => {
    // Define patterns to match NFT generation requests
    const patterns = [
      /mint(?:\s+an?)?\s+nft\s+(?:of|with|showing|depicting)\s+(.+)/i,
      /create(?:\s+an?)?\s+nft\s+(?:of|with|showing|depicting)\s+(.+)/i,
      /generate(?:\s+an?)?\s+nft\s+(?:of|with|showing|depicting)\s+(.+)/i,
      /make(?:\s+an?)?\s+nft\s+(?:of|with|showing|depicting)\s+(.+)/i,
      /mint(?:\s+an?)?\s+nft\s+where\s+(.+)/i,
      /create(?:\s+an?)?\s+nft\s+where\s+(.+)/i,
      /generate(?:\s+an?)?\s+nft\s+where\s+(.+)/i,
      /make(?:\s+an?)?\s+nft\s+where\s+(.+)/i
    ];
    
    // Check if the message matches any of the patterns
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        console.log(`🔍 Detected NFT generation request: "${match[1].trim()}"`);
        return { isRequest: true, description: match[1].trim() };
      }
    }
    
    // If no pattern matches, check for simpler patterns
    if (/nft.*car.*horse/i.test(message) || /car.*riding.*horse/i.test(message)) {
      const description = "a car riding on a horse";
      console.log(`🔍 Detected special NFT case: "${description}"`);
      return { isRequest: true, description };
    }
    
    return { isRequest: false, description: '' };
  };

  // Function to check if an agent response contains an NFT generation instruction
  const checkAgentResponseForNftRequest = (message: string): { isNftResponse: boolean, description: string } => {
    // Patterns to match the agent's response about NFT creation
    const patterns = [
      /I'll create an NFT based on your description: "([^"]+)"/i,
      /I'll generate an NFT (of|with|showing|depicting) "([^"]+)"/i,
      /I'll mint an NFT (of|with|showing|depicting) "([^"]+)"/i,
      /creating an NFT (of|with|showing|depicting) "([^"]+)"/i,
      /generating an NFT (of|with|showing|depicting) "([^"]+)"/i,
      /minting an NFT (of|with|showing|depicting) "([^"]+)"/i,
      /To create your unique NFT with the theme "([^"]+)"/i,
      /Let's create an NFT with a metadata placeholder/i
    ];
    
    // Check for the first pattern which has a different capture group structure
    const firstMatch = message.match(patterns[0]);
    if (firstMatch && firstMatch[1]) {
      console.log(`🔍 Detected NFT instruction in agent response: "${firstMatch[1].trim()}"`);
      return { isNftResponse: true, description: firstMatch[1].trim() };
    }
    
    // Check for patterns with a different capture group structure
    for (let i = 1; i < 7; i++) {
      const match = message.match(patterns[i]);
      if (match && match[2]) {
        console.log(`🔍 Detected NFT instruction in agent response: "${match[2].trim()}"`);
        return { isNftResponse: true, description: match[2].trim() };
      }
    }
    
    // Check for the specific pattern about metadata placeholder
    if (patterns[7].test(message)) {
      // Extract description from the message if possible
      const descMatch = message.match(/theme "([^"]+)"/i) || message.match(/NFT with a ([^"]+)/i);
      const description = descMatch ? descMatch[1].trim() : "a car riding on a horse";
      console.log(`🔍 Detected metadata placeholder NFT instruction: "${description}"`);
      return { isNftResponse: true, description };
    }
    
    // Special case for the car riding on a horse
    if (/car riding on a horse/i.test(message)) {
      console.log(`🔍 Detected special case NFT instruction: "a car riding on a horse"`);
      return { isNftResponse: true, description: "a car riding on a horse" };
    }
    
    return { isNftResponse: false, description: '' };
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
          >
            {uiMode.voiceOnly ? <PhoneIcon className="h-4 w-4" /> : <PhoneOffIcon className="h-4 w-4" />}
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
        {/* Voice-only mode with Orb */}
        {uiMode.voiceOnly ? (
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
    </div>
  );
}

export default Chat;