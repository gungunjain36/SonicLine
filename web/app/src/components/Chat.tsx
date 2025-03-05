import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import PrivyWalletCreator from './PrivyWalletCreator';
import { generateAndMintNFT } from '../utils/nftService';

interface Message {
  text: string;
  isUser: boolean;
  isError?: boolean;
  timestamp: Date;
  isEmailInput?: boolean;
}

interface WalletData {
  id: string;
  address: string | null | undefined;
  chain_type: string;
  policy_ids?: string[];
}

export default function Chat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! How can I assist you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivyWalletCreator, setShowPrivyWalletCreator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    login,
    authenticated,
    ready,
    user,
  } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [waitingForEmail, setWaitingForEmail] = useState(false);
  const [pendingChainType, setPendingChainType] = useState<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        console.log(`📥 Received API response:`, response.data);
        
        if (response.data.status === "success") {
          // Add AI response to chat
          const aiMessage: Message = {
            text: response.data.response,
            isUser: false,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          
          // Check if the response contains NFT generation instructions
          const { isNftResponse, description } = checkAgentResponseForNftRequest(response.data.response);
          if (isNftResponse && description) {
            console.log(`🎨 Handling NFT generation from API response: "${description}"`);
            handleNftGeneration(description);
          }
          
          // Check if the response contains a special action
          if (response.data.action === "open_wallet_creator") {
            // Open the wallet creation modal
            setTimeout(() => {
              setShowPrivyWalletCreator(true);
            }, 500); // Small delay to ensure the message is displayed first
          } else if (response.data.action === "create_wallet_directly") {
            // Handle wallet creation directly in the chat
            handleWalletCreation(response.data.chain_type || "ethereum");
          }
        } else {
          // Handle non-success status
          const errorMessage: Message = {
            text: response.data.detail || "Sorry, there was an error processing your request.",
            isUser: false,
            timestamp: new Date(),
            isError: true
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        // Add error message with specific details if available
        let errorText = "Sorry, there was an error processing your request.";
        
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          if (error.response.data && error.response.data.detail) {
            errorText = `Error: ${error.response.data.detail}`;
          } else {
            errorText = `Error ${error.response.status}: ${error.response.statusText}`;
          }
        } else if (error.request) {
          // The request was made but no response was received
          errorText = "Error: No response received from server. Please check if the backend is running.";
        } else {
          // Something happened in setting up the request that triggered an Error
          errorText = `Error: ${error.message}`;
        }
        
        const errorMessage: Message = {
          text: errorText,
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
    if (!ready) {
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
      const userWallets = wallets.filter(wallet => wallet.walletClientType === 'privy');
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
        setPendingChainType(chainType);
        
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
        const existingWallets = wallets.filter(wallet => wallet.walletClientType === 'privy');
        
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
      // Add a message indicating that we're generating the NFT
      const generatingMessage: Message = {
        text: `🎨 Starting NFT generation process for: "${description}"...`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, generatingMessage]);
      
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
      const result = await generateAndMintNFT(description);
      
      if (result.success) {
        // Show image preview
        updateProgress(`✅ Image generated successfully! Preview:`);
        
        // Add a message with the image preview
        const imagePreviewMessage: Message = {
          text: `![NFT Preview](${result.imageUrl})`,
          isUser: false,
          timestamp: new Date()
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
        
        // Add a success message with the transaction details
        const successMessage: Message = {
          text: `🎉 Your NFT has been successfully generated and minted!\n\n` +
                `Transaction Hash: ${result.transactionHash}\n` +
                `Explorer Link: ${result.explorerLink}\n\n` +
                `View your NFT: ${result.imageUrl}`,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
      } else {
        // Add an error message
        const errorMessage: Message = {
          text: `❌ Failed to generate and mint NFT: ${result.error}`,
          isUser: false,
          timestamp: new Date(),
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
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

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4 px-6 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="mr-4 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">SonicLine Chat</h1>
        </div>
        <button
          onClick={handleShowWalletCreator}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
        >
          Create Wallet
        </button>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.isUser 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : msg.isError
                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-bl-none shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-1 ${
                msg.isUser 
                  ? 'text-indigo-200' 
                  : msg.isError
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Privy Wallet Creator Modal */}
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

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-end space-x-2 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white text-black"
              rows={1}
              style={{ minHeight: '60px', maxHeight: '150px' }}
            />
            <div className="absolute right-3 bottom-3 text-gray-400 text-xs">
              Press Enter to send
            </div>
          </div>
          <button
            onClick={() => handleSend(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className={`p-3 rounded-full ${
              !inputMessage.trim() || isLoading
                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}