import { ref, onUnmounted } from 'vue';

export function useWebSocket(url, onMessage) {
  const isConnected = ref(false);
  const ws = ref(null);
  const messageBuffer = ref(new Map());
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      ws.value = new WebSocket(url);

      ws.value.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts.value = 0;
        isConnected.value = true;
      };

      ws.value.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

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

  const handleStreamChunk = (data) => {
    const buffer = messageBuffer.value;
    if (!buffer.has(data.messageId)) {
      buffer.set(data.messageId, '');
    }
    buffer.set(data.messageId, buffer.get(data.messageId) + data.content);

    onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: buffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      buffer.delete(data.messageId);
    }
  };

  const attemptReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => connect(), delay);
    }
  };

  const send = (message) => {
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
