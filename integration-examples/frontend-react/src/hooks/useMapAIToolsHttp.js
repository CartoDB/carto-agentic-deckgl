import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { parseToolResponse } from '@carto/maps-ai-tools';
import { createExecutors } from '../services/toolExecutors';
import { HttpClient } from '../services/httpClient';

/**
 * useMapAIToolsHttp - HTTP version of useMapAITools hook
 *
 * This hook handles all the integration logic for AI-powered map tools using HTTP:
 * - HTTP client connection management
 * - Chat message state and streaming
 * - Tool executor creation
 * - Tool call parsing and execution
 * - Loader state management
 * - Session ID management for conversation continuity
 *
 * @param {Object} options - Hook options
 * @param {string} options.apiUrl - HTTP API URL
 * @param {Object|null} options.mapInstances - Map instances { deck, map }
 * @param {Object} options.mapTools - MapTools context from useMapTools()
 * @param {Function} [options.onError] - Optional error callback
 *
 * @returns {Object} Hook return values
 * @returns {boolean} isConnected - Whether HTTP client is ready
 * @returns {Array} messages - Array of chat messages
 * @returns {'thinking'|'executing'|null} loaderState - Current loader state
 * @returns {Function} sendMessage - Send a chat message
 * @returns {Function} clearMessages - Clear all messages
 * @returns {Object} executors - Map of tool name to executor function
 */
export function useMapAIToolsHttp({ apiUrl, mapInstances, mapTools, onError }) {
  // ============================================
  // State
  // ============================================
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loaderState, setLoaderState] = useState(null);

  // Refs
  const httpClientRef = useRef(null);
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

  // Store executors in ref for use in message handler
  const executorsRef = useRef(executors);
  executorsRef.current = executors;

  // Store mapInstances in ref for createInitialState
  const mapInstancesRef = useRef(mapInstances);
  mapInstancesRef.current = mapInstances;

  // ============================================
  // Initial State Generator
  // ============================================

  /**
   * Create initial state with layer and view information for AI context
   */
  const createInitialState = useCallback(() => {
    const { deck } = mapInstancesRef.current || {};
    if (!deck) return null;

    const viewState = deck.props.initialViewState || {};
    const layers = deck.props.layers || [];

    return {
      initialViewState: {
        longitude: viewState.longitude ?? 0,
        latitude: viewState.latitude ?? 0,
        zoom: viewState.zoom ?? 12,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0,
      },
      layers: layers.map(layer => ({
        id: layer.id,
        type: layer.constructor.name,
        visible: layer.props.visible !== false,
      })),
      availableTools: Object.keys(executorsRef.current),
    };
  }, []);

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
   * Clear all messages and reset session
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingMessageRef.current = { id: null, content: '' };
    messageIdCounter.current = 0;
    // Reset session on clear
    if (httpClientRef.current) {
      httpClientRef.current.resetSession();
    }
  }, []);

  // ============================================
  // Stream Chunk Handler
  // ============================================

  /**
   * Handle incoming stream chunks from HTTP response
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
   * Handle tool calls from HTTP response
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
  // Message Handler
  // ============================================

  /**
   * Handle all message types from HTTP client
   */
  const handleMessage = useCallback(
    (data) => {
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
          setLoaderState(null);
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    },
    [handleStreamChunk, handleToolCall]
  );

  // ============================================
  // Connection State Handler
  // ============================================

  const handleConnectionChange = useCallback((connected) => {
    setIsConnected(connected);
  }, []);

  // ============================================
  // HTTP Client Setup
  // ============================================

  useEffect(() => {
    const client = new HttpClient(apiUrl, handleMessage, handleConnectionChange);
    httpClientRef.current = client;
    client.connect();

    return () => {
      if (httpClientRef.current) {
        httpClientRef.current.disconnect();
      }
    };
  }, [apiUrl, handleMessage, handleConnectionChange]);

  // ============================================
  // Send Message
  // ============================================

  /**
   * Send a chat message through HTTP client
   * Handles adding user message, resetting streaming state, and setting loader
   *
   * @param {string} content - Message content
   * @returns {boolean} Whether the message was sent
   */
  const sendMessage = useCallback(
    (content) => {
      if (!httpClientRef.current || !httpClientRef.current.isConnected) {
        console.warn('HTTP client not ready');
        return false;
      }

      // Get current map state for AI context
      const initialState = createInitialState();
      console.log('[useMapAIToolsHttp] Sending message with initialState:', JSON.stringify(initialState, null, 2));

      httpClientRef.current.send({ content, initialState });

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
