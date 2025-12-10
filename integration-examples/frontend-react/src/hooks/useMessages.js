import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for managing chat messages and streaming state
 * Extracts message state management from App.jsx
 */
export function useMessages() {
  const [messages, setMessages] = useState([]);
  const streamingMessageRef = useRef({ id: null, content: '' });
  const messageIdCounter = useRef(0);

  /**
   * Add a message to the messages array
   * @param {Object} msg - Message object with type, content, etc.
   */
  const addMessage = useCallback((msg) => {
    const uniqueId = msg.id || `local_${Date.now()}_${messageIdCounter.current++}`;
    setMessages((prev) => [...prev, { ...msg, id: uniqueId }]);
  }, []);

  /**
   * Handle incoming stream chunks from WebSocket
   * @param {Object} data - Stream chunk data with messageId, content, isComplete
   * @param {Function} onFirstChunk - Callback when first chunk of new message arrives
   * @param {Function} onComplete - Callback when stream completes
   */
  const handleStreamChunk = useCallback((data, onFirstChunk, onComplete) => {
    const ref = streamingMessageRef.current;

    // First chunk of new message
    if (ref.id !== data.messageId) {
      if (onFirstChunk) {
        onFirstChunk();
      }
    }

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, streaming: false } : msg
        )
      );
      if (onComplete) {
        onComplete();
      }
      return;
    }

    if (ref.id !== data.messageId) {
      // New message - add to messages array
      ref.id = data.messageId;
      ref.content = data.content || '';
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          type: 'assistant',
          content: ref.content,
          streaming: true,
        },
      ]);
    } else {
      // Accumulate content from chunks
      ref.content += data.content || '';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: ref.content, streaming: !data.isComplete }
            : msg
        )
      );
      if (data.isComplete && onComplete) {
        onComplete();
      }
    }
  }, []);

  /**
   * Reset streaming state (call before sending new message)
   */
  const resetStreaming = useCallback(() => {
    streamingMessageRef.current = { id: null, content: '' };
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingMessageRef.current = { id: null, content: '' };
    messageIdCounter.current = 0;
  }, []);

  return {
    messages,
    addMessage,
    handleStreamChunk,
    resetStreaming,
    clearMessages,
  };
}
