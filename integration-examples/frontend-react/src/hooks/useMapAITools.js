import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { parseToolResponse } from '@carto/maps-ai-tools';
import { createExecutors } from '../services/toolExecutors';

/**
 * useMapAITools - Consolidated hook for integrating @carto/maps-ai-tools
 *
 * This hook handles all the integration logic for AI-powered map tools:
 * - WebSocket connection management
 * - Chat message state and streaming
 * - Tool executor creation
 * - Tool call parsing and execution
 * - Loader state management
 *
 * @param {Object} options - Hook options
 * @param {string} options.wsUrl - WebSocket server URL
 * @param {Object|null} options.mapInstances - Map instances { deck, map }
 * @param {Object} options.mapTools - MapTools context from useMapTools()
 * @param {Function} [options.onError] - Optional error callback
 *
 * @returns {Object} Hook return values
 * @returns {boolean} isConnected - Whether WebSocket is connected
 * @returns {Array} messages - Array of chat messages
 * @returns {'thinking'|'executing'|null} loaderState - Current loader state
 * @returns {Function} sendMessage - Send a chat message
 * @returns {Function} clearMessages - Clear all messages
 * @returns {Object} executors - Map of tool name to executor function
 *
 * @example
 * const {
 *   isConnected,
 *   messages,
 *   loaderState,
 *   sendMessage,
 *   executors,
 * } = useMapAITools({
 *   wsUrl: 'ws://localhost:3000/ws',
 *   mapInstances,
 *   mapTools,
 *   onError: (msg) => showSnackbar(msg),
 * });
 */
export function useMapAITools({ wsUrl, mapInstances, mapTools, onError }) {
  // ============================================
  // State
  // ============================================
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loaderState, setLoaderState] = useState(null);

  // Refs
  const wsRef = useRef(null);
  const streamingMessageRef = useRef({ id: null, content: '' });
  const messageIdCounter = useRef(0);
  const onErrorRef = useRef(onError);

  // Keep onError ref updated
  onErrorRef.current = onError;

  // ============================================
  // Tool Executors
  // ============================================
  const executors = useMemo(() => {
    if (!mapInstances) {
      return {};
    }
    const { deck, map } = mapInstances;
    return createExecutors({ deck, map, mapTools });
  }, [mapInstances, mapTools]);

  // Store executors in ref for use in WebSocket handler
  const executorsRef = useRef(executors);
  executorsRef.current = executors;

  // ============================================
  // Initial State for AI Context
  // ============================================

  /**
   * Create initial state object to send with each message
   * This gives the AI context about current layers and view state
   */
  const createInitialState = useCallback(() => {
    if (!mapInstances) return null;

    const { deck } = mapInstances;
    if (!deck) return null;

    // Get current view state
    const viewState = deck.props.initialViewState || deck.viewState || {};
    const initialViewState = {
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      pitch: viewState.pitch || 0,
      bearing: viewState.bearing || 0,
    };

    // Get current layers
    const currentLayers = deck.props.layers || [];
    const layers = currentLayers.map((layer) => ({
      id: layer.id,
      type: layer.constructor.name,
      visible: layer.props.visible !== false,
    }));

    return {
      initialViewState,
      layers,
    };
  }, [mapInstances]);

  // ============================================
  // Message Management
  // ============================================

  /**
   * Add a message to the messages array
   */
  const addMessage = useCallback((msg) => {
    const uniqueId = msg.id || `local_${Date.now()}_${messageIdCounter.current++}`;
    setMessages((prev) => [...prev, { ...msg, id: uniqueId }]);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingMessageRef.current = { id: null, content: '' };
    messageIdCounter.current = 0;
  }, []);

  // ============================================
  // Stream Chunk Handler
  // ============================================

  /**
   * Handle incoming stream chunks from WebSocket
   */
  const handleStreamChunk = useCallback((data) => {
    const ref = streamingMessageRef.current;

    // First chunk of new message - hide "thinking" loader
    if (ref.id !== data.messageId) {
      setLoaderState(null);
    }

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, streaming: false } : msg
        )
      );
      // Show "executing" loader when stream completes
      setLoaderState('executing');
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
      if (data.isComplete) {
        // Show "executing" loader when stream completes
        setLoaderState('executing');
      }
    }
  }, []);

  // ============================================
  // Tool Call Handler
  // ============================================

  /**
   * Handle tool calls from WebSocket
   */
  const handleToolCall = useCallback(
    (response) => {
      console.log('handleToolCall', response);

      const currentExecutors = executorsRef.current;

      if (Object.keys(currentExecutors).length === 0) {
        console.warn('Map not initialized yet');
        if (onErrorRef.current) {
          onErrorRef.current('Map not ready');
        }
        setLoaderState(null);
        return;
      }

      const { toolName, data, error } = parseToolResponse(response);

      if (error) {
        console.error(`Tool error: ${error.message}`);
        if (onErrorRef.current) {
          onErrorRef.current(`Error: ${error.message}`);
        }
        setLoaderState(null);
        return;
      }

      console.log(`Executing tool: ${toolName}`, data);

      const executor = currentExecutors[toolName];
      if (executor && data) {
        const result = executor(data);
        addMessage({
          type: 'action',
          content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
        });
      } else {
        console.warn(`Unknown tool: ${toolName}`);
        if (onErrorRef.current) {
          onErrorRef.current(`Unknown tool: ${toolName}`);
        }
      }
      setLoaderState(null);
    },
    [addMessage]
  );

  // ============================================
  // WebSocket Connection
  // ============================================

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
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
      if (onErrorRef.current) {
        onErrorRef.current('Connection error');
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'stream_chunk':
            handleStreamChunk(data);
            break;
          case 'tool_call':
            handleToolCall(data);
            break;
          case 'error':
            if (onErrorRef.current) {
              onErrorRef.current(data.content);
            }
            break;
          case 'welcome':
            console.log('Server welcome:', data.content);
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
  }, [wsUrl, handleStreamChunk, handleToolCall]);

  // ============================================
  // Send Message
  // ============================================

  /**
   * Send a chat message through WebSocket
   * Handles adding user message, resetting streaming state, and setting loader
   *
   * @param {string} content - Message content
   * @returns {boolean} Whether the message was sent
   */
  const sendMessage = useCallback(
    (content) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('WebSocket not connected');
        return false;
      }

      // Get current map state to provide context to AI
      const initialState = createInitialState();

      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          content,
          timestamp: Date.now(),
          initialState, // Include layer and view state context for AI
        })
      );

      // Add user message
      addMessage({ type: 'user', content });

      // Reset streaming state
      streamingMessageRef.current = { id: null, content: '' };

      // Set loader to thinking
      setLoaderState('thinking');

      return true;
    },
    [addMessage, createInitialState]
  );

  // ============================================
  // Return
  // ============================================

  return {
    isConnected,
    messages,
    loaderState,
    sendMessage,
    clearMessages,
    executors,
  };
}
