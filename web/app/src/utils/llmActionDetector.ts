import { PromisedAction } from '../types';
import axios from 'axios';

/**
 * LLM-based action detector that analyzes messages to determine user intent
 * and detect promised actions from the assistant
 */
class LlmActionDetector {
  private apiUrl: string;
  
  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'https://e52f-2400-4f20-11-c00-31e9-c732-86d7-87c9.ngrok-free.app';
  }
  
  /**
   * Analyze a user message to determine the intended action
   * @param message The user's message
   * @returns Promise resolving to the detected action or null if no action detected
   */
  public async analyzeUserIntent(message: string): Promise<{
    intent: string;
    confidence: number;
    parameters: Record<string, any>;
  } | null> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/analyze-intent`, {
        message
      });
      
      if (response.data && response.data.intent) {
        return {
          intent: response.data.intent,
          confidence: response.data.confidence || 0.5,
          parameters: response.data.parameters || {}
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error analyzing user intent:', error);
      return null;
    }
  }
  
  /**
   * Detect promised actions in an assistant's message
   * @param message The assistant's message
   * @returns Promise resolving to an array of detected promised actions
   */
  public async detectPromisedActions(message: string): Promise<PromisedAction[]> {
    try {
      const response = await axios.post(`${this.apiUrl}/api/detect-promised-actions`, {
        message
      });
      
      if (response.data && response.data.actions && Array.isArray(response.data.actions)) {
        return response.data.actions.map((action: any) => ({
          type: action.type,
          probability: action.confidence || 0.5,
          parameters: action.parameters || {},
          detectedIn: {
            messageIndex: 0,
            confidence: action.confidence || 0.5
          }
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error detecting promised actions:', error);
      return [];
    }
  }
  
  /**
   * Fallback method to detect NFT generation requests when backend is unavailable
   * @param message The user's message
   * @returns Whether the message is requesting NFT generation
   */
  public detectNftRequest(message: string): {
    isRequest: boolean;
    description: string;
    confidence: number;
  } {
    const lowerMessage = message.toLowerCase();
    
    // Check for NFT-related keywords
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
        description,
        confidence: 0.9
      };
    }
    
    return { 
      isRequest: false, 
      description: '',
      confidence: 0
    };
  }
}

// Create and export a singleton instance
export const llmActionDetector = new LlmActionDetector();
export default llmActionDetector; 