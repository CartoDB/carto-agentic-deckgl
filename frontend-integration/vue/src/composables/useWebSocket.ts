import { ref, onUnmounted, type Ref } from 'vue';

export interface WebSocketMessage {
  type: 'chat_message' | 'stream_chunk' | 'tool_call' | 'error' | 'welcome';
  content?: string;
  messageId?: string;
  isComplete?: boolean;
  tool?: string;
  parameters?: Record<string, unknown>;
  timestamp?: number;
}

export interface UseWebSocketReturn {
  isConnected: Ref<boolean>;
  send: (message: Record<string, unknown>) => void;
}

export function useWebSocket(
  url: string,
  onMessage: (data: WebSocketMessage) => void
): UseWebSocketReturn {
  const isConnected = ref(false);
  const ws = ref<WebSocket | null>(null);
  const messageBuffer = ref<Map<string, string>>(new Map());
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;

  const connect = (): void => {
    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts.value = 0;
        isConnected.value = true;
      };

      ws.value.onmessage = (event: MessageEvent) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          if (data.type === 'stream_chunk') {
            handleStreamChunk(data);
          } else {
            onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      ws.value.onclose = () => {
        console.log('[WebSocket] Disconnected');
        isConnected.value = false;
        attemptReconnect();
      };

      ws.value.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      isConnected.value = false;
    }
  };

  const handleStreamChunk = (data: WebSocketMessage): void => {
    const buffer = messageBuffer.value;
    const messageId = data.messageId!;

    if (!buffer.has(messageId)) {
      buffer.set(messageId, '');
    }
    buffer.set(messageId, buffer.get(messageId)! + (data.content || ''));

    onMessage({
      type: 'stream_chunk',
      messageId: messageId,
      content: buffer.get(messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      buffer.delete(messageId);
    }
  };

  const attemptReconnect = (): void => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => connect(), delay);
    }
  };

  const send = (message: Record<string, unknown>): void => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  };

  connect();

  onUnmounted(() => {
    if (ws.value) {
      ws.value.close();
    }
  });

  return { isConnected, send };
}
