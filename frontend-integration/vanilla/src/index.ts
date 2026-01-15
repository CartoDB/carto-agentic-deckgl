/**
 * Frontend-Vanilla Entry Point
 *
 * Uses JSONConverter as the central rendering engine.
 * Consolidated tools pattern from simpleAgentMap.
 */

import './style.css';
import {
  createMap,
  scheduleRedraws,
  renderFromState,
  INITIAL_VIEW_STATE,
  initDataSource,
  createPoiLayer
} from './map/deckgl-map';
import { HttpClient } from './chat/http-client';
import { WebSocketClient } from './chat/websocket-client';
import {
  ChatContainer,
  ZoomControls,
  LayerToggle,
  ToolStatus
} from './ui';
import { DeckState } from './state/DeckState';
import {
  createConsolidatedExecutors,
  handleToolCall,
  type ConsolidatedExecutorContext
} from './executors/consolidated-executors';
import type {
  ChatClient,
  ServerMessage,
  StreamChunkMessage,
  ToolCallMessage,
  ToolCallStartMessage,
  McpToolResultMessage
} from './chat/types';

// ==================== CONFIGURATION ====================

const USE_HTTP = import.meta.env.VITE_USE_HTTP !== 'false';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
const HTTP_API_URL =
  import.meta.env.VITE_HTTP_API_URL || 'http://localhost:3000/api/openai-chat';

const CARTO_CONFIG = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL || 'https://gcp-us-east1.api.carto.com',
  accessToken: import.meta.env.VITE_API_ACCESS_TOKEN || '',
  connectionName: import.meta.env.VITE_CONNECTION_NAME || 'carto_dw'
};

// ==================== LOADER STATE ====================

// Track current loading message ID for tool execution stages
let currentLoadingMessageId: string | null = null;

// ==================== CENTRAL STATE ====================

/**
 * DeckState - Central state management
 * All state changes go through here, and listeners are notified.
 */
const deckState = new DeckState({
  viewState: INITIAL_VIEW_STATE,
  deckConfig: { layers: [], widgets: [], effects: [] },
  basemap: 'positron'
});

// ==================== UI COMPONENTS ====================

const chatContainer = new ChatContainer(
  document.getElementById('chat-container')!
);
const zoomControls = new ZoomControls(
  document.getElementById('zoom-controls')!
);
const layerToggle = new LayerToggle(
  document.getElementById('layer-toggle')!
);
const toolStatus = new ToolStatus(
  document.getElementById('tool-status')!
);

// ==================== MAP INITIALIZATION ====================

const { deck, map } = createMap('map', 'deck-canvas', (viewState) => {
  // User interactions update state (but this won't re-render via subscription
  // because we don't want to animate back to the same position)
  // Just update zoom controls
  zoomControls.setZoomLevel(viewState.zoom ?? 3);
});

// ==================== STATE → RENDER SUBSCRIPTION ====================

/**
 * Subscribe to state changes and render via JSONConverter
 * This is the central rendering pipeline.
 */
deckState.subscribe((state, changedKeys) => {
  console.log('[App] State changed:', changedKeys);
  renderFromState(deck, map, state, changedKeys);
});

// ==================== TOOL EXECUTORS ====================

/**
 * Consolidated executors - simplified tool pattern
 * Each executor updates DeckState, rendering happens via subscription.
 */
const executorContext: ConsolidatedExecutorContext = {
  deckState,
  zoomControls,
  layerToggle,
  toolStatus,
  chatContainer,
  sendToolResult: undefined // Will be set after client creation
};

const executors = createConsolidatedExecutors(executorContext);

// ==================== MESSAGE HANDLING ====================

function handleMessage(message: ServerMessage): void {
  console.log('[Frontend] Message received:', message.type, message);

  switch (message.type) {
    case 'stream_chunk': {
      const chunk = message as StreamChunkMessage;
      console.log('[Frontend] Stream chunk:', {
        messageId: chunk.messageId,
        contentLength: chunk.content?.length,
        isComplete: chunk.isComplete
      });

      // Remove thinking message when we start receiving content
      if (chatContainer.hasThinkingMessage() && chunk.content) {
        chatContainer.removeThinkingMessage();
        chatContainer.setInputDisabled(false);
      }

      const existingMsg = chatContainer
        .getMessages()
        .find((m) => m.id === chunk.messageId);

      if (existingMsg) {
        // Update existing message with new content
        chatContainer.updateMessage(chunk.messageId, chunk.content);
      } else {
        // Create new message (even if content is empty, we'll update it later)
        chatContainer.addMessage({
          id: chunk.messageId,
          role: 'assistant',
          content: chunk.content || '...'
        });
      }

      // Clear loader state when message is complete
      if (chunk.isComplete) {
        chatContainer.removeThinkingMessage();
        chatContainer.setInputDisabled(false);
        // Also clear any tool loading message when stream completes
        if (currentLoadingMessageId) {
          chatContainer.removeToolLoading(currentLoadingMessageId);
          currentLoadingMessageId = null;
        }
      }
      break;
    }

    case 'tool_call_start': {
      // Agent is starting to call a tool (backend tool execution)
      const startMessage = message as ToolCallStartMessage;
      console.log('[Frontend] Tool call starting:', startMessage.toolName);

      // Remove thinking message if still showing
      chatContainer.removeThinkingMessage();

      // Show loading message for agent tool execution
      if (!currentLoadingMessageId) {
        currentLoadingMessageId = chatContainer.addToolLoading(startMessage.toolName, 'mcp_request');
      } else {
        // Update existing loader with the tool name
        chatContainer.updateToolLoading(currentLoadingMessageId, 'mcp_request', `🔗 Working with ${startMessage.toolName}...`);
      }
      break;
    }

    case 'mcp_tool_result': {
      // MCP tool completed on the backend
      const mcpResult = message as McpToolResultMessage;
      console.log('[Frontend] MCP tool result:', mcpResult.toolName);

      // Update loader to show processing stage
      if (currentLoadingMessageId) {
        chatContainer.updateToolLoading(currentLoadingMessageId, 'mcp_processing', `⚙️ Processing ${mcpResult.toolName} result...`);
      }
      // Don't remove loader yet - there may be more tool calls or frontend tools coming
      break;
    }

    case 'tool_call': {
      const toolMessage = message as ToolCallMessage;

      // Remove thinking message if still showing
      chatContainer.removeThinkingMessage();

      // Show loading message in chat for tool execution
      if (toolMessage.tool) {
        // Determine the initial stage based on tool name
        type LoadingStage = 'starting' | 'mcp_request' | 'mcp_processing' | 'enriching' | 'creating' | 'loading';
        let stage: LoadingStage = 'starting';

        // For set-deck-state, show creating stage
        if (toolMessage.tool === 'set-deck-state') {
          stage = 'creating';
        }

        // If transitional loader exists, update it instead of creating new one
        if (currentLoadingMessageId) {
          chatContainer.updateToolLoading(currentLoadingMessageId, stage, `⚡ Executing ${toolMessage.tool}...`);
          console.log('[Frontend] Updated transitional loader with actual tool:', toolMessage.tool);
        } else {
          currentLoadingMessageId = chatContainer.addToolLoading(toolMessage.tool, stage);
        }
      }

      handleToolCall(toolMessage, executors, executorContext)
        .then(() => {
          // Remove loading message after tool execution completes
          if (currentLoadingMessageId) {
            chatContainer.removeToolLoading(currentLoadingMessageId);
            currentLoadingMessageId = null;
          }
          // Re-enable input after tool execution
          chatContainer.setInputDisabled(false);
        })
        .catch((error) => {
          // Remove loading message on error
          if (currentLoadingMessageId) {
            chatContainer.removeToolLoading(currentLoadingMessageId);
            currentLoadingMessageId = null;
          }
          // Re-enable input even on error
          chatContainer.setInputDisabled(false);
          console.error('Tool execution error:', error);
        });
      break;
    }

    case 'tool_result': {
      const result = message as { toolName: string; data: unknown; message: string };
      toolStatus.showSuccess(result.message || 'Tool executed');
      chatContainer.addToolCall({
        toolName: result.toolName,
        status: 'success',
        message: result.message || String(result.data)
      });
      // Clean up any remaining loading states
      chatContainer.removeThinkingMessage();
      chatContainer.setInputDisabled(false);
      if (currentLoadingMessageId) {
        chatContainer.removeToolLoading(currentLoadingMessageId);
        currentLoadingMessageId = null;
      }
      break;
    }

    case 'error': {
      const error = message as { content: string };
      chatContainer.addMessage({
        role: 'system',
        content: `Error: ${error.content}`
      });
      toolStatus.setError(error.content);
      // Clean up any loading states on error
      chatContainer.removeThinkingMessage();
      chatContainer.setInputDisabled(false);
      if (currentLoadingMessageId) {
        chatContainer.removeToolLoading(currentLoadingMessageId);
        currentLoadingMessageId = null;
      }
      break;
    }

    case 'welcome': {
      console.log('[Frontend] Welcome message:', message);
      break;
    }

    default:
      console.log('[Frontend] Unknown message type:', message);
  }
}

// Connection change handler only used for WebSocket mode
function handleConnectionChange(connected: boolean): void {
  chatContainer.setConnectionStatus(connected);
  if (!connected) {
    chatContainer.addMessage({
      role: 'system',
      content: 'Disconnected from server. Attempting to reconnect...'
    });
  }
}

// No-op handler for HTTP mode (connection status not applicable)
function handleHttpConnectionChange(): void {
  // HTTP mode doesn't need connection status updates
}

// ==================== CHAT CLIENT ====================

const client: ChatClient = USE_HTTP
  ? new HttpClient(HTTP_API_URL, handleMessage, handleHttpConnectionChange)
  : new WebSocketClient(WS_URL, handleMessage, handleConnectionChange);

// Wire up the sendToolResult callback now that client is created
executorContext.sendToolResult = (result) => {
  console.log('[Frontend] Sending tool result to server:', result);
  client.send({
    type: 'tool_result',
    toolName: result.toolName,
    callId: result.callId,
    success: result.success,
    message: result.message,
    error: result.error
  });
};

// Hide connection status for HTTP mode (not applicable)
if (USE_HTTP) {
  chatContainer.hideConnectionStatus();
}

// ==================== INITIAL STATE CREATION ====================

/**
 * Create initial state object to send with each message.
 * This gives the AI context about current layers and view state.
 */
function createInitialState() {
  const state = deckState.getState();

  const initialViewState = {
    longitude: state.viewState.longitude,
    latitude: state.viewState.latitude,
    zoom: state.viewState.zoom,
    pitch: state.viewState.pitch ?? 0,
    bearing: state.viewState.bearing ?? 0
  };

  // Get layer information from deck config
  const stateLayers = (state.deckConfig.layers ?? []).map((layer) => ({
    id: layer.id as string,
    type: (layer['@@type'] as string) || 'Unknown',
    visible: layer.visible !== false
  }));

  // Also check deck instance for layers not in state (e.g., POI layer added directly)
  const deckLayers = (deck.props.layers || []) as Array<{ id?: string; constructor?: { name?: string } }>;
  const deckLayerIds = new Set(stateLayers.map(l => l.id));
  
  const additionalLayers = deckLayers
    .filter(layer => layer.id && !deckLayerIds.has(layer.id))
    .map(layer => ({
      id: layer.id!,
      type: layer.constructor?.name || 'Unknown',
      visible: true
    }));

  const layers = [...stateLayers, ...additionalLayers];

  console.log('[createInitialState] Current state:', {
    viewState: initialViewState,
    layerCount: layers.length,
    layers
  });

  return {
    viewState: initialViewState,
    layers,
    cartoConfig: {
      connectionName: CARTO_CONFIG.connectionName,
      hasCredentials: !!CARTO_CONFIG.accessToken
    }
  };
}

// ==================== UI EVENT HANDLERS ====================

// Chat send handler
chatContainer.onSend((content) => {
  chatContainer.addMessage({ role: 'user', content });

  // Show inline thinking message and disable input
  chatContainer.addThinkingMessage();
  chatContainer.setInputDisabled(true);

  // Get current map state to provide context to AI
  const initialState = createInitialState();

  client.send({
    type: 'chat_message',
    content,
    timestamp: Date.now(),
    initialState // Include layer and view state context for AI
  });
});

// Zoom controls - use set-map-view with current state
zoomControls.onZoomIn(() => {
  const currentView = deckState.getViewState();
  const newZoom = Math.min(22, (currentView.zoom ?? 3) + 1);
  deckState.setViewState({ zoom: newZoom });
  zoomControls.setZoomLevel(newZoom);
});

zoomControls.onZoomOut(() => {
  const currentView = deckState.getViewState();
  const newZoom = Math.max(0, (currentView.zoom ?? 3) - 1);
  deckState.setViewState({ zoom: newZoom });
  zoomControls.setZoomLevel(newZoom);
});

// Layer toggle - update layer visibility in deck config
layerToggle.onToggle((layerId, visible) => {
  const currentConfig = deckState.getDeckConfig();
  const updatedLayers = (currentConfig.layers ?? []).map((layer) => {
    if (layer.id === layerId) {
      return { ...layer, visible };
    }
    return layer;
  });
  deckState.setLayers(updatedLayers);
});

// ==================== DATA INITIALIZATION ====================

async function initialize(): Promise<void> {
  try {
    // Check if we have CARTO credentials
    if (!CARTO_CONFIG.accessToken) {
      console.warn(
        '[Frontend] No CARTO access token configured. Using demo mode.'
      );
      chatContainer.addMessage({
        role: 'system',
        content:
          'Running in demo mode. Configure VITE_API_ACCESS_TOKEN for CARTO data.'
      });

      // Set up empty layer list
      layerToggle.setLayers([]);

      // Send initial state even without CARTO layers
      setTimeout(() => {
        const initialState = createInitialState();
        if (initialState) {
          console.log('[Application] Initial map state (demo mode):', initialState);

          chatContainer.addMessage({
            role: 'assistant',
            content: `Map initialized in demo mode. Current view: ${initialState.viewState.longitude.toFixed(2)}, ${initialState.viewState.latitude.toFixed(2)} (zoom ${initialState.viewState.zoom.toFixed(1)}). I can help you navigate the map and add layers. Configure CARTO credentials in .env file to use data.`
          });
        }
      }, 500);
    } else {
      // With credentials, we can load data via tools
      console.log('[Frontend] CARTO credentials configured');

      // Initialize POI data source and layer
      try {
        const poiDataSource = await initDataSource(CARTO_CONFIG);
        const poiLayer = createPoiLayer(poiDataSource);
        
        // Add POI layer to deck
        const currentLayers = deck.props.layers || [];
        deck.setProps({ layers: [...currentLayers, poiLayer] });
        scheduleRedraws(deck);
        
        // Register POI layer in layer toggle
        layerToggle.setLayers([
          {
            id: 'pois',
            name: 'POIs',
            visible: true,
            color: '#036fe2'
          }
        ]);
        
        console.log('[Frontend] POI layer initialized and registered in AI context');
      } catch (error) {
        console.error('[Frontend] Failed to initialize POI layer:', error);
      }

      // Schedule redraws after map loads
      map.on('load', () => {
        scheduleRedraws(deck);

        // Send initial state to AI after map is loaded
        setTimeout(() => {
          const initialState = createInitialState();
          if (initialState) {
            console.log('[Application] Initial map state:', initialState);

            chatContainer.addMessage({
              role: 'assistant',
              content: `Map initialized with POI layer. Current view: ${initialState.viewState.longitude.toFixed(2)}, ${initialState.viewState.latitude.toFixed(2)} (zoom ${initialState.viewState.zoom.toFixed(1)}). I can help you explore the map, add layers from CARTO, change styling, and more. Try asking me to "show me fires worldwide" or "fly to New York".`
            });
          }
        }, 500);
      });

      console.log('[Frontend] CARTO data source ready');
    }

    // Connect to chat backend
    if (!USE_HTTP) {
      chatContainer.setConnectionChecking();
    }
    await client.connect();

    // Set initial zoom level
    zoomControls.setZoomLevel(INITIAL_VIEW_STATE.zoom ?? 3);

    console.log('[Frontend] Application initialized');
  } catch (error) {
    console.error('[Frontend] Initialization error:', error);
    chatContainer.addMessage({
      role: 'system',
      content: `Initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// ==================== CLEANUP ====================

window.addEventListener('beforeunload', () => {
  client.disconnect();
});

// ==================== START ====================

initialize();
