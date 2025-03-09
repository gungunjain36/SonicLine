import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth';
import PrivyWalletCreator from './PrivyWalletCreator';
// @ts-expect-error - Missing type definitions for nftService
import * as nftService from '../utils/nftService';
import VoiceInput from './VoiceInput';
import { textToSpeech, playAudio } from '../utils/elevenLabsService';

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

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">SonicLine Assistant</h1>
        <div className="flex space-x-2">
          <button 
            onClick={toggleVoiceOnlyMode}
            className={`px-4 py-2 rounded-sm text-sm font-medium ${
              uiMode.voiceOnly 
                ? 'bg-black text-white hover:bg-gray-900' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {uiMode.voiceOnly ? 'Voice Mode' : 'Chat Mode'}
          </button>
          <button
            onClick={toggleChatVisibility}
            className={`px-4 py-2 rounded-sm text-sm font-medium ${
              uiMode.chatVisible 
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600' 
                : 'bg-black text-white hover:bg-gray-900'
            }`}
            disabled={uiMode.voiceOnly}
          >
            {uiMode.chatVisible ? 'Hide Chat' : 'Show Chat'}
          </button>
          <button
            onClick={toggleConversationHistory}
            className={`px-4 py-2 rounded-sm text-sm font-medium ${
              showConversationHistory 
                ? 'bg-black text-white hover:bg-gray-900' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showConversationHistory ? 'Hide Logs' : 'Show Logs'}
          </button>
          {privyWallets.length > 0 ? (
            <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v1H5V6zm10 3H5v1h10V9zm0 3H5v1h10v-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm truncate max-w-[150px]">{privyWallets[0].address}</span>
        </div>
          ) : (
        <button
          onClick={handleShowWalletCreator}
              className="flex items-center space-x-1 bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-sm text-sm font-medium"
        >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v1H5V6zm10 3H5v1h10V9zm0 3H5v1h10v-1z" clipRule="evenodd" />
              </svg>
              <span>Create Wallet</span>
        </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Voice-only mode or Chat mode */}
        {uiMode.voiceOnly ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
              {/* Central voice input area */}
              <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-sm shadow p-8">
                <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Sonic Voice Assistant</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-8 text-center">
                  Click the microphone and say "Hey Sonic" to start a conversation
                </p>
                
                <div className="voice-button-container mb-8">
                  {voiceSettings.enabled && (
                    <div className="scale-150 mb-4">
                      <VoiceInput 
                        onInterimResult={() => {}}
                        onFinalResult={handleVoiceInput}
                        onError={(error: string) => console.error('Voice input error:', error)}
                      />
                    </div>
                  )}
                  
                  {isSpeaking && (
                    <div className="speaking-indicator mt-4">
                      <div className="speaking-waves">
                        <div className="wave"></div>
                        <div className="wave"></div>
                        <div className="wave"></div>
                      </div>
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
                
                {/* Last message display */}
                {messages.length > 0 && (
                  <div className="w-full bg-gray-50 dark:bg-gray-700 p-4 rounded-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Last message:</p>
                    <p className="text-gray-800 dark:text-gray-200">
                      {messages[messages.length - 1].text}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Actions panel */}
              <div className="md:w-1/3 bg-white dark:bg-gray-800 rounded-sm shadow p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Actions</h3>
                
                {/* Used actions */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recently Used:</h4>
                  {usedActions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No actions used yet</p>
                  ) : (
                    <div className="space-y-2">
                      {usedActions.slice(-5).reverse().map((action, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-700 p-2 rounded-sm">
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{action.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {action.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Available actions */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Available Actions:</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {availableActions.map((action, index) => (
          <div 
            key={index} 
                        className="text-xs px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm"
                      >
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Regular chat mode
          <div className={`flex-1 flex flex-col ${showConversationHistory ? 'w-2/3' : 'w-full'}`}>
            {uiMode.chatVisible ? (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <p className="text-lg font-medium">No messages yet</p>
                      <p className="text-sm">Start a conversation with SonicLine Assistant</p>
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div 
                        key={index} 
                        className={`mb-4 ${message.isUser ? 'text-right' : 'text-left'}`}
                      >
                        <div 
                          className={`inline-block max-w-[80%] p-4 rounded-sm ${
                            message.isUser 
                              ? 'bg-black text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.text}</div>
                          {message.imageUrl && (
                            <div className="mt-2">
                              <img 
                                src={message.imageUrl} 
                                alt="Generated image" 
                                className="rounded-sm max-w-full h-auto"
                              />
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef}></div>
                </div>
                
                {/* Input area */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  {waitingForEmail ? (
                    <div className="flex items-end space-x-2">
                      <div className="flex-1 relative">
                        <textarea
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                          placeholder="Enter your email address..."
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                          style={{ minHeight: '44px', maxHeight: '200px' }}
                        />
                        
                        {/* Voice input button */}
                        {voiceSettings.enabled && (
                          <div className="absolute right-2 bottom-2">
                            <VoiceInput 
                              onInterimResult={() => {}}
                              onFinalResult={handleVoiceInput}
                              onError={(error: string) => console.error('Voice input error:', error)}
                            />
                          </div>
                        )}
                      </div>
                      
                      <button
                        className="p-3 bg-black hover:bg-gray-900 text-white rounded-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleSend(inputMessage)}
                        disabled={isLoading || !inputMessage.trim()}
                      >
                        {isLoading ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-end space-x-2">
                      <div className="flex-1 relative">
                        <textarea
                          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                          placeholder="Type your message..."
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          rows={1}
                          style={{ minHeight: '44px', maxHeight: '200px' }}
                        />
                        
                        {/* Voice input button */}
                        {voiceSettings.enabled && (
                          <div className="absolute right-2 bottom-2">
                            <VoiceInput 
                              onInterimResult={() => {}}
                              onFinalResult={handleVoiceInput}
                              onError={(error: string) => console.error('Voice input error:', error)}
                            />
                          </div>
                        )}
                      </div>
                      
                      <button
                        className="p-3 bg-black hover:bg-gray-900 text-white rounded-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleSend(inputMessage)}
                        disabled={isLoading || !inputMessage.trim()}
                      >
                        {isLoading ? (
                          <div className="loading-spinner"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Speaking indicator */}
                  {isSpeaking && (
                    <div className="speaking-indicator mt-2">
                      <div className="speaking-waves">
                        <div className="wave"></div>
                        <div className="wave"></div>
                        <div className="wave"></div>
                      </div>
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Dashboard Cards */}
                  <div className="bg-white dark:bg-gray-800 rounded-sm shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Voice Features</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-300">Voice Enabled</span>
                        <span className={`px-2 py-1 rounded-sm text-xs font-medium ${voiceSettings.enabled ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {voiceSettings.enabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-300">Auto-Play Responses</span>
                        <span className={`px-2 py-1 rounded-sm text-xs font-medium ${voiceSettings.autoPlayResponses ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {voiceSettings.autoPlayResponses ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-sm shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Wallet Status</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-300">Connected Wallet</span>
                        <span className={`px-2 py-1 rounded-sm text-xs font-medium ${privyWallets.length > 0 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          {privyWallets.length > 0 ? 'YES' : 'NO'}
                        </span>
                      </div>
                      {privyWallets.length > 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 break-all">
                          {privyWallets[0].address}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-sm shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Actions</h3>
                    <div className="space-y-2">
                      {usedActions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No actions used yet</p>
                      ) : (
                        usedActions.slice(-3).reverse().map((action, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-600 dark:text-gray-300">{action.name}</span>
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

        {/* Communication Logs panel */}
        {showConversationHistory && (
          <div className="w-1/3 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex flex-col">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <h2 className="font-semibold text-gray-800 dark:text-white">Communication Logs</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                All interactions with SonicLine Assistant, including those from other devices
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {communicationLogs.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center mt-4">No communication logs yet</p>
              ) : (
                <div className="space-y-3">
                  {communicationLogs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-sm text-sm ${
                        log.isUser 
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-l-4 border-gray-500' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-l-4 border-gray-400'
                      }`}
                    >
                      <div className="font-medium mb-1 flex justify-between">
                        <span>{log.isUser ? 'User' : 'SonicLine Assistant'}</span>
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{log.message}</div>
                      {log.imageUrl && (
                        <div className="mt-2">
                          <img 
                            src={log.imageUrl} 
                            alt="Image" 
                            className="rounded-sm max-w-full h-auto max-h-48 object-contain"
                          />
                        </div>
                      )}
                      
                      {/* Add tools information for assistant messages */}
                      {!log.isUser && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Actions Used:</div>
                          <div className="flex flex-wrap gap-1">
                            {log.message.toLowerCase().includes('balance') && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm text-xs">
                                get-sonic-balance
                              </span>
                            )}
                            {log.message.toLowerCase().includes('price') && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm text-xs">
                                get-token-price
                              </span>
                            )}
                            {log.message.toLowerCase().includes('swap') && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm text-xs">
                                swap-sonic
                              </span>
                            )}
                            {log.message.toLowerCase().includes('transaction') && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm text-xs">
                                get-transaction-history
                              </span>
                            )}
                            {log.message.toLowerCase().includes('nft') && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm text-xs">
                                mint-nft
                              </span>
                            )}
                          </div>
                        </div>
                      )}
          </div>
        ))}
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Wallet Creator Modal */}
      {showPrivyWalletCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Create Wallet</h2>
              <button 
                onClick={() => setShowPrivyWalletCreator(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <PrivyWalletCreator />
            </div>
          </div>
        </div>
      )}

      {/* Add voice settings panel */}
      <div className="voice-settings-panel bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="voice-setting">
          <label htmlFor="voice-enabled">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-gray-600 dark:text-gray-400"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Voice features</span>
          </label>
          <div className="toggle-switch">
            <input
              id="voice-enabled"
              type="checkbox"
              checked={voiceSettings.enabled}
              onChange={toggleVoiceEnabled}
            />
            <label htmlFor="voice-enabled"></label>
            </div>
          </div>
        
        <div className="voice-setting">
          <label htmlFor="auto-play">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-gray-600 dark:text-gray-400"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span className="text-gray-700 dark:text-gray-300">Auto-play responses</span>
          </label>
          <div className="toggle-switch">
            <input
              id="auto-play"
              type="checkbox"
              checked={voiceSettings.autoPlayResponses}
              onChange={toggleAutoPlayResponses}
              disabled={!voiceSettings.enabled}
            />
            <label htmlFor="auto-play"></label>
        </div>
      </div>
      </div>
      
      <style>
        {`
        /* Existing styles... */
        
        .chat-input-container {
          display: flex;
          align-items: center;
          padding: 10px;
          border-top: 1px solid #e0e0e0;
          background-color: #fff;
        }
        
        .chat-input-container input {
          flex: 1;
          padding: 10px 15px;
          border: 1px solid #ddd;
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        
        .chat-input-container input:focus {
          border-color: #007bff;
        }
        
        .chat-input-container button {
          background: #007bff;
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          margin-left: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }
        
        .chat-input-container button:hover {
          background: #0069d9;
        }
        
        .chat-input-container button:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }
        
        .loading-spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Voice settings styles */
        .voice-settings-panel {
          padding: 10px 15px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .voice-setting {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14px;
        }
        
        .voice-setting label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 20px;
        }
        
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .toggle-switch label {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 34px;
        }
        
        .toggle-switch label:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        
        .toggle-switch input:checked + label {
          background-color: #000;
        }
        
        .toggle-switch input:checked + label:before {
          transform: translateX(20px);
        }
        
        .toggle-switch input:disabled + label {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .speaking-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #000;
          font-size: 14px;
          font-weight: 500;
          padding: 5px 10px;
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        
        .speaking-waves {
          display: flex;
          align-items: center;
          height: 20px;
        }
        
        .speaking-waves .wave {
          width: 2px;
          height: 10px;
          margin: 0 1px;
          background-color: #000;
          animation: wave 1s infinite ease-in-out;
        }
        
        .speaking-waves .wave:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .speaking-waves .wave:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes wave {
          0%, 100% {
            height: 5px;
          }
          50% {
            height: 15px;
          }
        }
        
        .dark .speaking-indicator {
          color: #fff;
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .dark .speaking-waves .wave {
          background-color: #fff;
        }
        `}
      </style>
    </div>
  )
}

export default Chat;