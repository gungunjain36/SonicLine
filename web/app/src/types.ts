// Define shared types for the application

export interface Message {
  text: string;
  isUser: boolean;
  is_user?: boolean;
  timestamp: Date;
  isEmailInput?: boolean;
  imageUrl?: string;
  isError?: boolean;
  deviceId?: string;
  sessionId?: string;
}

export interface CommunicationLog {
  message: string;
  isUser: boolean;
  timestamp: Date;
  imageUrl?: string;
}

export interface WalletData {
  id: string;
  address: string | null | undefined;
  chain_type: string;
  policy_ids?: string[];
}

export interface VoiceSettings {
  enabled: boolean;
  autoPlayResponses: boolean;
}

export interface UiMode {
  chatVisible: boolean;
  voiceOnly: boolean;
  debugMode: boolean;
}

export interface ActionUsage {
  name: string;
  description: string;
  timestamp: Date;
  sessionId?: string;
  deviceId?: string;
  metadata?: any;
}

export interface ApiResponse {
  message: string;
  response: string;
  logs: Array<{
    timestamp: string;
    is_user: boolean;
    message: string;
    imageUrl?: string;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    timestamp: string;
    parameters?: any;
  }>;
  action?: {
    type: string;
    description: string;
    [key: string]: any;
  };
}

export interface NftGenerationRequest {
  isRequest: boolean;
  description: string;
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  lastActivity: Date;
  messages: Message[];
  context: string[];
}

export interface ChatContext {
  previousMessages: Message[];
  currentTopic?: string;
  relevantFacts: string[];
  userPreferences: Record<string, any>;
  sessionId: string;
}

export interface ToolUsage {
  name: string;
  description: string;
  timestamp: Date;
  parameters?: any;
  result?: any;
  success: boolean;
  error?: string;
}

export interface PromisedAction {
  type: string;
  probability: number;
  parameters: Record<string, any>;
  detectedIn: {
    messageIndex: number;
    confidence: number;
  };
}

export interface SessionState {
  id: string;
  messages: Message[];
  actions: ActionUsage[];
  tools: ToolUsage[];
  context: ChatContext;
  promisedActions: PromisedAction[];
  activeDevices: string[];
} 