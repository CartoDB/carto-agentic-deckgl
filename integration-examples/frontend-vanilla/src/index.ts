import './style.css';
import {
  createMap,
  initDataSource,
  createPoiLayer,
  scheduleRedraws,
  INITIAL_VIEW_STATE
} from './map/deckgl-map';
import { HttpClient } from './chat/http-client';
import { WebSocketClient } from './chat/websocket-client';
import {
  ChatContainer,
  ZoomControls,
  LayerToggle,
  ToolStatus
} from './ui';
import type { LayerInfo } from './ui';
import {
  createToolExecutors,
  handleToolCall,
  type ToolExecutorContext
} from './executors/tool-executors';
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

// ==================== MAP INITIALIZATION ====================

const { deck, map } = createMap('map', 'deck-canvas', (viewState) => {
  // Update zoom controls when view state changes
  if (zoomControls) {
    zoomControls.setZoomLevel(viewState.zoom ?? 3);
  }
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

// Layer registry for name-to-id mapping
const layerRegistry = new Map<string, string>();

// ==================== TOOL EXECUTORS ====================

// Context will be updated with sendToolResult after client is created
const executorContext: ToolExecutorContext = {
  deck,
  zoomControls,
  layerToggle,
  toolStatus,
  chatContainer,
  layerRegistry,
  sendToolResult: undefined // Will be set after client creation
};

const executors = createToolExecutors(executorContext);

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

        // For vector layer or MCP tools, start with mcp_request stage
        if (toolMessage.tool === 'add-vector-layer' || toolMessage.tool.includes('mcp')) {
          stage = 'mcp_request';
        }
        // For enrichment tools, start with enriching stage
        else if (toolMessage.tool.includes('enrich') || toolMessage.tool.includes('workflow')) {
          stage = 'enriching';
        }

        // If transitional loader exists, update it instead of creating new one
        if (currentLoadingMessageId) {
          // Update existing loader with actual tool name and stage
          chatContainer.updateToolLoading(currentLoadingMessageId, stage, `⚡ Executing ${toolMessage.tool}...`);
          console.log('[Frontend] Updated transitional loader with actual tool:', toolMessage.tool);
        } else {
          // Add new loading message to chat
          currentLoadingMessageId = chatContainer.addToolLoading(toolMessage.tool, stage);
        }

        // Update stages for specific tools with MCP operations
        if (toolMessage.tool === 'add-vector-layer' || toolMessage.tool.includes('mcp')) {
          // Stage 1: MCP request (immediate)
          // Stage 2: MCP processing (after ~1s)
          setTimeout(() => {
            if (currentLoadingMessageId) {
              chatContainer.updateToolLoading(currentLoadingMessageId, 'mcp_processing');
            }
          }, 1000);

          // Stage 3: Creating layer (after ~2.5s)
          setTimeout(() => {
            if (currentLoadingMessageId) {
              chatContainer.updateToolLoading(currentLoadingMessageId, 'creating');
            }
          }, 2500);

          // Stage 4: Loading tiles (after ~4s)
          setTimeout(() => {
            if (currentLoadingMessageId) {
              chatContainer.updateToolLoading(currentLoadingMessageId, 'loading');
            }
          }, 4000);
        } else if (toolMessage.tool.includes('enrich')) {
          // Enrichment-specific stages
          setTimeout(() => {
            if (currentLoadingMessageId) {
              chatContainer.updateToolLoading(currentLoadingMessageId, 'creating');
            }
          }, 2000);

          setTimeout(() => {
            if (currentLoadingMessageId) {
              chatContainer.updateToolLoading(currentLoadingMessageId, 'loading');
            }
          }, 4000);
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
  if (!deck) return null;

  // Get current view state - use props.initialViewState which is public
  const viewStateProps = deck.props.initialViewState || {};

  // Handle both single view state and multi-view state formats
  const viewState = 'longitude' in viewStateProps
    ? viewStateProps
    : INITIAL_VIEW_STATE; // Fallback to initial state

  const initialViewState = {
    longitude: Number(viewState.longitude ?? INITIAL_VIEW_STATE.longitude),
    latitude: Number(viewState.latitude ?? INITIAL_VIEW_STATE.latitude),
    zoom: Number(viewState.zoom ?? INITIAL_VIEW_STATE.zoom),
    pitch: Number(viewState.pitch ?? 0),
    bearing: Number(viewState.bearing ?? 0)
  };

  // Get current layers information
  const currentLayers = deck.props.layers || [];
  const layers = currentLayers.map((layer: any) => ({
    id: layer.id,
    type: layer.constructor.name,
    visible: layer.props?.visible !== false,
    // Include additional relevant properties
    opacity: layer.props?.opacity,
    data: Array.isArray(layer.props?.data)
      ? `${layer.props.data.length} features`
      : typeof layer.props?.data === 'object' && layer.props?.data?.type === 'vector'
      ? `Vector tile: ${layer.props?.data?.tableName || 'unknown'}`
      : 'Unknown data source'
  }));

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

// Zoom controls
zoomControls.onZoomIn(() => {
  executors['zoom-map']({ direction: 'in', levels: 1 });
});

zoomControls.onZoomOut(() => {
  executors['zoom-map']({ direction: 'out', levels: 1 });
});

// Layer toggle
layerToggle.onToggle((layerId, visible) => {
  executors['toggle-layer']({ layerName: layerId, visible });
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
      const layers: LayerInfo[] = [];
      layerToggle.setLayers(layers);

      // Send initial state even without CARTO layers
      setTimeout(() => {
        const initialState = createInitialState();
        if (initialState) {
          console.log('[Application] Initial map state (demo mode):', initialState);

          chatContainer.addMessage({
            role: 'assistant',
            content: `Map initialized in demo mode. Current view: ${initialState.viewState.longitude.toFixed(2)}, ${initialState.viewState.latitude.toFixed(2)} (zoom ${initialState.viewState.zoom.toFixed(1)}). I can help you navigate the map and change view settings. To add vector layers, configure CARTO credentials in the .env file.`
          });
        }
      }, 500);
    } else {
      // Initialize CARTO data source
      console.log('[Frontend] Initializing CARTO data source...');
      const dataSource = await initDataSource(CARTO_CONFIG);

      // Create and add POI layer
      const poiLayer = createPoiLayer(dataSource);
      deck.setProps({ layers: [poiLayer] });

      // Register layer
      layerRegistry.set('POIs', 'pois');

      // Update layer toggle
      const layers: LayerInfo[] = [
        { id: 'pois', name: 'POIs', visible: true, color: '#036fe2' }
      ];
      layerToggle.setLayers(layers);

      // Schedule redraws after layer is added
      map.on('load', () => {
        scheduleRedraws(deck);

        // Send initial state to AI after map and layers are loaded
        // This gives the AI context about what's available on the map
        setTimeout(() => {
          const initialState = createInitialState();
          if (initialState) {
            console.log('[Application] Initial map state:', initialState);

            // Optional: Show welcome message to user with context
            chatContainer.addMessage({
              role: 'assistant',
              content: `Map initialized with ${initialState.layers.length} layer(s). Current view: ${initialState.viewState.longitude.toFixed(2)}, ${initialState.viewState.latitude.toFixed(2)} (zoom ${initialState.viewState.zoom.toFixed(1)}). I can help you explore the map, add vector layers, change colors, zoom to locations, and more.`
            });
          }
        }, 500); // Small delay to ensure everything is rendered
      });

      console.log('[Frontend] CARTO data source initialized');
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
