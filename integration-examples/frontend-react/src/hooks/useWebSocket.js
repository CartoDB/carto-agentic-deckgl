import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for WebSocket connection management
 * Extracts WebSocket logic from App.jsx
 *
 * @param {string} url - WebSocket URL
 * @param {Object} handlers - Event handlers
 * @param {Function} handlers.onStreamChunk - Handler for stream_chunk messages
 * @param {Function} handlers.onToolCall - Handler for tool_call messages
 * @param {Function} handlers.onError - Handler for error messages
 * @param {Function} handlers.onWelcome - Handler for welcome messages
 * @returns {Object} { isConnected, sendMessage, wsRef }
 */
export function useWebSocket(url, handlers) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  // Store handlers in ref to avoid reconnection on handler changes
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (handlersRef.current.onError) {
        handlersRef.current.onError('Connection error');
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const h = handlersRef.current;

        switch (data.type) {
          case 'stream_chunk':
            if (h.onStreamChunk) h.onStreamChunk(data);
            break;
          case 'tool_call':
            if (h.onToolCall) h.onToolCall(data);
            break;
          case 'error':
            if (h.onError) h.onError(data.content);
            break;
          case 'welcome':
            console.log('Server welcome:', data.content);
            if (h.onWelcome) h.onWelcome(data);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [url]);

  /**
   * Send a chat message through WebSocket
   * @param {string} content - Message content
   * @returns {boolean} Whether the message was sent
   */
  const sendMessage = useCallback((content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return false;
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'chat_message',
        content,
        timestamp: Date.now(),
      })
    );

    return true;
  }, []);

  return {
    isConnected,
    sendMessage,
    wsRef,
  };
}
