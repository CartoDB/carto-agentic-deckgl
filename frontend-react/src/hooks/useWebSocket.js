import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const messageBufferRef = useRef(new Map());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
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

      wsRef.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        attemptReconnect();
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
    }
  }, [url, onMessage]);

  const handleStreamChunk = useCallback((data) => {
    const buffer = messageBufferRef.current;
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
  }, [onMessage]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => connect(), delay);
    }
  }, [connect]);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, send };
};
