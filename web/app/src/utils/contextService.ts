import { Message, PromisedAction, ChatContext } from '../types';

// Define the context service class
class ContextService {
  private context: ChatContext = {
    previousMessages: [],
    relevantFacts: [],
    userPreferences: {},
    sessionId: 'default'
  };
  
  private promisedActions: PromisedAction[] = [];
  private actionDetectors: Map<string, (text: string) => PromisedAction | null> = new Map();
  
  constructor() {
    // Register default action detectors
    this.registerActionDetector('create-wallet', this.detectWalletCreation);
    this.registerActionDetector('mint-nft', this.detectNftGeneration);
    this.registerActionDetector('swap-sonic', this.detectTokenSwap);
    this.registerActionDetector('get-token-price', this.detectTokenPrice);
    this.registerActionDetector('get-transaction-history', this.detectTransactionHistory);
  }
  
  // Initialize context with session ID
  public initContext(sessionId: string): void {
    this.context = {
      ...this.context,
      sessionId,
      previousMessages: [],
      relevantFacts: []
    };
  }
  
  // Add a message to the context
  public addMessage(message: Message): void {
    this.context.previousMessages.push(message);
    
    // Limit context size to prevent it from growing too large
    if (this.context.previousMessages.length > 20) {
      this.context.previousMessages = this.context.previousMessages.slice(-20);
    }
    
    // If it's an assistant message, analyze it for promised actions
    if (!message.isUser) {
      this.detectPromisedActions(message.text, this.context.previousMessages.length - 1);
    }
  }
  
  // Add a relevant fact to the context
  public addRelevantFact(fact: string): void {
    if (!this.context.relevantFacts.includes(fact)) {
      this.context.relevantFacts.push(fact);
    }
    
    // Limit facts to prevent context from growing too large
    if (this.context.relevantFacts.length > 10) {
      this.context.relevantFacts = this.context.relevantFacts.slice(-10);
    }
  }
  
  // Set user preference
  public setUserPreference(key: string, value: any): void {
    this.context.userPreferences[key] = value;
  }
  
  // Get the current context
  public getContext(): ChatContext {
    return this.context;
  }
  
  // Get promised actions
  public getPromisedActions(): PromisedAction[] {
    return this.promisedActions;
  }
  
  // Clear promised actions
  public clearPromisedActions(): void {
    this.promisedActions = [];
  }
  
  // Add a promised action
  public addPromisedAction(action: PromisedAction): void {
    // Check if action already exists
    const existingIndex = this.promisedActions.findIndex(a => 
      a.type === action.type && 
      JSON.stringify(a.parameters) === JSON.stringify(action.parameters)
    );
    
    if (existingIndex === -1) {
      // Add new action
      this.promisedActions.push(action);
    } else {
      // Update existing action if new one has higher probability
      if (action.probability > this.promisedActions[existingIndex].probability) {
        this.promisedActions[existingIndex] = action;
      }
    }
    
    // Clean up old promised actions (keep only the last 5)
    if (this.promisedActions.length > 5) {
      this.promisedActions = this.promisedActions
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);
    }
  }
  
  // Register a custom action detector
  public registerActionDetector(
    actionType: string, 
    detector: (text: string) => PromisedAction | null
  ): void {
    this.actionDetectors.set(actionType, detector);
  }
  
  // Detect promised actions in a message
  private detectPromisedActions(text: string, messageIndex: number): void {
    const lowerText = text.toLowerCase();
    
    // Check each registered detector
    this.actionDetectors.forEach((detector, actionType) => {
      const result = detector(text);
      if (result) {
        // Add to promised actions if not already present
        const existingIndex = this.promisedActions.findIndex(a => 
          a.type === result.type && 
          JSON.stringify(a.parameters) === JSON.stringify(result.parameters)
        );
        
        if (existingIndex === -1) {
          this.promisedActions.push({
            ...result,
            detectedIn: {
              messageIndex,
              confidence: result.probability
            }
          });
        } else {
          // Update existing action with higher confidence if applicable
          if (result.probability > this.promisedActions[existingIndex].probability) {
            this.promisedActions[existingIndex] = {
              ...result,
              detectedIn: {
                messageIndex,
                confidence: result.probability
              }
            };
          }
        }
      }
    });
    
    // Clean up old promised actions (keep only the last 5)
    if (this.promisedActions.length > 5) {
      this.promisedActions = this.promisedActions
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);
    }
  }
  
  // Detector for wallet creation promises
  private detectWalletCreation(text: string): PromisedAction | null {
    const lowerText = text.toLowerCase();
    
    // Check for wallet creation keywords
    const hasWalletKeyword = 
      lowerText.includes('create a wallet') || 
      lowerText.includes('create wallet') || 
      lowerText.includes('set up a wallet') ||
      lowerText.includes('setup wallet') ||
      lowerText.includes('make a wallet') ||
      lowerText.includes('generate a wallet');
    
    // Check for promise indicators
    const hasPromiseIndicator = 
      lowerText.includes('for you') || 
      lowerText.includes('right away') ||
      lowerText.includes('right now') ||
      lowerText.includes('immediately') ||
      lowerText.includes('let me') ||
      lowerText.includes('i\'ll') ||
      lowerText.includes('i will');
    
    if (hasWalletKeyword && hasPromiseIndicator) {
      // Determine wallet type
      let walletType = 'ethereum'; // Default
      if (lowerText.includes('cardano')) {
        walletType = 'cardano';
      }
      
      // Calculate probability based on keyword strength
      let probability = 0.7; // Base probability
      
      // Increase probability for stronger indicators
      if (lowerText.includes('i will create a wallet for you')) probability = 0.95;
      else if (lowerText.includes('i\'ll create a wallet')) probability = 0.9;
      else if (lowerText.includes('let me create a wallet')) probability = 0.85;
      
      return {
        type: 'create-wallet',
        probability,
        parameters: { walletType },
        detectedIn: {
          messageIndex: 0,
          confidence: probability
        }
      };
    }
    
    return null;
  }
  
  // Detector for NFT generation promises
  private detectNftGeneration(text: string): PromisedAction | null {
    const lowerText = text.toLowerCase();
    
    // Check for NFT generation keywords
    const hasNftKeyword = 
      lowerText.includes('mint an nft') || 
      lowerText.includes('create an nft') || 
      lowerText.includes('generate an nft') ||
      lowerText.includes('make an nft') ||
      lowerText.includes('mint a nft') ||
      lowerText.includes('create a nft') ||
      lowerText.includes('generate a nft') ||
      lowerText.includes('make a nft');
    
    // Check for promise indicators
    const hasPromiseIndicator = 
      lowerText.includes('for you') || 
      lowerText.includes('right away') ||
      lowerText.includes('right now') ||
      lowerText.includes('immediately') ||
      lowerText.includes('let me') ||
      lowerText.includes('i\'ll') ||
      lowerText.includes('i will');
    
    if (hasNftKeyword && hasPromiseIndicator) {
      // Extract description if available
      let description = "Abstract digital art";
      const descriptionMatch = 
        text.match(/with (?:the description|description|prompt) ["'](.+?)["']/i) || 
        text.match(/of ["'](.+?)["']/i) ||
        text.match(/showing ["'](.+?)["']/i) ||
        text.match(/depicting ["'](.+?)["']/i) ||
        text.match(/based on ["'](.+?)["']/i);
      
      if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1];
      }
      
      // Calculate probability based on keyword strength
      let probability = 0.7; // Base probability
      
      // Increase probability for stronger indicators
      if (lowerText.includes('i will create an nft for you')) probability = 0.95;
      else if (lowerText.includes('i\'ll generate an nft')) probability = 0.9;
      else if (lowerText.includes('let me mint an nft')) probability = 0.85;
      
      return {
        type: 'mint-nft',
        probability,
        parameters: { description },
        detectedIn: {
          messageIndex: 0,
          confidence: probability
        }
      };
    }
    
    return null;
  }
  
  // Detector for token swap promises
  private detectTokenSwap(text: string): PromisedAction | null {
    const lowerText = text.toLowerCase();
    
    // Check for swap keywords
    const hasSwapKeyword = 
      lowerText.includes('swap tokens') || 
      lowerText.includes('exchange tokens') || 
      lowerText.includes('perform a swap') ||
      lowerText.includes('swap your tokens') ||
      lowerText.includes('exchange your tokens') ||
      lowerText.includes('convert tokens') ||
      lowerText.includes('convert your tokens');
    
    // Check for promise indicators
    const hasPromiseIndicator = 
      lowerText.includes('for you') || 
      lowerText.includes('right away') ||
      lowerText.includes('right now') ||
      lowerText.includes('immediately') ||
      lowerText.includes('let me') ||
      lowerText.includes('i\'ll') ||
      lowerText.includes('i will');
    
    if (hasSwapKeyword && hasPromiseIndicator) {
      // Extract token information if available
      let fromToken = "SONIC";
      let toToken = "ETH";
      
      const fromMatch = text.match(/swap (?:some |your |)([A-Z]+) (?:to|for)/i);
      const toMatch = text.match(/(?:to|for) (?:some |)([A-Z]+)/i);
      
      if (fromMatch && fromMatch[1]) {
        fromToken = fromMatch[1].toUpperCase();
      }
      
      if (toMatch && toMatch[1]) {
        toToken = toMatch[1].toUpperCase();
      }
      
      // Calculate probability based on keyword strength
      let probability = 0.7; // Base probability
      
      // Increase probability for stronger indicators
      if (lowerText.includes('i will swap tokens for you')) probability = 0.95;
      else if (lowerText.includes('i\'ll exchange your tokens')) probability = 0.9;
      else if (lowerText.includes('let me swap your')) probability = 0.85;
      
      return {
        type: 'swap-sonic',
        probability,
        parameters: { fromToken, toToken },
        detectedIn: {
          messageIndex: 0,
          confidence: probability
        }
      };
    }
    
    return null;
  }
  
  // Detector for token price check promises
  private detectTokenPrice(text: string): PromisedAction | null {
    const lowerText = text.toLowerCase();
    
    // Check for price check keywords
    const hasPriceKeyword = 
      lowerText.includes('check the price') || 
      lowerText.includes('get the price') || 
      lowerText.includes('look up the price') ||
      lowerText.includes('find the price') ||
      lowerText.includes('check price') ||
      lowerText.includes('get price');
    
    // Check for promise indicators
    const hasPromiseIndicator = 
      lowerText.includes('for you') || 
      lowerText.includes('right away') ||
      lowerText.includes('right now') ||
      lowerText.includes('immediately') ||
      lowerText.includes('let me') ||
      lowerText.includes('i\'ll') ||
      lowerText.includes('i will');
    
    if (hasPriceKeyword && hasPromiseIndicator) {
      // Extract token if available
      let token = "SONIC";
      const tokenMatch = 
        text.match(/price of (?:the |)([A-Z]+)/i) ||
        text.match(/([A-Z]+) price/i);
      
      if (tokenMatch && tokenMatch[1]) {
        token = tokenMatch[1].toUpperCase();
      }
      
      // Calculate probability based on keyword strength
      let probability = 0.7; // Base probability
      
      // Increase probability for stronger indicators
      if (lowerText.includes('i will check the price for you')) probability = 0.95;
      else if (lowerText.includes('i\'ll get the price')) probability = 0.9;
      else if (lowerText.includes('let me check the price')) probability = 0.85;
      
      return {
        type: 'get-token-price',
        probability,
        parameters: { token },
        detectedIn: {
          messageIndex: 0,
          confidence: probability
        }
      };
    }
    
    return null;
  }
  
  // Detector for transaction history promises
  private detectTransactionHistory(text: string): PromisedAction | null {
    const lowerText = text.toLowerCase();
    
    // Check for transaction history keywords
    const hasHistoryKeyword = 
      lowerText.includes('transaction history') || 
      lowerText.includes('transaction log') || 
      lowerText.includes('transaction record') ||
      lowerText.includes('past transactions') ||
      lowerText.includes('recent transactions');
    
    // Check for promise indicators
    const hasPromiseIndicator = 
      lowerText.includes('for you') || 
      lowerText.includes('right away') ||
      lowerText.includes('right now') ||
      lowerText.includes('immediately') ||
      lowerText.includes('let me') ||
      lowerText.includes('i\'ll') ||
      lowerText.includes('i will');
    
    if (hasHistoryKeyword && hasPromiseIndicator) {
      // Calculate probability based on keyword strength
      let probability = 0.7; // Base probability
      
      // Increase probability for stronger indicators
      if (lowerText.includes('i will get your transaction history')) probability = 0.95;
      else if (lowerText.includes('i\'ll show your transactions')) probability = 0.9;
      else if (lowerText.includes('let me fetch your transaction')) probability = 0.85;
      
      return {
        type: 'get-transaction-history',
        probability,
        parameters: {},
        detectedIn: {
          messageIndex: 0,
          confidence: probability
        }
      };
    }
    
    return null;
  }
}

// Create and export a singleton instance
export const contextService = new ContextService();
export default contextService; 