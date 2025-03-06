import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import PrivyWalletCreator from './PrivyWalletCreator'

const Home = () => {
  const navigate = useNavigate()
  const [showPrivyWalletCreator, setShowPrivyWalletCreator] = useState(false)

  const handleShowWalletCreator = () => {
    setShowPrivyWalletCreator(true)
  }

  const handleGoToChat = () => {
    navigate('/agent/chat')
  }

  const handleGoToTwilioCalls = () => {
    navigate('/twilio/calls')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in">
          Welcome to SonicLine
        </h1>
        <p className="text-xl md:text-2xl mb-10 text-indigo-200 max-w-2xl mx-auto">
          Experience the power of AI-driven conversations with instant wallet creation.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          <button
            onClick={handleGoToChat}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-lg font-medium transition-colors shadow-lg"
          >
            Start Chatting
          </button>
          <button
            onClick={handleShowWalletCreator}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-lg font-medium transition-colors shadow-lg"
          >
            Create Wallet
          </button>
          <button
            onClick={handleGoToTwilioCalls}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-lg font-medium transition-colors shadow-lg"
          >
            Twilio Calls
          </button>
        </div>
        <div className="bg-indigo-800 bg-opacity-40 p-4 rounded-lg max-w-2xl mx-auto">
          <p className="text-md text-indigo-200">
            <span className="font-bold">Instant Wallet Creation:</span> Simply type "create a wallet for me" in the chat and get your wallet instantly - no login required!
          </p>
        </div>
        <div className="bg-indigo-800 bg-opacity-40 p-4 rounded-lg max-w-2xl mx-auto mt-4">
          <p className="text-md text-indigo-200">
            <span className="font-bold">Voice Interaction:</span> Call +14149287603 from your phone to interact with SonicLine using voice!
          </p>
        </div>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  )
}

export default Home