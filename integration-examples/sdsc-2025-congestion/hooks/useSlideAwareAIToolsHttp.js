import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createSlideToolExecutors } from '../services/slideToolExecutors';
import { HttpClient } from '../services/httpClient';

/**
 * Parse tool response from HTTP stream
 */
function parseToolResponse(response) {
  if (response.error) {
    return {
      toolName: response.toolName,
      data: null,
      error: response.error,
    };
  }
  return {
    toolName: response.toolName,
    data: response.data,
    error: null,
  };
}

/**
 * useSlideAwareAIToolsHttp - Hook for AI-powered map tools with slide awareness (HTTP version)
 */
export function useSlideAwareAIToolsHttp({
  apiUrl,
  appState,
  slidesConfig,
  demoId,
  onError,
}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loaderState, setLoaderState] = useState(null);

  // Refs
  const httpClientRef = useRef(null);
  const streamingMessageRef = useRef({ id: null, content: '' });
  const messageIdCounter = useRef(0);
  const onErrorRef = useRef(onError);

  onErrorRef.current = onError;

  // Keep appState in a ref to avoid recreating executors on every animation frame
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  // Track if appState has become available (for dependency)
  const hasAppState = Boolean(appState);

  // Tool Executors - use ref to access current appState without dependency
  const executors = useMemo(() => {
    if (!hasAppState) return {};
    // Create executors with a getter for appState to always get current value
    return createSlideToolExecutors({
      appState: {
        get viewState() { return appStateRef.current?.viewState; },
        get currentSlide() { return appStateRef.current?.currentSlide; },
        get filterValue() { return appStateRef.current?.filterValue; },
        get layers() { return appStateRef.current?.layers; },
        get next() { return appStateRef.current?.next; },
        get prev() { return appStateRef.current?.prev; },
        get reset() { return appStateRef.current?.reset; },
        get goToSlide() { return appStateRef.current?.goToSlide; },
        get updateViewState() { return appStateRef.current?.updateViewState; },
        get setFilterValue() { return appStateRef.current?.setFilterValue; },
        get updateLayerStyle() { return appStateRef.current?.updateLayerStyle; },
        get resetLayerStyles() { return appStateRef.current?.resetLayerStyles; },
        get addLayer() { return appStateRef.current?.addLayer; },
        get getLayerOverrides() { return appStateRef.current?.getLayerOverrides; },
      },
      slidesConfig
    });
  }, [slidesConfig, hasAppState]);

  const executorsRef = useRef(executors);
  executorsRef.current = executors;

  // Initial State Generator - use ref to avoid recreation on every animation frame
  const createInitialState = useCallback(() => {
    const currentAppState = appStateRef.current;
    if (!currentAppState) return null;

    return {
      initialViewState: {
        longitude: currentAppState.viewState?.longitude ?? 0,
        latitude: currentAppState.viewState?.latitude ?? 0,
        zoom: currentAppState.viewState?.zoom ?? 12,
        pitch: currentAppState.viewState?.pitch ?? 0,
        bearing: currentAppState.viewState?.bearing ?? 0,
      },
      currentSlide: currentAppState.currentSlide,
      totalSlides: slidesConfig.length,
      slides: slidesConfig.map((s, i) => ({
        index: i,
        name: s.name,
        title: s.title,
        description: s.description,
        layers: s.layers,
        hasFilter: Boolean(s.slider),
        filterConfig: s.legend
          ? {
              min: s.legend.values?.[0],
              max: s.legend.values?.[s.legend.values?.length - 1],
              unit: s.legend.title,
            }
          : undefined,
      })),
      demoId,
      currentFilterValue: currentAppState.filterValue,
    };
  }, [slidesConfig, demoId]);

  // Message Management
  const addMessage = useCallback((msg) => {
    const uniqueId = msg.id || `local_${Date.now()}_${messageIdCounter.current++}`;
    const timestamp = msg.timestamp || Date.now();
    setMessages((prev) => [...prev, { ...msg, id: uniqueId, timestamp }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    streamingMessageRef.current = { id: null, content: '' };
    messageIdCounter.current = 0;
    // Reset session on clear
    if (httpClientRef.current) {
      httpClientRef.current.resetSession();
    }
  }, []);

  // Stream Chunk Handler
  const handleStreamChunk = useCallback((data) => {
    const ref = streamingMessageRef.current;

    if (ref.id !== data.messageId) {
      setLoaderState(null);
    }

    if (data.isComplete && !data.content) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, streaming: false } : msg
        )
      );
      setLoaderState(null);
      return;
    }

    if (ref.id !== data.messageId) {
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
      ref.content += data.content || '';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, content: ref.content, streaming: !data.isComplete }
            : msg
        )
      );
      if (data.isComplete) {
        setLoaderState(null);
      }
    }
  }, []);

  // Tool Call Handler
  const handleToolCall = useCallback(
    (response) => {
      console.log('handleToolCall', response);

      // Show executing loader when tool call arrives
      setLoaderState('executing');

      const currentExecutors = executorsRef.current;

      if (Object.keys(currentExecutors).length === 0) {
        console.warn('Executors not initialized yet');
        if (onErrorRef.current) {
          onErrorRef.current('Tools not ready');
        }
        setLoaderState(null);
        return;
      }

      const { toolName, data, error } = parseToolResponse(response);

      if (error) {
        console.error(`Tool error: ${error.message}`);

        addMessage({
          type: 'action',
          content: `Tool "${toolName}" failed: ${error.code === 'VALIDATION_ERROR' ? 'Invalid parameters sent by AI. Please try rephrasing your request.' : error.message}`,
        });

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
          content: result.message,
        });
      } else {
        const availableTools = Object.keys(currentExecutors).join(', ');
        const errorMsg = `Unknown tool "${toolName}". This tool is not implemented in the frontend. Available tools: ${availableTools}`;
        console.warn(errorMsg);

        addMessage({
          type: 'action',
          content: `The AI tried to use a tool that doesn't exist: "${toolName}". Please try rephrasing your request using available features like: update layer styles, reset visualization, navigate slides, change view, etc.`,
        });

        if (onErrorRef.current) {
          onErrorRef.current(errorMsg);
        }
      }
      setLoaderState(null);
    },
    [addMessage]
  );

  // Tool Result Handler (for backend-executed custom tools)
  const handleToolResult = useCallback(
    (toolResult) => {
      console.log('[Frontend] Tool result received:', toolResult);

      const { toolName, data, message } = toolResult;

      // Format the result for display
      let displayMessage = '';

      if (toolName === 'weather') {
        // Format weather data nicely
        const { location, temperature, condition, humidity } = data;
        displayMessage = `Weather in ${location}: ${temperature}°F, ${condition}, ${humidity}% humidity`;
      } else {
        // Generic formatting for other custom tools
        displayMessage = message || `${toolName} result: ${JSON.stringify(data, null, 2)}`;
      }

      // Add as action message (similar to tool execution)
      addMessage({
        type: 'action',
        content: displayMessage,
      });

      setLoaderState(null);
    },
    [addMessage]
  );

  // Message Handler for HTTP client
  const handleMessage = useCallback(
    (data) => {
      switch (data.type) {
        case 'stream_chunk':
          handleStreamChunk(data);
          break;
        case 'tool_call':
          handleToolCall(data);
          break;
        case 'tool_result':
          handleToolResult(data);
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
    [handleStreamChunk, handleToolCall, handleToolResult]
  );

  // Connection state handler
  const handleConnectionChange = useCallback((connected) => {
    setIsConnected(connected);
  }, []);

  // HTTP Client Setup
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

  // Send Message
  const sendMessage = useCallback(
    (content) => {
      if (!httpClientRef.current || !httpClientRef.current.isConnected) {
        console.warn('HTTP client not ready');
        return false;
      }

      const initialState = createInitialState();

      httpClientRef.current.send({
        content,
        initialState,
      });

      addMessage({ type: 'user', content });
      streamingMessageRef.current = { id: null, content: '' };
      setLoaderState('thinking');

      return true;
    },
    [addMessage, createInitialState]
  );

  const isLoading = loaderState === 'thinking' || loaderState === 'executing';

  return {
    isConnected,
    messages,
    loaderState,
    isLoading,
    sendMessage,
    clearMessages,
    executors,
    createInitialState,
  };
}
