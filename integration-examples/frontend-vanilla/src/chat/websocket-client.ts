import type {
  ChatClient,
  ClientMessage,
  MessageHandler,
  ConnectionChangeHandler,
  ServerMessage,
  StreamChunkMessage,
  ErrorMessage,
  FrontendToolResultMessage
} from './types';

/**
 * WebSocket Client for AI Chat API
 * Handles persistent connection with auto-reconnect and message streaming
 */
export class WebSocketClient implements ChatClient {
  private url: string;
  private ws: WebSocket | null = null;
  private onMessage: MessageHandler;
  private onConnectionChange: ConnectionChangeHandler;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private messageBuffer: Map<string, string> = new Map();

  constructor(
    url: string,
    onMessage: MessageHandler,
    onConnectionChange: ConnectionChangeHandler
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
  }

  /**
   * Establish WebSocket connection
   */
  connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as ServerMessage;

          // Handle different message types
          if (data.type === 'stream_chunk') {
            this.handleStreamChunk(data);
          } else if (data.type === 'tool_call') {
            this.handleToolCall(data);
          } else if (data.type === 'error') {
            this.handleError(data);
          } else {
            // Pass through other messages directly
            this.onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.onConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error: Event) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.onConnectionChange(false);
    }
  }

  /**
   * Handle streaming chunks - accumulates text and passes full content
   */
  private handleStreamChunk(data: StreamChunkMessage): void {
    if (!this.messageBuffer.has(data.messageId)) {
      this.messageBuffer.set(data.messageId, '');
    }

    const accumulated =
      (this.messageBuffer.get(data.messageId) || '') + data.content;
    this.messageBuffer.set(data.messageId, accumulated);

    this.onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: accumulated,
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      this.messageBuffer.delete(data.messageId);
    }
  }

  /**
   * Handle tool calls - pass through for executor processing
   */
  private handleToolCall(data: ServerMessage): void {
    this.onMessage(data);
  }

  /**
   * Handle errors
   */
  private handleError(data: ErrorMessage): void {
    this.onMessage({
      type: 'error',
      content: data.content,
      code: data.code
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempts),
        10000
      );
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  /**
   * Send a message to the server
   */
  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
    }
  }

  /**
   * Send tool execution result back to the server
   */
  sendToolResult(result: FrontendToolResultMessage): void {
    this.send(result);
  }

  /**
   * Close the WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
