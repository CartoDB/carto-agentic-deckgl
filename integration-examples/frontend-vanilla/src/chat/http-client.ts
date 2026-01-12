import type {
  ChatClient,
  ChatMessage,
  MessageHandler,
  ConnectionChangeHandler,
  ServerMessage
} from './types';

/**
 * HTTP Client for AI Chat API
 * Uses fetch streaming to handle chunked text responses via NDJSON
 */
export class HttpClient implements ChatClient {
  private baseUrl: string;
  private onMessage: MessageHandler;
  private onConnectionChange: ConnectionChangeHandler;
  private sessionId: string;
  private isConnected: boolean = false;
  private connectionVerified: boolean = false;
  private messageBuffer: Map<string, string> = new Map(); // Accumulate stream chunks

  constructor(
    baseUrl: string,
    onMessage: MessageHandler,
    onConnectionChange: ConnectionChangeHandler
  ) {
    this.baseUrl = baseUrl;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate a unique session ID for conversation history
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect - verify server is reachable before signaling ready
   */
  async connect(): Promise<void> {
    console.log('[HttpClient] Checking server availability...');
    this.isConnected = false;
    this.connectionVerified = false;

    try {
      // Try a HEAD request or OPTIONS to check server availability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.baseUrl, {
        method: 'OPTIONS',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && (response.ok || response.status === 204 || response.status === 405)) {
        // Server is reachable (405 = method not allowed, but server responded)
        console.log('[HttpClient] Server is reachable');
        this.isConnected = true;
        this.connectionVerified = true;
        this.onConnectionChange(true);
      } else {
        console.warn('[HttpClient] Server not reachable, will retry on first message');
        // Don't mark as connected yet, but allow sending
        this.isConnected = true;
        this.onConnectionChange(false);
      }
    } catch (error) {
      console.warn('[HttpClient] Connection check failed:', error);
      // Allow operation but show as disconnected
      this.isConnected = true;
      this.onConnectionChange(false);
    }
  }

  /**
   * Send a chat message and stream the response
   */
  async send(message: ChatMessage): Promise<void> {
    if (!this.isConnected) {
      console.error('[HttpClient] Not connected');
      return;
    }

    const content = message.content;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: content,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      // Mark as connected now that we've successfully communicated
      if (!this.connectionVerified) {
        this.connectionVerified = true;
        this.onConnectionChange(true);
      }

      // Stream the response
      await this.streamResponse(response);
    } catch (error) {
      console.error('[HttpClient] Error:', error);

      // If we had a connection error, mark as disconnected
      if (
        error instanceof TypeError ||
        (error instanceof Error && error.message.includes('Failed to fetch'))
      ) {
        this.connectionVerified = false;
        this.onConnectionChange(false);
      }

      this.onMessage({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error',
        code: 'HTTP_ERROR'
      });
    }
  }

  /**
   * Stream response chunks using ReadableStream
   * Parses newline-delimited JSON messages from the server
   */
  private async streamResponse(response: Response): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in buffer
          if (buffer.trim()) {
            this.processJsonLine(buffer.trim());
          }
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete JSON lines (separated by \n)
        const lines = buffer.split('\n');

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        // Process each complete line
        for (const line of lines) {
          if (line.trim()) {
            this.processJsonLine(line.trim());
          }
        }
      }
    } catch (error) {
      console.error('[HttpClient] Stream error:', error);
      this.onMessage({
        type: 'error',
        content: 'Stream interrupted',
        code: 'STREAM_ERROR'
      });
    }
  }

  /**
   * Parse and process a single JSON line
   * Handles both plain JSON and SSE format (data: {...})
   * Accumulates stream_chunk deltas into full content
   */
  private processJsonLine(line: string): void {
    // Skip empty lines and SSE comments
    if (!line || line.startsWith(':')) {
      return;
    }

    // Handle SSE format: strip "data: " prefix
    let jsonStr = line;
    if (line.startsWith('data: ')) {
      jsonStr = line.slice(6); // Remove "data: " prefix
    } else if (line.startsWith('data:')) {
      jsonStr = line.slice(5); // Remove "data:" prefix (no space)
    }

    // Skip SSE control messages
    if (jsonStr === '[DONE]') {
      console.log('[HttpClient] Stream complete');
      return;
    }

    try {
      const message = JSON.parse(jsonStr) as ServerMessage;

      // Accumulate stream_chunk deltas
      if (message.type === 'stream_chunk') {
        const chunk = message as {
          type: 'stream_chunk';
          messageId: string;
          content: string;
          isComplete: boolean;
        };

        // Initialize buffer for new message ID
        if (!this.messageBuffer.has(chunk.messageId)) {
          this.messageBuffer.set(chunk.messageId, '');
        }

        // Accumulate content
        const accumulated =
          (this.messageBuffer.get(chunk.messageId) || '') + (chunk.content || '');
        this.messageBuffer.set(chunk.messageId, accumulated);

        console.log('[HttpClient] Stream chunk accumulated:', {
          messageId: chunk.messageId,
          delta: chunk.content,
          accumulated: accumulated.substring(0, 50) + (accumulated.length > 50 ? '...' : ''),
          isComplete: chunk.isComplete
        });

        // Send accumulated content to handler
        this.onMessage({
          type: 'stream_chunk',
          messageId: chunk.messageId,
          content: accumulated,
          isComplete: chunk.isComplete
        });

        // Clean up buffer when message is complete
        if (chunk.isComplete) {
          this.messageBuffer.delete(chunk.messageId);
        }
      } else {
        // Pass through other message types unchanged
        console.log('[HttpClient] Message:', message.type, message);
        this.onMessage(message);
      }
    } catch (error) {
      console.error('[HttpClient] Failed to parse JSON:', jsonStr, error);
    }
  }

  /**
   * Disconnect - for compatibility with WebSocket interface
   */
  disconnect(): void {
    console.log('[HttpClient] Disconnected');
    this.isConnected = false;
    this.onConnectionChange(false);
  }

  /**
   * Reset session (start new conversation)
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    console.log('[HttpClient] New session:', this.sessionId);
  }
}
