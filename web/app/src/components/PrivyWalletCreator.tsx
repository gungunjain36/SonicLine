import { useState, useEffect } from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import axios from 'axios';

// Get API URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app';

interface WalletData {
  id: string;
  address: string;
  chain_type: string;
  policy_ids?: string[];
}

const PrivyWalletCreator = () => {
  const { login, ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet, status: createWalletStatus } = useCreateWallet();
  const [error, setError] = useState<string | null>(null);
  const [createdWallet, setCreatedWallet] = useState<WalletData | null>(null);
  const [notifyingBackend, setNotifyingBackend] = useState(false);
  const [backendNotified, setBackendNotified] = useState(false);

  useEffect(() => {
    // Check if user is authenticated when component is ready
    if (ready && !authenticated) {
      // User is not logged in, show login prompt
      console.log('User not authenticated');
    }
  }, [ready, authenticated]);

  const handleCreateWallet = async () => {
    setError(null);
    setCreatedWallet(null);
    setBackendNotified(false);
    
    try {
      if (!authenticated) {
        await login();
        return; // Return here as login is asynchronous and will trigger a re-render
      }
      
      // Create a new embedded wallet
      const newWallet = await createWallet();
      console.log('Wallet created:', newWallet);
      
      // Format wallet data
      const walletData: WalletData = {
        id: newWallet.id,
        address: newWallet.address,
        chain_type: 'ethereum', // Privy currently supports Ethereum
      };
      
      setCreatedWallet(walletData);
      
      // Optionally notify backend about the new wallet
      try {
        setNotifyingBackend(true);
        await axios.post(`${API_URL}/agent/action`, {
          connection: 'sonic',
          action: 'register-wallet',
          params: [walletData]
        });
        setBackendNotified(true);
      } catch (backendError) {
        console.error('Failed to notify backend about new wallet:', backendError);
        // We don't set an error here as the wallet was still created successfully
      } finally {
        setNotifyingBackend(false);
      }
      
    } catch (err) {
      console.error('Error creating wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    }
  };

  if (!ready) {
    return (
      <div className="text-center p-4">
        <div className="animate-pulse">Loading Privy...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!authenticated ? (
        <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900 rounded-lg">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            Please log in to create and manage wallets
          </p>
          <button
            onClick={() => login()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Log In with Privy
          </button>
        </div>
      ) : (
        <>
          {/* Show existing wallets */}
          {wallets && wallets.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-white">Your Wallets</h3>
              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div key={wallet.address} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {wallet.walletClientType === 'privy' ? 'Embedded Wallet' : wallet.walletClientType}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 break-all">
                      {wallet.address}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(wallet.address)}
                      className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                    >
                      Copy Address
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new wallet button */}
          <div className="text-center">
            <button
              onClick={handleCreateWallet}
              disabled={createWalletStatus === 'creating'}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createWalletStatus === 'creating' ? 'Creating...' : 'Create New Wallet'}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-200">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Success message */}
          {createdWallet && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-md">
              <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Wallet Created Successfully!</h4>
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <p><span className="font-medium">Address:</span> {createdWallet.address}</p>
                <p><span className="font-medium">Chain:</span> {createdWallet.chain_type}</p>
                <div className="mt-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(createdWallet.address)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    Copy Address
                  </button>
                </div>
              </div>
              {notifyingBackend && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Notifying backend...</p>
              )}
              {backendNotified && (
                <p className="mt-2 text-xs text-green-600 dark:text-green-400">Backend notified successfully</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PrivyWalletCreator; 