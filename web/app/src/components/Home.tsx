import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import PrivyWalletCreator from './PrivyWalletCreator'

const Home = () => {
  const navigate = useNavigate()
  const [showPrivyWalletCreator, setShowPrivyWalletCreator] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)

  useEffect(() => {
    // Simulate video loading
    const timer = setTimeout(() => {
      setVideoLoaded(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-0 text-white overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#fcb458] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-[#df561f] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-[#224f81] rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Hero Section - Minimal */}
      <div className="relative z-10 max-w-4xl mx-auto text-center px-6 py-16">
        <h1 className="text-6xl md:text-7xl font-extrabold mb-6 tracking-tight">
          <span className="inline-block text-shadow-lg bg-clip-text text-transparent bg-gradient-to-r from-[#f58435] via-white to-[#224f81] animate-fade-in">SonicLine</span>
        </h1>
        <div className="h-1 w-32 bg-gradient-to-r from-[#f58435] to-[#224f81] mx-auto mb-8 rounded-full"></div>
        <p className="text-xl md:text-2xl mb-10 text-orange-100 max-w-2xl mx-auto font-light leading-relaxed">
          Where <span className="font-semibold text-white">blockchain</span> meets <span className="font-semibold text-white">communication</span>
        </p>
        
        
        <button
          onClick={handleGoToChat}
          className="px-8 py-3 bg-gradient-to-r from-[#f58435] to-[#224f81] rounded-lg text-white font-medium transition-all hover:opacity-90 hover:shadow-lg text-lg"
        >
          Get Started
        </button>
      </div>
      
      {/* Hero Video Background */}
      <div className="relative z-10 w-full max-w-6xl mx-auto mb-20 rounded-xl overflow-hidden shadow-2xl">
        {/* Gradient overlay for better blending with hero background */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black/30 z-10"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/40 z-10"></div>
        <div className={`absolute inset-0 bg-black opacity-30 z-10 transition-opacity duration-1000 ${videoLoaded ? 'opacity-10' : 'opacity-100'}`}></div>
        <video 
          className="w-full h-full object-contain"
          autoPlay 
          loop 
          muted 
          playsInline
          onCanPlay={() => setVideoLoaded(true)}
          src='/hero.mp4'
          style={{ minHeight: "500px" }}
          ref={(el) => {
            if (el) {
              el.playbackRate = 0.5;
            }
          }}
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-city-at-night-11748-large.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      
      {/* Features Section */}
      <div className="relative z-10 w-full bg-[#0c0c0d]/80 backdrop-blur-sm py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Platform Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto">
            {/* AI Chat Card */}
            <div className="border border-[#f58435]/30 bg-[#1a1a1c] rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-[#f58435]/60 hover:shadow-[#f58435]/10 hover:shadow-lg hover:transform hover:scale-105">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#fcb458] to-[#df561f] rounded-full flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">AI Chat</h3>
                </div>
                <p className="text-gray-300 mb-5 text-sm">Interact with our AI assistant to manage your blockchain assets effortlessly.</p>
                <div className="pt-2 border-t border-gray-700/50">
                  <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                    <span>Features</span>
                    <span className="text-[#f58435]">Available now</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <svg className="h-4 w-4 text-[#f58435] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">Natural language queries</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="h-4 w-4 text-[#f58435] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">Voice interaction</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#151516]">
                <button
                  onClick={handleGoToChat}
                  className="w-full py-3 bg-gradient-to-r from-[#f58435] to-[#df561f] hover:from-[#df561f] hover:to-[#f58435] rounded-lg text-white font-medium transition-all shadow-lg hover:shadow-orange-500/30"
                >
                  Start Chatting
                </button>
              </div>
            </div>
            
            {/* Wallet Creation Card */}
            <div className="border border-[#6b606c]/30 bg-[#1a1a1c] rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-[#6b606c]/60 hover:shadow-[#6b606c]/10 hover:shadow-lg hover:transform hover:scale-105">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#df561f] to-[#495e7a] rounded-full flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Wallet Creation</h3>
                </div>
                <p className="text-gray-300 mb-5 text-sm">Create and manage your Sonic blockchain wallet with just a few clicks.</p>
                <div className="pt-2 border-t border-gray-700/50">
                  <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                    <span>Stats</span>
                    <span className="text-[#925d55]">Secure & Fast</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Creation time</span>
                      <span className="text-sm font-medium">~5 seconds</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Security level</span>
                      <span className="text-sm font-medium">Enterprise-grade</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#151516]">
                <button
                  onClick={handleShowWalletCreator}
                  className="w-full py-3 bg-gradient-to-r from-[#925d55] to-[#6b606c] hover:from-[#6b606c] hover:to-[#925d55] rounded-lg text-white font-medium transition-all shadow-lg hover:shadow-purple-500/30"
                >
                  Create Wallet
                </button>
              </div>
            </div>
            
            {/* Voice Calls Card */}
            <div className="border border-[#224f81]/30 bg-[#1a1a1c] rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:border-[#224f81]/60 hover:shadow-[#224f81]/10 hover:shadow-lg hover:transform hover:scale-105">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#495e7a] to-[#163852] rounded-full flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Voice Calls</h3>
                </div>
                <p className="text-gray-300 mb-5 text-sm">Manage your blockchain assets through simple voice commands over the phone.</p>
                <div className="pt-2 border-t border-gray-700/50">
                  <div className="flex justify-between items-center text-sm text-gray-400 mb-4">
                    <span>Performance</span>
                    <span className="text-[#224f81]">Real-time</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Response time</span>
                      <span className="text-sm font-medium">0.87s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Call quality</span>
                      <span className="text-sm font-medium">HD Audio</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#151516]">
                <button
                  onClick={handleGoToTwilioCalls}
                  className="w-full py-3 bg-gradient-to-r from-[#224f81] to-[#163852] hover:from-[#163852] hover:to-[#224f81] rounded-lg text-white font-medium transition-all shadow-lg hover:shadow-blue-500/30"
                >
                  Twilio Calls
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="border border-[#fcb458]/20 bg-[#1a1a1c] p-6 rounded-xl shadow-lg hover:border-[#fcb458]/40 transition-all duration-300 hover:shadow-[#fcb458]/10 hover:shadow-lg">
              <div className="flex items-start">
                <div className="bg-gradient-to-r from-[#fcb458] to-[#f58435] rounded-full p-3 mr-4 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold mb-2">Instant Wallet Creation</h3>
                  <p className="text-gray-300 text-sm">
                    Simply type "create a wallet for me" in the chat and get your wallet instantly - no login required!
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-700/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Average creation time</span>
                      <span className="font-medium">5.2s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border border-[#224f81]/20 bg-[#1a1a1c] p-6 rounded-xl shadow-lg hover:border-[#224f81]/40 transition-all duration-300 hover:shadow-[#224f81]/10 hover:shadow-lg">
              <div className="flex items-start">
                <div className="bg-gradient-to-r from-[#495e7a] to-[#224f81] rounded-full p-3 mr-4 flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold mb-2">Voice Interaction</h3>
                  <p className="text-gray-300 text-sm">
                    Call +14149287603 from your phone to interact with SonicLine using voice commands!
                  </p>
                  <div className="mt-3 pt-3 border-t border-gray-700/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Transactions per day</span>
                      <span className="font-medium">188,208</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Privy Wallet Creator Modal */}
      {showPrivyWalletCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a1a1c] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">Create Your Wallet</h2>
              <button 
                onClick={() => setShowPrivyWalletCreator(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <PrivyWalletCreator />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home