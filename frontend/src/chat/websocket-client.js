// frontend/src/chat/websocket-client.js
export class WebSocketClient {
  constructor(url, onMessage, onConnectionChange) {
    this.url = url;
    this.ws = null;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageBuffer = new Map(); // NEW: Buffer for accumulating streaming messages
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // NEW: Handle different message types
          if (data.type === 'stream_chunk') {
            this.handleStreamChunk(data);
          } else if (data.type === 'tool_call') {
            this.handleToolCall(data);
          } else if (data.type === 'error') {
            this.handleError(data);
          } else {
            // Fallback for old message format
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

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.onConnectionChange(false);
    }
  }

  // NEW: Handle streaming chunks
  handleStreamChunk(data) {
    if (!this.messageBuffer.has(data.messageId)) {
      this.messageBuffer.set(data.messageId, '');
    }

    this.messageBuffer.set(data.messageId, this.messageBuffer.get(data.messageId) + data.content);

    this.onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: this.messageBuffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      this.messageBuffer.delete(data.messageId);
    }
  }

  // NEW: Handle tool calls
  handleToolCall(data) {
    this.onMessage({
      type: 'tool_call',
      tool: data.tool,
      parameters: data.parameters,
      callId: data.callId
    });
  }

  // NEW: Handle errors
  handleError(data) {
    this.onMessage({
      type: 'error',
      content: data.content,
      code: data.code
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
