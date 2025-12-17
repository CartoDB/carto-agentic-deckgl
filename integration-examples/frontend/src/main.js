// frontend/src/main.js
import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMap, createPointsLayer } from './map/deckgl-map.js';
import { WebSocketClient } from './chat/websocket-client.js';
import { HttpClient } from './chat/http-client.js';

// Import custom UI components
import { ChatContainer, ZoomControls, LayerToggle, ToolStatus } from './ui/index.js';

// Import from @carto/maps-ai-tools library
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';

// Configuration
// Set USE_HTTP to true to use the new HTTP streaming endpoint, false for WebSocket
const USE_HTTP = import.meta.env.VITE_USE_HTTP === 'true' || false;
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
const HTTP_API_URL = import.meta.env.VITE_HTTP_API_URL || 'http://localhost:3000/api/litellm-chat';
const GEOJSON_PATH = '/data/airports.geojson';

console.log(`[Config] Using ${USE_HTTP ? 'HTTP' : 'WebSocket'} mode`);
console.log(`[Config] ${USE_HTTP ? 'HTTP' : 'WebSocket'} URL:`, USE_HTTP ? HTTP_API_URL : WS_URL);

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

// Store color filters for conditional coloring (stacked filters)
const colorFilters = [];

// Store base color set by set-point-color (used as default for color filters)
let basePointColor = [255, 105, 180, 180]; // Default pink

// Function to clear color filters
window.clearColorFilters = () => {
  console.log('[Frontend] Clearing color filters');
  colorFilters.length = 0;
  basePointColor = [255, 105, 180, 180]; // Reset to pink
  const currentLayers = deck.props.layers || [];
  const updatedLayers = currentLayers.map(layer => {
    if (layer.id === 'points-layer') {
      return layer.clone({
        getFillColor: basePointColor,
        updateTriggers: { getFillColor: 'reset' }
      });
    }
    return layer;
  });
  deck.setProps({ layers: updatedLayers });
  requestAnimationFrame(() => deck.redraw(true));
  setTimeout(() => deck.redraw(true), 50);
  console.log('[Frontend] Color filters cleared');
};

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

    // Store as base color for color filters to use as default
    basePointColor = rgba;
    console.log('[Frontend] Base point color set to:', basePointColor);

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
  },

  [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
    console.log('[Frontend] ========== COLOR_FEATURES_BY_PROPERTY executor called ==========');
    console.log('[Frontend] Params:', params);

    const { layerId, property, operator, value, r, g, b, a } = params;
    const rgba = [r, g, b, a ?? 180];

    // Add this filter to the stack
    const filterKey = `${property}:${operator}:${value}`;
    const newFilter = {
      key: filterKey,
      property,
      operator,
      value,
      color: rgba
    };

    console.log('[Frontend] Before adding - colorFilters.length:', colorFilters.length);

    // Check if filter already exists, update or add
    const existingIdx = colorFilters.findIndex(f => f.key === filterKey);
    if (existingIdx >= 0) {
      console.log('[Frontend] Filter exists at index', existingIdx, '- updating');
      colorFilters[existingIdx] = newFilter;
    } else {
      console.log('[Frontend] Filter is new - adding to stack');
      colorFilters.push(newFilter);
    }

    console.log('[Frontend] After adding - colorFilters.length:', colorFilters.length);
    console.log('[Frontend] Color filters stack:',
      colorFilters.map(f => `${f.property}:${f.operator}:"${f.value}" → rgb(${f.color.slice(0,3).join(',')})`));

    // Helper function to check if a feature matches a filter
    const matchesFilter = (feature, filter) => {
      // CRITICAL: Always convert to string, use empty string for null/undefined
      const propValue = String(feature.properties?.[filter.property] || '');

      switch (filter.operator) {
        case 'equals':
          return propValue === filter.value;
        case 'startsWith':
          // CRITICAL: Empty string matches all features (every string starts with "")
          // Explicitly check for empty string to ensure it always returns true
          if (filter.value === '' || filter.value === null || filter.value === undefined) {
            return true;
          }
          return propValue.startsWith(filter.value);
        case 'contains':
          return propValue.includes(filter.value);
        case 'regex':
          try {
            return new RegExp(filter.value).test(propValue);
          } catch {
            return false;
          }
        default:
          return false;
      }
    };

    // Create color accessor function
    console.log('[Frontend] Creating color accessor with base color:', basePointColor);
    let debugCount = 0;
    const colorAccessor = (feature) => {
      // Debug first few features
      if (debugCount < 5) {
        const gpsCode = feature.properties?.gps_code || '';
        console.log(`[Frontend] Evaluating feature ${debugCount}: gps_code="${gpsCode}"`);
        console.log(`[Frontend]   Available filters: ${colorFilters.length}`);
        debugCount++;

        // Check each filter and log the result
        for (let i = 0; i < colorFilters.length; i++) {
          const filter = colorFilters[i];
          const matches = matchesFilter(feature, filter);
          console.log(`[Frontend]   Filter ${i}: ${filter.property}:${filter.operator}:"${filter.value}" → matches=${matches}`);
          if (matches) {
            console.log(`[Frontend]   ✓ Using color rgb(${filter.color.slice(0,3).join(',')})`);
            return filter.color;
          }
        }
        console.log(`[Frontend]   ✗ No match, using base color rgb(${basePointColor.slice(0,3).join(',')})`);
      } else {
        // Fast path for non-debug features
        for (let i = 0; i < colorFilters.length; i++) {
          const filter = colorFilters[i];
          if (matchesFilter(feature, filter)) {
            return filter.color;
          }
        }
      }

      // Default color if no filter matches - use base color set by set-point-color
      return basePointColor;
    };

    // Update layer with conditional coloring
    const currentLayers = deck.props.layers || [];
    const updatedLayers = currentLayers.map(layer => {
      if (layer.id === (layerId || 'points-layer')) {
        return layer.clone({
          getFillColor: colorAccessor,
          updateTriggers: {
            getFillColor: JSON.stringify(colorFilters) // Force re-evaluation
          }
        });
      }
      return layer;
    });

    deck.setProps({ layers: updatedLayers });

    // Force multiple redraws to ensure deck.gl applies the changes
    requestAnimationFrame(() => deck.redraw(true));
    setTimeout(() => deck.redraw(true), 50);
    setTimeout(() => deck.redraw(true), 100);
    setTimeout(() => deck.redraw(true), 200);

    const filterDesc = `${property} ${operator} "${value}"`;
    return { success: true, message: `Applied color filter: ${filterDesc} → rgb(${r}, ${g}, ${b})` };
  }
};

// Handle tool execution from backend (CARTO library tools)
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

// Handle tool result from custom backend tools
function handleToolResult(toolResult) {
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
    displayMessage = `${toolName} result: ${JSON.stringify(data, null, 2)}`;
  }

  // Show tool execution status
  toolStatus.showToolExecution(toolName);
  toolStatus.showSuccess(message || 'Tool executed successfully');

  // Add as tool call (green box format, same as CARTO tools)
  chatContainer.addToolCall({
    toolName: toolName,
    status: 'success',
    message: displayMessage
  });
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

// Message accumulator for streaming chunks
const messageAccumulator = new Map();

// Message handler (shared between WebSocket and HTTP)
const handleMessage = async (data) => {
  console.log('[Frontend] Message received:', data);
  if (data.type === 'stream_chunk') {
    // Handle streaming message - accumulate deltas
    if (!messageAccumulator.has(data.messageId)) {
      messageAccumulator.set(data.messageId, '');
    }

    // Accumulate the content
    const accumulated = messageAccumulator.get(data.messageId) + data.content;
    messageAccumulator.set(data.messageId, accumulated);

    const existingMsg = chatContainer.getMessages().find(m => m.id === data.messageId);

    if (existingMsg) {
      // Update existing message with accumulated content
      chatContainer.updateMessage(data.messageId, accumulated);
    } else {
      // Create new message with accumulated content
      chatContainer.addMessage({
        id: data.messageId,
        role: 'assistant',
        content: accumulated
      });
    }

    // Clean up accumulator when complete
    if (data.isComplete) {
      messageAccumulator.delete(data.messageId);
    }
  }
  else if (data.type === 'tool_call') {
    // Handle tool call with standardized response (CARTO library tools)
    await handleToolResponse(data);
  }
  else if (data.type === 'tool_result') {
    // Handle tool result from custom backend tools
    handleToolResult(data);
  }
  else if (data.type === 'error') {
    chatContainer.addMessage({ role: 'system', content: `Error: ${data.content}` });
    toolStatus.setError(data.content);
  }
};

// Connection status handler (shared between WebSocket and HTTP)
const handleConnectionChange = (connected) => {
  chatContainer.setConnectionStatus(connected);
  if (!connected) {
    chatContainer.addMessage({ role: 'system', content: 'Disconnected from server' });
  }
};

// Initialize client based on configuration
const client = USE_HTTP
  ? new HttpClient(HTTP_API_URL, handleMessage, handleConnectionChange)
  : new WebSocketClient(WS_URL, handleMessage, handleConnectionChange);

// Setup chat container send handler
chatContainer.onSend((content) => {
  chatContainer.addMessage({ role: 'user', content });
  client.send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
});

// Connect to client
client.connect();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  client.disconnect();
});

console.log('✓ Application initialized with @carto/maps-ai-tools');
