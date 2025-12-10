import { useState, useCallback, useEffect } from 'react';
import { MapView } from './components/MapView';
import { ChatUI } from './components/ChatUI';
import { ZoomControls } from './components/ZoomControls';
import { LayerToggle } from './components/LayerToggle';
import { Snackbar } from './components/Snackbar';
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';
import { useMapTools } from './contexts/MapToolsContext';
import { useMessages, useWebSocket, useToolExecutors } from './hooks';
import { WS_URL } from './config/constants';
import './styles/main.css';

/**
 * Main App component
 * Orchestrates map, chat, and tool execution
 * Refactored to use custom hooks for cleaner separation of concerns (SRP)
 */
function App() {
  // State
  const [mapInstances, setMapInstances] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [snackbar, setSnackbar] = useState({ message: null, type: 'error' });
  const [loaderState, setLoaderState] = useState(null);

  // Context for persistent tool state
  const mapTools = useMapTools();

  // Custom hooks
  const { messages, addMessage, handleStreamChunk, resetStreaming } = useMessages();
  const executors = useToolExecutors(mapInstances, mapTools);

  // Register layer in context when map is initialized
  useEffect(() => {
    if (mapInstances) {
      mapTools.registerLayer({
        id: 'points-layer',
        name: 'Airports',
        color: '#c80050',
        visible: true,
      });
    }
  }, [mapInstances, mapTools]);

  // Snackbar helpers
  const showSnackbar = useCallback((message, type = 'error') => {
    setSnackbar({ message, type });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar({ message: null, type: 'error' });
  }, []);

  // Handle streaming chunks with loader state management
  const onStreamChunk = useCallback(
    (data) => {
      handleStreamChunk(
        data,
        // onFirstChunk - hide "thinking" loader
        () => setLoaderState(null),
        // onComplete - show "executing" loader
        () => setLoaderState('executing')
      );
    },
    [handleStreamChunk]
  );

  // Handle tool calls using the executor registry
  const onToolCall = useCallback(
    (response) => {
      console.log('handleToolCall', response);

      if (Object.keys(executors).length === 0) {
        console.warn('Map not initialized yet');
        showSnackbar('Map not ready');
        setLoaderState(null);
        return;
      }

      const { toolName, data, error } = parseToolResponse(response);

      if (error) {
        console.error(`Tool error: ${error.message}`);
        showSnackbar(`Error: ${error.message}`);
        setLoaderState(null);
        return;
      }

      console.log(`Executing tool: ${toolName}`, data);

      const executor = executors[toolName];
      if (executor && data) {
        const result = executor(data);
        addMessage({
          type: 'action',
          content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
        });
      } else {
        console.warn(`Unknown tool: ${toolName}`);
        showSnackbar(`Unknown tool: ${toolName}`);
      }
      setLoaderState(null);
    },
    [executors, addMessage, showSnackbar]
  );

  // WebSocket connection
  const { isConnected, sendMessage } = useWebSocket(WS_URL, {
    onStreamChunk,
    onToolCall,
    onError: showSnackbar,
  });

  // Handle view state changes (for zoom tracking)
  const handleViewStateChange = useCallback((viewState) => {
    setZoomLevel(viewState.zoom);
  }, []);

  // Handle zoom buttons using executors
  const handleZoomIn = useCallback(() => {
    if (executors[TOOL_NAMES.ZOOM_MAP]) {
      const result = executors[TOOL_NAMES.ZOOM_MAP]({ direction: 'in', levels: 1 });
      console.log('Zoom in:', result.message);
    }
  }, [executors]);

  const handleZoomOut = useCallback(() => {
    if (executors[TOOL_NAMES.ZOOM_MAP]) {
      const result = executors[TOOL_NAMES.ZOOM_MAP]({ direction: 'out', levels: 1 });
      console.log('Zoom out:', result.message);
    }
  }, [executors]);

  // Handle layer toggle
  const handleLayerToggle = useCallback(
    (layerId, visible) => {
      if (executors[TOOL_NAMES.TOGGLE_LAYER]) {
        const result = executors[TOOL_NAMES.TOGGLE_LAYER]({ layerName: layerId, visible });
        console.log('Layer toggle:', result.message);
      }
    },
    [executors]
  );

  // Send message handler
  const handleSendMessage = useCallback(
    (content) => {
      if (sendMessage(content)) {
        addMessage({ type: 'user', content });
        resetStreaming();
        setLoaderState('thinking');
      }
    },
    [sendMessage, addMessage, resetStreaming]
  );

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView onMapInit={setMapInstances} onViewStateChange={handleViewStateChange} />
        {/* Layer Toggle - top left */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 100 }}>
          <LayerToggle
            disabled={!isConnected || !mapInstances}
            layers={mapTools.getLayers()}
            onToggle={handleLayerToggle}
          />
        </div>
        {/* Zoom Controls - bottom left */}
        <div style={{ position: 'absolute', bottom: 30, left: 10, zIndex: 100 }}>
          <ZoomControls
            disabled={!isConnected || !mapInstances}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
        </div>
      </div>
      <ChatUI
        isConnected={isConnected}
        onSendMessage={handleSendMessage}
        messages={messages}
        loaderState={loaderState}
      />
      <Snackbar
        message={snackbar.message}
        type={snackbar.type}
        onClose={hideSnackbar}
        duration={5000}
      />
    </div>
  );
}

export default App;
