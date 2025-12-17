// frontend/src/chat/http-client.js
/**
 * HTTP Client for AI Chat API
 * Uses fetch streaming to handle chunked text responses
 */
export class HttpClient {
  constructor(baseUrl, onMessage, onConnectionChange) {
    this.baseUrl = baseUrl;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.sessionId = this.generateSessionId();
    this.isConnected = false;
    this.currentMessageId = null;
  }

  /**
   * Generate a unique session ID for conversation history
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Connect - for compatibility with WebSocket interface
   * HTTP doesn't need persistent connection, but we signal ready state
   */
  connect() {
    console.log('[HttpClient] Ready');
    this.isConnected = true;
    this.onConnectionChange(true);
  }

  /**
   * Send a chat message and stream the response
   */
  async send(message) {
    if (!this.isConnected) {
      console.error('[HttpClient] Not connected');
      return;
    }

    // Extract content from message object
    const content = typeof message === 'string' ? message : message.content;

    // Generate unique message ID for streaming accumulation
    this.currentMessageId = `msg_${Date.now()}`;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Stream the response
      await this.streamResponse(response);

    } catch (error) {
      console.error('[HttpClient] Error:', error);
      this.onMessage({
        type: 'error',
        content: error.message,
        code: 'HTTP_ERROR'
      });
    }
  }

  /**
   * Stream response chunks using ReadableStream
   * Parses newline-delimited JSON messages from the server
   */
  async streamResponse(response) {
    const reader = response.body.getReader();
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
   */
  processJsonLine(line) {
    try {
      const message = JSON.parse(line);
      this.onMessage(message);
    } catch (error) {
      console.error('[HttpClient] Failed to parse JSON:', line, error);
    }
  }

  /**
   * Disconnect - for compatibility with WebSocket interface
   */
  disconnect() {
    console.log('[HttpClient] Disconnected');
    this.isConnected = false;
    this.onConnectionChange(false);
  }

  /**
   * Reset session (start new conversation)
   */
  resetSession() {
    this.sessionId = this.generateSessionId();
    console.log('[HttpClient] New session:', this.sessionId);
  }
}
