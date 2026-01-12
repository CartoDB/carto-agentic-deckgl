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
  ToolCallMessage
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

const executorContext: ToolExecutorContext = {
  deck,
  zoomControls,
  layerToggle,
  toolStatus,
  chatContainer,
  layerRegistry
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
      break;
    }

    case 'tool_call': {
      handleToolCall(message as ToolCallMessage, executors, executorContext);
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
      break;
    }

    case 'error': {
      const error = message as { content: string };
      chatContainer.addMessage({
        role: 'system',
        content: `Error: ${error.content}`
      });
      toolStatus.setError(error.content);
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

// Hide connection status for HTTP mode (not applicable)
if (USE_HTTP) {
  chatContainer.hideConnectionStatus();
}

// ==================== UI EVENT HANDLERS ====================

// Chat send handler
chatContainer.onSend((content) => {
  chatContainer.addMessage({ role: 'user', content });
  client.send({
    type: 'chat_message',
    content,
    timestamp: Date.now()
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
