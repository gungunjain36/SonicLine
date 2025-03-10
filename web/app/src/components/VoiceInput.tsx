import React, { useState, useEffect, useRef } from 'react';
import { speechToText } from '../utils/elevenLabsService';

interface VoiceInputProps {
  onInterimResult?: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onInterimResult, 
  onFinalResult, 
  onError,
  disabled = false 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    // Initialize speech recognition
    recognitionRef.current = speechToText(
      // Interim results callback
      (text) => {
        setInterimText(text);
        if (onInterimResult) onInterimResult(text);
      },
      // Final result callback
      (text) => {
        if (text.trim()) {
          onFinalResult(text.trim());
          setIsListening(false);
        }
        setInterimText('');
      },
      // Error callback
      (errorMessage) => {
        setError(errorMessage);
        setIsListening(false);
        if (onError) onError(errorMessage);
      }
    );

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping speech recognition:', e);
        }
      }
    };
  }, [onInterimResult, onFinalResult, onError]);

  const toggleListening = () => {
    if (disabled) return;
    
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setInterimText('');
    } else {
      setError(null);
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      setIsListening(true);
    }
  };

  return (
    <div className="voice-input">
      <button
        onClick={toggleListening}
        className={`voice-button ${isListening ? 'listening' : ''} ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
        title={isListening ? 'Stop listening' : 'Start listening'}
      >
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
          {isListening ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </>
          ) : (
            <>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </>
          )}
        </svg>
      </button>
      
      {isListening && (
        <div className="listening-indicator">
          <div className="pulse-ring"></div>
          {interimText && <div className="interim-text">{interimText}</div>}
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      <style jsx>{`
        .voice-input {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .voice-button {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: all 0.2s ease;
        }
        
        .voice-button:hover {
          background: rgba(0, 0, 0, 0.05);
          color: #333;
        }
        
        .voice-button.listening {
          color: #f44336;
          background: rgba(244, 67, 54, 0.1);
        }
        
        .voice-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .listening-indicator {
          position: absolute;
          top: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10;
        }
        
        .pulse-ring {
          border: 3px solid #f44336;
          border-radius: 50%;
          height: 40px;
          width: 40px;
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        
        .interim-text {
          margin-top: 8px;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .error-message {
          color: #f44336;
          font-size: 12px;
          margin-top: 4px;
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceInput; 