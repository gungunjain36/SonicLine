import axios from 'axios';

const ELEVEN_LABS_API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY;
const API_BASE_URL = 'https://api.elevenlabs.io/v1';

// Default voice ID - you can change this to any voice you prefer
// Rachel voice - a warm, friendly female voice
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Convert text to speech using Eleven Labs API
 * @param text The text to convert to speech
 * @param voiceId The voice ID to use (optional, defaults to Rachel)
 * @returns A Promise that resolves to an audio blob
 */
export const textToSpeech = async (text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<Blob> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/text-to-speech/${voiceId}`,
      { text },
      {
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_LABS_API_KEY,
        },
        responseType: 'blob',
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error converting text to speech:', error);
    throw error;
  }
};

/**
 * Play audio from a blob
 * @param audioBlob The audio blob to play
 * @returns A Promise that resolves when the audio finishes playing
 */
export const playAudio = (audioBlob: Blob): Promise<void> => {
  return new Promise((resolve) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    
    audio.play();
  });
};

/**
 * Convert speech to text using the browser's Web Speech API
 * @param onInterimResult Callback for interim results
 * @param onFinalResult Callback for final result
 * @param onError Callback for errors
 * @returns An object with start and stop methods
 */
export const speechToText = (
  onInterimResult: (text: string) => void,
  onFinalResult: (text: string) => void,
  onError: (error: string) => void
) => {
  // Check if browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    onError('Speech recognition is not supported in this browser');
    return {
      start: () => {},
      stop: () => {},
    };
  }
  
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    if (interimTranscript) {
      onInterimResult(interimTranscript);
    }
    
    if (finalTranscript) {
      onFinalResult(finalTranscript);
    }
  };
  
  recognition.onerror = (event) => {
    onError(`Error occurred in recognition: ${event.error}`);
  };
  
  return {
    start: () => {
      try {
        recognition.start();
      } catch (error) {
        onError(`Failed to start speech recognition: ${error}`);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    },
  };
};

/**
 * Get available voices from Eleven Labs API
 * @returns A Promise that resolves to an array of voices
 */
export const getVoices = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
    });
    
    return response.data.voices;
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
}; 