import { ActionUsage, Message } from '../types';

// Define event types for socket communication
export enum SocketEventType {
  ACTION_USED = 'action_used',
  NEW_MESSAGE = 'new_message',
  VOICE_COMMAND = 'voice_command',
  CONTEXT_UPDATE = 'context_update',
  TOOL_USED = 'tool_used',
  SESSION_JOINED = 'session_joined',
  SESSION_LEFT = 'session_left',
}

// Define the socket service class
class SocketService {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private deviceId: string = this.generateDeviceId();
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 2000; // Start with 2 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;

  // Generate a unique device ID for this client
  private generateDeviceId(): string {
    return 'device_' + Math.random().toString(36).substring(2, 15);
  }

  // Connect to the WebSocket server
  public connect(sessionId: string = 'default'): Promise<boolean> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('Socket already connected');
      return Promise.resolve(true);
    }

    if (this.isConnecting) {
      console.log('Socket connection already in progress');
      return Promise.resolve(false);
    }

    this.isConnecting = true;
    this.sessionId = sessionId;

    return new Promise((resolve) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = apiUrl.replace(/^https?:/, wsProtocol) + '/ws/' + sessionId;
      
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.reconnectTimeout = 2000; // Reset timeout
        
        // Send join event with device ID
        this.sendEvent(SocketEventType.SESSION_JOINED, {
          deviceId: this.deviceId,
          timestamp: new Date().toISOString(),
          sessionId: this.sessionId
        });
        
        resolve(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnecting = false;
        this.socket = null;
        this.attemptReconnect();
        resolve(false);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        resolve(false);
      };
    });
  }

  // Attempt to reconnect to the WebSocket server
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const timeout = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`Attempting to reconnect in ${timeout}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId);
      }
    }, timeout);
  }

  // Handle incoming WebSocket messages
  private handleMessage(data: any): void {
    const { type, payload } = data;
    
    if (!type) {
      console.error('Received message without type:', data);
      return;
    }

    // Notify all listeners for this event type
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in listener for event ${type}:`, error);
        }
      });
    }
  }

  // Send an event to the WebSocket server
  public sendEvent(type: SocketEventType, payload: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send event, socket not connected');
      return false;
    }

    try {
      const message = JSON.stringify({
        type,
        payload: {
          ...payload,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          timestamp: payload.timestamp || new Date().toISOString()
        }
      });
      
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  // Register a listener for a specific event type
  public on(type: SocketEventType, callback: Function): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    
    this.listeners.get(type)?.add(callback);
  }

  // Remove a listener for a specific event type
  public off(type: SocketEventType, callback: Function): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  // Disconnect from the WebSocket server
  public disconnect(): void {
    if (this.socket) {
      // Send leave event
      this.sendEvent(SocketEventType.SESSION_LEFT, {
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      });
      
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // Send action usage event
  public sendActionUsed(action: ActionUsage): void {
    this.sendEvent(SocketEventType.ACTION_USED, action);
  }

  // Send new message event
  public sendNewMessage(message: Message): void {
    this.sendEvent(SocketEventType.NEW_MESSAGE, message);
  }

  // Send tool used event
  public sendToolUsed(tool: string, params: any): void {
    this.sendEvent(SocketEventType.TOOL_USED, {
      tool,
      params,
      timestamp: new Date().toISOString()
    });
  }

  // Send context update event
  public sendContextUpdate(context: any): void {
    this.sendEvent(SocketEventType.CONTEXT_UPDATE, {
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Get the current session ID
  public getSessionId(): string | null {
    return this.sessionId;
  }

  // Get the current device ID
  public getDeviceId(): string {
    return this.deviceId;
  }
}

// Create and export a singleton instance
export const socketService = new SocketService();
export default socketService; 