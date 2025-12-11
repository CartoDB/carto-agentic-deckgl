import { useState, useCallback, useEffect } from 'react';
import { MapView } from './components/MapView';
import { ChatUI } from './components/ChatUI';
import { ZoomControls } from './components/ZoomControls';
import { LayerToggle } from './components/LayerToggle';
import { Snackbar } from './components/Snackbar';
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { useMapTools } from './contexts/MapToolsContext';
import { useMapAITools } from './hooks';
import { WS_URL } from './config/constants';
import './styles/main.css';

/**
 * Main App component
 * Orchestrates map, chat, and tool execution using useMapAITools hook
 */
function App() {
  // State
  const [mapInstances, setMapInstances] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.5);
  const [snackbar, setSnackbar] = useState({ message: null, type: 'error' });

  // Context for persistent tool state
  const mapTools = useMapTools();

  // Snackbar helpers
  const showSnackbar = useCallback((message, type = 'error') => {
    setSnackbar({ message, type });
  }, []);

  const hideSnackbar = useCallback(() => {
    setSnackbar({ message: null, type: 'error' });
  }, []);

  // Consolidated hook for AI tools integration
  const {
    isConnected,
    messages,
    loaderState,
    sendMessage,
    executors,
  } = useMapAITools({
    wsUrl: WS_URL,
    mapInstances,
    mapTools,
    onError: showSnackbar,
  });

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
        onSendMessage={sendMessage}
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
