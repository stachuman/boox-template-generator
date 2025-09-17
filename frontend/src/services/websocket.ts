/**
 * WebSocket client for real-time preview updates.
 * 
 * Manages WebSocket connection to the backend for live preview generation.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import { WebSocketMessage } from '@/types';

export type PreviewRequestData = {
  yaml_content: string;
  profile: string;
  page_number?: number;
  scale?: number;
};

export type PreviewResponseData = {
  preview_base64: string;
  page_number: number;
  scale: number;
  size_bytes: number;
};

export type WebSocketEventHandler = {
  onPreviewResponse?: (data: PreviewResponseData) => void;
  onError?: (message: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export class PreviewWebSocketClient {
  private ws: WebSocket | null = null;
  private clientId: string;
  private handlers: WebSocketEventHandler;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(clientId: string, handlers: WebSocketEventHandler) {
    this.clientId = clientId;
    this.handlers = handlers;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsUrl = this.getWebSocketURL();
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handlers.onError?.('Failed to connect to preview service');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  requestPreview(data: PreviewRequestData): void {
    if (!this.isConnected()) {
      this.handlers.onError?.('Not connected to preview service');
      return;
    }

    const message: WebSocketMessage = {
      type: 'preview_request',
      data,
    };

    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send preview request:', error);
      this.handlers.onError?.('Failed to send preview request');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private getWebSocketURL(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || `${protocol}//${host}`;
    return `${wsBaseUrl}/ws/${this.clientId}`;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.handlers.onDisconnect?.();
      
      // Attempt reconnection if not a clean close
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handlers.onError?.('WebSocket connection error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        this.handlers.onError?.('Invalid message from server');
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'preview_response':
        this.handlers.onPreviewResponse?.(message.data as PreviewResponseData);
        break;
      
      case 'error':
        this.handlers.onError?.(message.data.message || 'Unknown server error');
        break;
      
      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting WebSocket reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect();
      }
    }, delay);
  }
}

// Helper function to generate unique client IDs
export const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};