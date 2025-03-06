import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth';
import PrivyWalletCreator from './PrivyWalletCreator';
// @ts-expect-error
import * as nftService from '../utils/nftService';
import VoiceInput from './VoiceInput';
import { textToSpeech, playAudio } from '../utils/elevenLabsService';

interface Message {
  text: string;
  isUser: boolean;
  isError?: boolean;
  timestamp: Date;
  isEmailInput?: boolean;
  imageUrl?: string;
}

interface CommunicationLog {
  timestamp: Date;
  is_user: boolean;
  message: string;
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

export default function Chat() {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
              is_user: log.is_user,
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

  // Add a function to handle voice input
  const handleVoiceInput = (text: string) => {
    if (text.trim()) {
      setInputMessage(text);
      handleSend(text);
    }
  };

  // Modify the handleSend function to include voice feedback
  function handleSend(message: string) {
    if (!message.trim()) return;
    
    // If we're waiting for an email address, handle it differently
    if (waitingForEmail) {
      // Add the user's message (email) to the chat
      const userMessage: Message = {
        text: message,
        isUser: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Process the email
      handleEmailLogin(message);
      return;
    }
    
    // Check if the message is an NFT generation request
    const { isRequest, description } = isNftGenerationRequest(message);
    
    // Special case for "car riding on a horse"
    const isSpecialCase = /nft.*car.*horse/i.test(message) || /car.*riding.*horse/i.test(message);
    
    // Regular message handling
    const userMessage: Message = {
      text: message,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    
    // If it's an NFT generation request, handle it directly
    if (isRequest && description) {
      console.log(`🎨 Handling NFT generation request directly: "${description}"`);
      handleNftGeneration(description);
      return;
    }
    
    // Handle special case
    if (isSpecialCase) {
      console.log(`🎨 Handling special case NFT request: "a car riding on a horse"`);
      handleNftGeneration("a car riding on a horse");
      return;
    }
    
    setIsLoading(true);
    
    // Send to API
    console.log(`📤 Sending message to API: "${message}"`);
    axios.post("http://localhost:8000/agent/chat", { message: message })
      .then((response) => {
        console.log("📥 Received response:", response.data);
        
        if (response.data && response.data.response) {
          const botMessage: Message = {
            text: response.data.response,
            isUser: false,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, botMessage]);
          
          // Check if the response indicates an NFT request
          const { isNftResponse, description } = checkAgentResponseForNftRequest(response.data.response);
          
          if (isNftResponse && description) {
            console.log(`🎨 Detected NFT request in response: "${description}"`);
            handleNftGeneration(description);
          }
          
          // Convert response to speech if voice is enabled
          if (voiceSettings.enabled && voiceSettings.autoPlayResponses) {
            speakText(response.data.response);
          }
        }
      })
      .catch((error) => {
        console.error("Error sending message:", error);
        const errorMessage: Message = {
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isUser: false,
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        handleWalletCreation(chainType);
        
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

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">SonicLine Assistant</h1>
        <div className="flex space-x-2">
          <button
            onClick={toggleConversationHistory}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              showConversationHistory 
                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showConversationHistory ? 'Hide Communication Logs' : 'Show Communication Logs'}
          </button>
          {privyWallets.length > 0 ? (
            <div className="flex items-center space-x-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-2 rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h10v1H5V6zm10 3H5v1h10V9zm0 3H5v1h10v-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm truncate max-w-[150px]">{privyWallets[0].address}</span>
            </div>
          ) : (
            <button
              onClick={handleShowWalletCreator}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
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
        {/* Chat messages */}
        <div className={`flex-1 flex flex-col ${showConversationHistory ? 'w-2/3' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-lg">Start a conversation with SonicLine</p>
                <p className="text-sm mt-2">Ask about crypto, create a wallet, or generate an NFT</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.isUser 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : message.isError
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-bl-none shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      {message.imageUrl && (
                        <div className="mt-2">
                          <img 
                            src={message.imageUrl} 
                            alt="NFT Preview" 
                            className="rounded-md max-w-full h-auto max-h-64 object-contain"
                          />
                        </div>
                      )}
                      <p className={`text-xs mt-1 ${
                        message.isUser 
                          ? 'text-indigo-200' 
                          : message.isError
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 max-w-md">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            {isCreatingWallet ? (
              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="mr-3">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">Creating wallet...</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">{isCreatingWallet ? 'Please wait...' : 'Wallet created successfully!'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-input-container">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={waitingForEmail ? "Enter your email address..." : "Type your message..."}
                  disabled={isLoading || isCreatingWallet}
                  className={waitingForEmail ? "email-input" : ""}
                />
                
                {/* Add voice input button */}
                {voiceSettings.enabled && (
                  <VoiceInput 
                    onSpeechResult={handleVoiceInput} 
                    disabled={isLoading || isCreatingWallet || waitingForEmail}
                  />
                )}
                
                <button 
                  onClick={() => handleSend(inputMessage)} 
                  disabled={isLoading || isCreatingWallet || !inputMessage.trim()}
                >
                  {isLoading ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Communication Logs panel - replace the Conversation History panel */}
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
                      className={`p-3 rounded-lg text-sm ${
                        log.is_user 
                          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 border-l-4 border-indigo-500' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-l-4 border-gray-500'
                      }`}
                    >
                      <div className="font-medium mb-1">
                        {log.is_user ? 'User' : 'SonicLine Assistant'}
                        <span className="text-xs font-normal ml-2 text-gray-500 dark:text-gray-400">
                          {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">{log.message}</div>
                      {log.imageUrl && (
                        <div className="mt-2">
                          <img 
                            src={log.imageUrl} 
                            alt="Image" 
                            className="rounded-md max-w-full h-auto max-h-48 object-contain"
                          />
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
      <div className="voice-settings-panel">
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
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
            Voice features
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
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Auto-play responses
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
        
        {isSpeaking && (
          <div className="speaking-indicator">
            <div className="speaking-waves">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            Speaking...
          </div>
        )}
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
          background-color: #f8f9fa;
          border-top: 1px solid #e0e0e0;
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
          color: #555;
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
          background-color: #2196F3;
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
          color: #2196F3;
          font-size: 14px;
          font-weight: 500;
          padding: 5px 10px;
          background-color: rgba(33, 150, 243, 0.1);
          border-radius: 4px;
        }
        
        .speaking-waves {
          display: flex;
          align-items: center;
          height: 20px;
        }
        
        .speaking-waves span {
          display: inline-block;
          width: 3px;
          height: 100%;
          margin-right: 3px;
          background-color: #2196F3;
          border-radius: 3px;
          animation: wave 1s ease-in-out infinite;
        }
        
        .speaking-waves span:nth-child(2) {
          animation-delay: 0.1s;
        }
        
        .speaking-waves span:nth-child(3) {
          animation-delay: 0.2s;
        }
        
        .speaking-waves span:nth-child(4) {
          animation-delay: 0.3s;
        }
        
        .speaking-waves span:nth-child(5) {
          animation-delay: 0.4s;
        }
        
        @keyframes wave {
          0%, 100% {
            height: 6px;
          }
          50% {
            height: 16px;
          }
        }
        `}
      </style>
    </div>
  )
}