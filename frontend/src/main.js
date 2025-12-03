// frontend/src/main.js
import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMap, createPointsLayer } from './map/deckgl-map.js';
import { WebSocketClient } from './chat/websocket-client.js';

// Import custom UI components
import { ChatContainer, ZoomControls, LayerToggle, ToolStatus } from './ui/index.js';

// Import from @carto/maps-ai-tools library
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';

// Configuration
const WS_URL = 'ws://localhost:3000/ws';
const GEOJSON_PATH = '/data/airports.geojson';

// Initialize map
const { deck, map } = createMap('map', 'deck-canvas');

// Initialize custom UI components
const chatContainer = new ChatContainer(document.getElementById('chat-ui-container'));
const zoomControls = new ZoomControls(document.getElementById('zoom-ui-container'));
const layerToggle = new LayerToggle(document.getElementById('layer-ui-container'));
const toolStatus = new ToolStatus(document.getElementById('tool-status-container'));

// Layer registry: maps layer names to their IDs (case-insensitive)
const layerRegistry = new Map();

// Helper to find layer ID by name (case-insensitive)
function findLayerIdByName(name) {
  const normalizedName = name.toLowerCase();
  for (const [layerName, layerId] of layerRegistry.entries()) {
    if (layerName.toLowerCase() === normalizedName) {
      return layerId;
    }
  }
  return null;
}

// Define executors for each tool using TOOL_NAMES
const executors = {
  [TOOL_NAMES.FLY_TO]: (params) => {
    const currentView = deck.props.initialViewState || {};
    deck.setProps({
      initialViewState: {
        ...currentView,
        longitude: params.lng,
        latitude: params.lat,
        zoom: params.zoom || 12,
        transitionDuration: 1000,
        transitionInterruption: 1
      }
    });
    // Force redraws for deck.gl
    requestAnimationFrame(() => deck.redraw(true));
    setTimeout(() => deck.redraw(true), 50);
    setTimeout(() => deck.redraw(true), 1100);

    return { success: true, message: `Flying to ${params.lat.toFixed(2)}, ${params.lng.toFixed(2)}` };
  },

  [TOOL_NAMES.ZOOM_MAP]: (params) => {
    const currentView = deck.props.initialViewState || { zoom: 10 };
    const currentZoom = currentView.zoom || 10;
    const levels = params.levels || 1;
    const newZoom = params.direction === 'in'
      ? Math.min(22, currentZoom + levels)
      : Math.max(0, currentZoom - levels);

    deck.setProps({
      initialViewState: {
        ...currentView,
        zoom: newZoom,
        transitionDuration: 500,
        transitionInterruption: 1
      }
    });

    // Force redraws
    requestAnimationFrame(() => deck.redraw(true));
    setTimeout(() => deck.redraw(true), 50);
    setTimeout(() => deck.redraw(true), 600);

    // Update zoom controls display
    zoomControls.setZoomLevel(newZoom);

    return { success: true, message: `Zoomed ${params.direction} to level ${newZoom.toFixed(1)}` };
  },

  [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
    // Find layer ID by name (case-insensitive)
    const layerId = findLayerIdByName(params.layerName);
    if (!layerId) {
      return { success: false, message: `Layer "${params.layerName}" not found` };
    }

    const currentLayers = deck.props.layers || [];
    const updatedLayers = currentLayers.map(layer => {
      if (layer.id === layerId) {
        return layer.clone({ visible: params.visible });
      }
      return layer;
    });

    deck.setProps({ layers: updatedLayers });

    // Force redraw
    requestAnimationFrame(() => deck.redraw(true));

    // Update layer toggle UI
    layerToggle.updateLayerVisibility(layerId, params.visible);

    return { success: true, message: `Layer "${params.layerName}" ${params.visible ? 'shown' : 'hidden'}` };
  },

  [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
    const rgba = [params.r, params.g, params.b, params.a ?? 200];
    const currentLayers = deck.props.layers || [];

    const updatedLayers = currentLayers.map(layer => {
      if (layer.id === 'points-layer') {
        return layer.clone({ getFillColor: rgba });
      }
      return layer;
    });

    deck.setProps({ layers: updatedLayers });

    // Force redraw
    requestAnimationFrame(() => deck.redraw(true));
    setTimeout(() => deck.redraw(true), 50);

    return { success: true, message: `Point color changed to rgb(${params.r}, ${params.g}, ${params.b})` };
  }
};

// Handle tool execution from backend
async function handleToolResponse(response) {
  const { toolName, data, error } = parseToolResponse(response);

  if (error) {
    console.error(`Tool error: ${error.message}`);
    toolStatus.setError(error.message);
    chatContainer.addMessage({ role: 'system', content: `Error: ${error.message}` });
    return;
  }

  // Show tool execution status
  toolStatus.showToolExecution(toolName);

  // Execute the tool
  const executor = executors[toolName];
  if (executor && data) {
    const result = executor(data);

    // Show success status
    toolStatus.showSuccess(result.message);

    // Add action message to chat
    chatContainer.addToolCall({
      toolName: toolName,
      status: 'success',
      message: result.message
    });
  } else {
    console.warn(`Unknown tool: ${toolName}`);
  }
}

// Wait for map to be fully loaded before adding layers
map.on('load', () => {
  setTimeout(() => {
    fetch(GEOJSON_PATH)
      .then(response => response.json())
      .then(data => {
        const pointsLayer = createPointsLayer(data);
        deck.setProps({
          layers: [pointsLayer],
          _animate: true
        });

        // Register layers for name-based lookup
        const layers = [
          { id: 'points-layer', name: 'Airports', visible: true, color: '#ff69b4' }
        ];
        layers.forEach(l => layerRegistry.set(l.name, l.id));

        // Update layer toggle with available layers
        layerToggle.setLayers(layers);

        setTimeout(() => deck.redraw(), 0);
        setTimeout(() => deck.redraw(), 100);
        console.log('✓ Points layer loaded with', data.features.length, 'points');
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error);
      });
  }, 100);
});

// Setup zoom controls
zoomControls.setZoomLevel(10);

zoomControls.onZoomIn(() => {
  executors[TOOL_NAMES.ZOOM_MAP]({ direction: 'in', levels: 1 });
});

zoomControls.onZoomOut(() => {
  executors[TOOL_NAMES.ZOOM_MAP]({ direction: 'out', levels: 1 });
});

// Setup layer toggle
layerToggle.onToggle((layerId, visible) => {
  executors[TOOL_NAMES.TOGGLE_LAYER]({ layerId, visible });
});

// Initialize WebSocket client with message handlers
const wsClient = new WebSocketClient(
  WS_URL,
  async (data) => {
    if (data.type === 'stream_chunk') {
      // Handle streaming message
      if (!data.isComplete) {
        const existingMsg = chatContainer.getMessages().find(m => m.id === data.messageId);
        if (existingMsg) {
          // Update with full accumulated content
          chatContainer.updateMessage(data.messageId, data.content);
        } else {
          // Create new message with first chunk
          chatContainer.addMessage({
            id: data.messageId,
            role: 'assistant',
            content: data.content
          });
        }
      }
    }
    else if (data.type === 'tool_call') {
      // Handle tool call with standardized response
      await handleToolResponse(data);
    }
    else if (data.type === 'error') {
      chatContainer.addMessage({ role: 'system', content: `Error: ${data.content}` });
      toolStatus.setError(data.content);
    }
  },
  (connected) => {
    chatContainer.setConnectionStatus(connected);
    if (!connected) {
      chatContainer.addMessage({ role: 'system', content: 'Disconnected from server' });
    }
  }
);

// Setup chat container send handler
chatContainer.onSend((content) => {
  chatContainer.addMessage({ role: 'user', content });
  wsClient.send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
});

// Connect to WebSocket
wsClient.connect();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  wsClient.disconnect();
});

console.log('✓ Application initialized with @carto/maps-ai-tools');
