# PRP-004: Multi-Framework Demo Implementations

**Status**: Ready for Implementation
**Priority**: High
**Estimated Effort**: 3-4 hours per framework (9-12 hours total)
**Confidence Score**: 8/10

## Executive Summary

Create three framework-specific implementations (React, Vue, Angular) of the existing vanilla JS AI-powered map chat application. Each implementation must achieve complete feature parity with the current `frontend/` folder while following framework-specific best practices. All implementations share the same backend and `@map-tools/ai-tools` library.

## Context

### Current Implementation Analysis

The existing vanilla JS implementation (`frontend/` folder) provides a fully functional reference:

**Key Files:**
- `src/main.js` - Application entry point with WebSocket and tool execution orchestration
- `src/map/deckgl-map.js` - deck.gl + MapLibre map initialization and layer creation
- `src/chat/websocket-client.js` - WebSocket client with streaming message support
- `src/chat/chat-ui.js` - Chat UI manager with streaming message updates
- `src/styles/main.css` - Complete application styles
- `public/data/airports.geojson` - 309KB airport dataset
- `index.html` - HTML structure with map and chat containers

**Architecture Patterns:**
```javascript
// Current WebSocket message flow (from websocket-client.js)
1. Connect → ws = new WebSocket(url)
2. Receive → Parse JSON → Route by type (stream_chunk, tool_call, error)
3. Stream chunks → Accumulate in messageBuffer → Update UI
4. Tool calls → Execute via mapTools.execute() → Display action message
5. Disconnect → Auto-reconnect with exponential backoff
```

**Message Types:**
```javascript
// stream_chunk: Streaming AI response
{ type: 'stream_chunk', messageId: string, content: string, isComplete: boolean }

// tool_call: Map tool execution request
{ type: 'tool_call', tool: string, parameters: object, callId: string }

// error: Error message
{ type: 'error', content: string, code?: string }

// chat_message: User message to backend
{ type: 'chat_message', content: string, timestamp: number }
```

**Critical Integration Points:**
1. **deck.gl Canvas Management**: Canvas element with ID `deck-canvas`, positioned absolute
2. **MapLibre Synchronization**: `onViewStateChange` callback syncs deck.gl → MapLibre via `map.jumpTo()`
3. **Layer Updates**: Use `deck.setProps({ layers: [...] })` with forced redraws
4. **Tool Execution**: `mapTools.execute(toolName, parameters)` returns `{ success, message, data }`
5. **Streaming Messages**: Map of messageId → accumulated content, UI updated on each chunk

### Reference Code Snippets

**Vanilla JS - Main Application Setup** (src/main.js:22-38):
```javascript
fetch(GEOJSON_PATH)
  .then(response => response.json())
  .then(data => {
    const pointsLayer = createPointsLayer(data);
    deck.setProps({
      layers: [pointsLayer],
      _animate: true
    });
    setTimeout(() => deck.redraw(), 0);
    setTimeout(() => deck.redraw(), 100);
    console.log('✓ Points layer loaded with', data.features.length, 'points');
  });
```

**Vanilla JS - deck.gl Initialization** (src/map/deckgl-map.js:30-49):
```javascript
const deck = new Deck({
  canvas: canvas,
  width: '100%',
  height: '100%',
  initialViewState: initialViewState,
  controller: true,
  onViewStateChange: ({ viewState }) => {
    // Sync MapLibre with deck.gl
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    });
    return viewState;
  },
  layers: [],
  _animate: true
});
```

**Vanilla JS - WebSocket Message Handling** (src/chat/websocket-client.js:23-41):
```javascript
this.ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === 'stream_chunk') {
      this.handleStreamChunk(data);
    } else if (data.type === 'tool_call') {
      this.handleToolCall(data);
    } else if (data.type === 'error') {
      this.handleError(data);
    } else {
      this.onMessage(data);
    }
  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
  }
};
```

**Vanilla JS - Streaming Message Accumulation** (src/chat/websocket-client.js:59-76):
```javascript
handleStreamChunk(data) {
  if (!this.messageBuffer.has(data.messageId)) {
    this.messageBuffer.set(data.messageId, '');
  }

  this.messageBuffer.set(data.messageId, this.messageBuffer.get(data.messageId) + data.content);

  this.onMessage({
    type: 'stream_chunk',
    messageId: data.messageId,
    content: this.messageBuffer.get(data.messageId),
    isComplete: data.isComplete
  });

  if (data.isComplete) {
    this.messageBuffer.delete(data.messageId);
  }
}
```

**Vanilla JS - Chat UI Streaming Updates** (src/chat/chat-ui.js:21-40):
```javascript
updateStreamingMessage(messageId, content, isComplete = false) {
  let messageDiv = this.streamingMessages.get(messageId);

  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.className = 'message bot streaming';
    messageDiv.dataset.messageId = messageId;
    this.messagesContainer.appendChild(messageDiv);
    this.streamingMessages.set(messageId, messageDiv);
  }

  messageDiv.textContent = content;

  if (isComplete) {
    messageDiv.classList.remove('streaming');
    this.streamingMessages.delete(messageId);
  }

  this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
}
```

## Documentation & Resources

### Framework Documentation (Required Reading)

**React:**
- Main Guide: https://react.dev/learn
- Hooks Reference: https://react.dev/reference/react/hooks
- useEffect: https://react.dev/reference/react/useEffect (for WebSocket lifecycle)
- useState: https://react.dev/reference/react/useState (for component state)
- useRef: https://react.dev/reference/react/useRef (for canvas/map refs)
- Custom Hooks: https://react.dev/learn/reusing-logic-with-custom-hooks

**Vue 3:**
- Introduction: https://vuejs.org/guide/introduction.html
- Composition API: https://vuejs.org/api/composition-api-setup.html
- Lifecycle Hooks: https://vuejs.org/api/composition-api-lifecycle.html
- ref() and reactive(): https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- Composables: https://vuejs.org/guide/reusability/composables.html

**Angular:**
- Overview: https://angular.dev/overview
- Components: https://angular.dev/guide/components
- Services & DI: https://angular.dev/guide/di/dependency-injection
- Lifecycle Hooks: https://angular.dev/guide/components/lifecycle
- RxJS Integration: https://rxjs.dev/guide/overview

### Library Integration Documentation

**deck.gl:**
- React Integration: https://deck.gl/docs/get-started/using-with-react
  - Use `@deck.gl/react` package with `<DeckGL>` component
  - Example: https://deck.gl/docs/get-started/using-with-react#example
- Standalone (Vue/Angular): https://deck.gl/docs/get-started/using-standalone
  - Imperative API with `new Deck()`
  - Example: https://deck.gl/docs/get-started/using-standalone#example

**MapLibre GL JS:**
- API Reference: https://maplibre.org/maplibre-gl-js/docs/
- Map Class: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/

**Build Tools:**
- Vite Guide: https://vite.dev/guide/
- Vite Config: https://vite.dev/config/
- Angular CLI: https://angular.dev/tools/cli

### Existing Codebase References

**Backend WebSocket Protocol:**
- Message handler: `backend/src/services/message-handler.ts`
- OpenAI streaming: `backend/src/services/openai-service.ts`
- WebSocket server: `backend/src/websocket/websocket-server.ts`
- URL: `ws://localhost:3000/ws`

**Map Tools Library:**
- Installation: `npm install ../map-ai-tools`
- Main export: `createMapTools({ deck })`
- Type definitions: `map-ai-tools/src/core/types.ts`
- Tool definitions: `map-ai-tools/src/definitions/`
  - `zoom_map`: Zoom in/out by levels
  - `fly_to_location`: Navigate to coordinates with zoom
  - `toggle_layer`: Show/hide layers

## Implementation Plan

### Phase 1: React Implementation (Start Here - Best deck.gl Support)

**Rationale**: React has the most mature deck.gl integration via `@deck.gl/react`, making it the ideal starting point.

#### Task 1.1: Project Scaffolding
```bash
cd /Users/edumac/dev/workspaces/frontend-tools
npm create vite@latest frontend-react -- --template react
cd frontend-react
npm install
```

#### Task 1.2: Install Dependencies
```bash
npm install @deck.gl/react @deck.gl/core @deck.gl/layers @deck.gl/carto maplibre-gl
npm install ../map-ai-tools
```

**Expected package.json dependencies:**
```json
{
  "dependencies": {
    "@deck.gl/carto": "^9.2.2",
    "@deck.gl/core": "^9.2.2",
    "@deck.gl/layers": "^9.2.2",
    "@deck.gl/react": "^9.2.2",
    "@map-tools/ai-tools": "file:../map-ai-tools",
    "maplibre-gl": "^5.11.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

#### Task 1.3: Copy Static Assets
```bash
# From frontend-react/ directory
mkdir -p public/data
cp ../frontend/public/data/airports.geojson public/data/
cp ../frontend/src/styles/main.css src/styles/
```

#### Task 1.4: Update Vite Config for Port
**File**: `frontend-react/vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174  // Different from vanilla (5173)
  }
})
```

#### Task 1.5: Create Custom Hooks

**File**: `src/hooks/useWebSocket.js`
```javascript
import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const messageBufferRef = useRef(new Map());
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'stream_chunk') {
            handleStreamChunk(data);
          } else {
            onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setIsConnected(false);
        attemptReconnect();
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
    }
  }, [url, onMessage]);

  const handleStreamChunk = useCallback((data) => {
    const buffer = messageBufferRef.current;
    if (!buffer.has(data.messageId)) {
      buffer.set(data.messageId, '');
    }
    buffer.set(data.messageId, buffer.get(data.messageId) + data.content);

    onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: buffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      buffer.delete(data.messageId);
    }
  }, [onMessage]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => connect(), delay);
    }
  }, [connect]);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, send };
};
```

**File**: `src/hooks/useMapTools.js`
```javascript
import { useState, useEffect } from 'react';
import { createMapTools } from '@map-tools/ai-tools';

export const useMapTools = (deck) => {
  const [mapTools, setMapTools] = useState(null);

  useEffect(() => {
    if (deck) {
      const tools = createMapTools({ deck });
      setMapTools(tools);
    }
  }, [deck]);

  return mapTools;
};
```

#### Task 1.6: Create Components

**File**: `src/components/MapView.jsx`
```javascript
import { useState, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: -95.7129,
  latitude: 37.0902,
  zoom: 4,
  pitch: 0,
  bearing: 0
};

export const MapView = ({ onDeckInit }) => {
  const [layers, setLayers] = useState([]);
  const mapRef = useRef(null);
  const deckRef = useRef(null);

  useEffect(() => {
    // Create MapLibre map
    const map = new maplibregl.Map({
      container: 'map',
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    mapRef.current = map;

    map.on('load', () => {
      console.log('✓ MapLibre loaded');
      loadAirports();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  const loadAirports = async () => {
    try {
      const response = await fetch('/data/airports.geojson');
      const data = await response.json();

      const pointsLayer = new GeoJsonLayer({
        id: 'points-layer',
        data: data,
        pickable: true,
        filled: true,
        pointType: 'circle',
        getFillColor: [200, 0, 80, 180],
        getPointRadius: 8,
        pointRadiusMinPixels: 4,
        pointRadiusMaxPixels: 100,
        visible: true,
        opacity: 1
      });

      setLayers([pointsLayer]);
      console.log('✓ Points layer loaded with', data.features.length, 'points');
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  };

  const handleViewStateChange = ({ viewState }) => {
    if (mapRef.current) {
      mapRef.current.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        bearing: viewState.bearing,
        pitch: viewState.pitch
      });
    }
    return viewState;
  };

  const handleLoad = (deck) => {
    deckRef.current = deck;
    if (onDeckInit) {
      onDeckInit(deck);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        onViewStateChange={handleViewStateChange}
        onLoad={handleLoad}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
    </div>
  );
};
```

**File**: `src/components/ChatUI.jsx`
```javascript
import { useState, useRef, useEffect } from 'react';

export const ChatUI = ({ isConnected, onSendMessage, messages }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div style={{ width: '350px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ddd', background: 'white' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Map Control Chat</h3>
        <span style={{ fontSize: '12px', color: isConnected ? '#22c55e' : '#ef4444' }}>●</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`message ${msg.type} ${msg.streaming ? 'streaming' : ''}`}
            style={{
              padding: '10px',
              borderRadius: '8px',
              maxWidth: '80%',
              alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
              background: msg.type === 'user' ? '#3b82f6' : msg.type === 'action' ? '#10b981' : '#f3f4f6',
              color: msg.type === 'user' || msg.type === 'action' ? 'white' : '#111'
            }}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '15px', borderTop: '1px solid #ddd', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
          style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected}
          style={{
            padding: '10px 20px',
            background: isConnected ? '#3b82f6' : '#cbd5e1',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            fontWeight: '500'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};
```

#### Task 1.7: Create App Component

**File**: `src/App.jsx`
```javascript
import { useState, useCallback } from 'react';
import { MapView } from './components/MapView';
import { ChatUI } from './components/ChatUI';
import { useWebSocket } from './hooks/useWebSocket';
import { useMapTools } from './hooks/useMapTools';
import './styles/main.css';

const WS_URL = 'ws://localhost:3000/ws';

function App() {
  const [messages, setMessages] = useState([]);
  const [deck, setDeck] = useState(null);
  const [streamingMessages, setStreamingMessages] = useState(new Map());

  const mapTools = useMapTools(deck);

  const handleMessage = useCallback(async (data) => {
    if (data.type === 'stream_chunk') {
      setStreamingMessages(prev => {
        const newMap = new Map(prev);
        newMap.set(data.messageId, {
          content: data.content,
          isComplete: data.isComplete
        });
        return newMap;
      });

      setMessages(prev => {
        const filtered = prev.filter(m => m.messageId !== data.messageId);
        return [...filtered, {
          type: 'bot',
          content: data.content,
          streaming: !data.isComplete,
          messageId: data.messageId
        }];
      });

      if (data.isComplete) {
        setStreamingMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.messageId);
          return newMap;
        });
      }
    } else if (data.type === 'tool_call' && mapTools) {
      const result = await mapTools.execute(data.tool, data.parameters);
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'action',
          content: `✓ ${result.message}`
        }]);
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    } else if (data.type === 'error') {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: `Error: ${data.content}`
      }]);
    }
  }, [mapTools]);

  const { isConnected, send } = useWebSocket(WS_URL, handleMessage);

  const handleSendMessage = useCallback((content) => {
    setMessages(prev => [...prev, {
      type: 'user',
      content: content
    }]);

    send({
      type: 'chat_message',
      content: content,
      timestamp: Date.now()
    });
  }, [send]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapView onDeckInit={setDeck} />
      </div>
      <ChatUI
        isConnected={isConnected}
        onSendMessage={handleSendMessage}
        messages={messages}
      />
    </div>
  );
}

export default App;
```

#### Task 1.8: Update Main Entry Point

**File**: `src/main.jsx`
```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

#### Task 1.9: Update HTML

**File**: `index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive Map Chat - React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

#### Task 1.10: Test React Implementation
```bash
# Terminal 1: Ensure backend is running
cd backend && npm run dev

# Terminal 2: Start React app
cd frontend-react && npm run dev
```

**Validation Checklist:**
- [ ] App loads on http://localhost:5174
- [ ] Map displays with CARTO Voyager basemap
- [ ] Airports load and display as pink circles
- [ ] WebSocket connects (green dot)
- [ ] Can send chat messages
- [ ] AI responses stream character by character
- [ ] Tool calls execute (zoom, fly to)
- [ ] Action confirmation messages appear
- [ ] Map updates in real-time
- [ ] No console errors

### Phase 2: Vue Implementation (Similar to Vanilla JS)

**Rationale**: Vue's Composition API is conceptually similar to vanilla JS, making translation straightforward.

#### Task 2.1: Project Scaffolding
```bash
cd /Users/edumac/dev/workspaces/frontend-tools
npm create vite@latest frontend-vue -- --template vue
cd frontend-vue
npm install
```

#### Task 2.2: Install Dependencies
```bash
npm install @deck.gl/core @deck.gl/layers @deck.gl/carto maplibre-gl
npm install ../map-ai-tools
```

#### Task 2.3: Copy Static Assets
```bash
mkdir -p public/data
cp ../frontend/public/data/airports.geojson public/data/
cp ../frontend/src/styles/main.css src/styles/
```

#### Task 2.4: Update Vite Config
**File**: `frontend-vue/vite.config.js`
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5175
  }
})
```

#### Task 2.5: Create Composables

**File**: `src/composables/useWebSocket.js`
```javascript
import { ref, onMounted, onUnmounted } from 'vue';

export function useWebSocket(url, onMessage) {
  const isConnected = ref(false);
  let ws = null;
  const messageBuffer = new Map();
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const connect = () => {
    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        reconnectAttempts = 0;
        isConnected.value = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'stream_chunk') {
            handleStreamChunk(data);
          } else {
            onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        isConnected.value = false;
        attemptReconnect();
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      isConnected.value = false;
    }
  };

  const handleStreamChunk = (data) => {
    if (!messageBuffer.has(data.messageId)) {
      messageBuffer.set(data.messageId, '');
    }
    messageBuffer.set(data.messageId, messageBuffer.get(data.messageId) + data.content);

    onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: messageBuffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      messageBuffer.delete(data.messageId);
    }
  };

  const attemptReconnect = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => connect(), delay);
    }
  };

  const send = (message) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (ws) {
      ws.close();
    }
  });

  return { isConnected, send };
}
```

**File**: `src/composables/useDeckMap.js`
```javascript
import { ref, onMounted, onUnmounted } from 'vue';
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

export function useDeckMap() {
  const deck = ref(null);
  const map = ref(null);

  const INITIAL_VIEW_STATE = {
    longitude: -95.7129,
    latitude: 37.0902,
    zoom: 4,
    pitch: 0,
    bearing: 0
  };

  onMounted(async () => {
    // Create MapLibre map
    map.value = new maplibregl.Map({
      container: 'map',
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    // Get canvas
    const canvas = document.getElementById('deck-canvas');

    // Create deck.gl
    deck.value = new Deck({
      canvas: canvas,
      width: '100%',
      height: '100%',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      onViewStateChange: ({ viewState }) => {
        if (map.value) {
          map.value.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing,
            pitch: viewState.pitch
          });
        }
        return viewState;
      },
      layers: [],
      _animate: true
    });

    // Wait for MapLibre load
    map.value.on('load', async () => {
      console.log('✓ MapLibre loaded');

      // Load airports
      try {
        const response = await fetch('/data/airports.geojson');
        const data = await response.json();

        const pointsLayer = new GeoJsonLayer({
          id: 'points-layer',
          data: data,
          pickable: true,
          filled: true,
          pointType: 'circle',
          getFillColor: [200, 0, 80, 180],
          getPointRadius: 8,
          pointRadiusMinPixels: 4,
          pointRadiusMaxPixels: 100,
          visible: true,
          opacity: 1
        });

        deck.value.setProps({ layers: [pointsLayer] });
        setTimeout(() => deck.value.redraw(), 0);
        setTimeout(() => deck.value.redraw(), 100);
        console.log('✓ Points layer loaded with', data.features.length, 'points');
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    });
  });

  onUnmounted(() => {
    if (map.value) {
      map.value.remove();
    }
  });

  return { deck, map };
}
```

#### Task 2.6: Create Components

**File**: `src/components/MapView.vue`
```vue
<template>
  <div class="map-container">
    <div id="map"></div>
    <canvas id="deck-canvas"></canvas>
  </div>
</template>

<script setup>
import { useDeckMap } from '../composables/useDeckMap';
import 'maplibre-gl/dist/maplibre-gl.css';

const emit = defineEmits(['deckInit']);

const { deck, map } = useDeckMap();

// Emit deck instance when ready
watch(deck, (newDeck) => {
  if (newDeck) {
    emit('deckInit', newDeck);
  }
});
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

#map {
  position: absolute;
  width: 100%;
  height: 100%;
}

#deck-canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: all;
}
</style>
```

**File**: `src/components/ChatUI.vue`
```vue
<template>
  <div class="chat-container">
    <div class="chat-header">
      <h3>Map Control Chat</h3>
      <span :class="['status', isConnected ? 'connected' : 'disconnected']">●</span>
    </div>

    <div ref="messagesRef" class="chat-messages">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.type, { streaming: msg.streaming }]"
      >
        {{ msg.content }}
      </div>
    </div>

    <div class="chat-input-container">
      <input
        v-model="input"
        type="text"
        placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
        @keypress.enter="handleSend"
      />
      <button @click="handleSend" :disabled="!isConnected">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  isConnected: Boolean,
  messages: Array
});

const emit = defineEmits(['sendMessage']);

const input = ref('');
const messagesRef = ref(null);

const handleSend = () => {
  if (input.value.trim() && props.isConnected) {
    emit('sendMessage', input.value.trim());
    input.value = '';
  }
};

watch(() => props.messages, async () => {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
});
</script>

<style scoped>
.chat-container {
  width: 350px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #ddd;
  background: white;
}

.chat-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status {
  font-size: 12px;
}

.status.connected { color: #22c55e; }
.status.disconnected { color: #ef4444; }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #3b82f6;
  color: white;
  align-self: flex-end;
}

.message.bot {
  background: #f3f4f6;
  color: #111;
  align-self: flex-start;
}

.message.action {
  background: #10b981;
  color: white;
  align-self: flex-start;
  font-size: 13px;
  padding: 8px 12px;
}

.message.streaming {
  position: relative;
}

.message.streaming::after {
  content: '▋';
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.chat-input-container {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

button:hover {
  background: #2563eb;
}

button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
</style>
```

#### Task 2.7: Create App Component

**File**: `src/App.vue`
```vue
<template>
  <div id="app">
    <div class="map-wrapper">
      <MapView @deckInit="handleDeckInit" />
    </div>
    <ChatUI
      :isConnected="isConnected"
      :messages="messages"
      @sendMessage="handleSendMessage"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { createMapTools } from '@map-tools/ai-tools';
import MapView from './components/MapView.vue';
import ChatUI from './components/ChatUI.vue';
import { useWebSocket } from './composables/useWebSocket';

const WS_URL = 'ws://localhost:3000/ws';

const messages = ref([]);
const deck = ref(null);
const mapTools = ref(null);

const handleDeckInit = (deckInstance) => {
  deck.value = deckInstance;
  mapTools.value = createMapTools({ deck: deckInstance });
};

const handleMessage = async (data) => {
  if (data.type === 'stream_chunk') {
    const existingIdx = messages.value.findIndex(m => m.messageId === data.messageId);

    if (existingIdx >= 0) {
      messages.value[existingIdx] = {
        type: 'bot',
        content: data.content,
        streaming: !data.isComplete,
        messageId: data.messageId
      };
    } else {
      messages.value.push({
        type: 'bot',
        content: data.content,
        streaming: !data.isComplete,
        messageId: data.messageId
      });
    }
  } else if (data.type === 'tool_call' && mapTools.value) {
    const result = await mapTools.value.execute(data.tool, data.parameters);
    if (result.success) {
      messages.value.push({
        type: 'action',
        content: `✓ ${result.message}`
      });
    } else {
      console.error('[Main] Tool execution failed:', result.message);
    }
  } else if (data.type === 'error') {
    messages.value.push({
      type: 'bot',
      content: `Error: ${data.content}`
    });
  }
};

const { isConnected, send } = useWebSocket(WS_URL, handleMessage);

const handleSendMessage = (content) => {
  messages.value.push({
    type: 'user',
    content: content
  });

  send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
};
</script>

<style>
@import './styles/main.css';

#app {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.map-wrapper {
  flex: 1;
  position: relative;
}
</style>
```

#### Task 2.8: Update Main Entry

**File**: `src/main.js`
```javascript
import { createApp } from 'vue'
import './styles/main.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import App from './App.vue'

createApp(App).mount('#app')
```

#### Task 2.9: Update HTML

**File**: `index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive Map Chat - Vue</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

#### Task 2.10: Test Vue Implementation
```bash
cd frontend-vue && npm run dev
```

**Validation Checklist:** (Same as React)

### Phase 3: Angular Implementation (Most Different Architecture)

**Rationale**: Angular requires the most architectural adaptation with TypeScript, services, and RxJS.

#### Task 3.1: Project Scaffolding
```bash
cd /Users/edumac/dev/workspaces/frontend-tools
npx @angular/cli@latest new frontend-angular --routing=false --style=css --skip-git
cd frontend-angular
```

#### Task 3.2: Install Dependencies
```bash
npm install @deck.gl/core @deck.gl/layers @deck.gl/carto maplibre-gl
npm install ../map-ai-tools
```

#### Task 3.3: Copy Static Assets
```bash
mkdir -p src/assets/data
cp ../frontend/public/data/airports.geojson src/assets/data/
cp ../frontend/src/styles/main.css src/assets/styles/
```

#### Task 3.4: Update Angular Config
**File**: `angular.json`
```json
{
  "projects": {
    "frontend-angular": {
      "architect": {
        "serve": {
          "options": {
            "port": 5176
          }
        }
      }
    }
  }
}
```

#### Task 3.5: Create Models

**File**: `src/app/models/message.model.ts`
```typescript
export interface Message {
  type: 'user' | 'bot' | 'action';
  content: string;
  streaming?: boolean;
  messageId?: string;
}

export interface WebSocketMessage {
  type: string;
  messageId?: string;
  content?: string;
  isComplete?: boolean;
  tool?: string;
  parameters?: any;
  callId?: string;
  code?: string;
}
```

#### Task 3.6: Create Services

**File**: `src/app/services/websocket.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { WebSocketMessage } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageBuffer = new Map<string, string>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private messageSubject = new Subject<WebSocketMessage>();
  public message$ = this.messageSubject.asObservable();

  connect(url: string): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.isConnectedSubject.next(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'stream_chunk') {
            this.handleStreamChunk(data);
          } else {
            this.messageSubject.next(data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnectedSubject.next(false);
        this.attemptReconnect(url);
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.isConnectedSubject.next(false);
    }
  }

  private handleStreamChunk(data: WebSocketMessage): void {
    const messageId = data.messageId!;
    if (!this.messageBuffer.has(messageId)) {
      this.messageBuffer.set(messageId, '');
    }
    this.messageBuffer.set(messageId, this.messageBuffer.get(messageId)! + data.content!);

    this.messageSubject.next({
      type: 'stream_chunk',
      messageId: messageId,
      content: this.messageBuffer.get(messageId)!,
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      this.messageBuffer.delete(messageId);
    }
  }

  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(url), delay);
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

**File**: `src/app/services/deck-map.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

@Injectable({
  providedIn: 'root'
})
export class DeckMapService {
  private deck: Deck | null = null;
  private map: maplibregl.Map | null = null;

  async initialize(mapContainer: string, canvasElement: HTMLCanvasElement): Promise<Deck> {
    const INITIAL_VIEW_STATE = {
      longitude: -95.7129,
      latitude: 37.0902,
      zoom: 4,
      pitch: 0,
      bearing: 0
    };

    // Create MapLibre map
    this.map = new maplibregl.Map({
      container: mapContainer,
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    // Create deck.gl
    this.deck = new Deck({
      canvas: canvasElement,
      width: '100%',
      height: '100%',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      onViewStateChange: ({ viewState }) => {
        if (this.map) {
          this.map.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing,
            pitch: viewState.pitch
          });
        }
        return viewState;
      },
      layers: [],
      _animate: true
    });

    // Load airports on map load
    await new Promise<void>((resolve) => {
      this.map!.on('load', async () => {
        console.log('✓ MapLibre loaded');
        await this.loadAirports();
        resolve();
      });
    });

    return this.deck;
  }

  private async loadAirports(): Promise<void> {
    try {
      const response = await fetch('/assets/data/airports.geojson');
      const data = await response.json();

      const pointsLayer = new GeoJsonLayer({
        id: 'points-layer',
        data: data,
        pickable: true,
        filled: true,
        pointType: 'circle',
        getFillColor: [200, 0, 80, 180],
        getPointRadius: 8,
        pointRadiusMinPixels: 4,
        pointRadiusMaxPixels: 100,
        visible: true,
        opacity: 1
      });

      this.deck!.setProps({ layers: [pointsLayer] });
      setTimeout(() => this.deck!.redraw(), 0);
      setTimeout(() => this.deck!.redraw(), 100);
      console.log('✓ Points layer loaded with', data.features.length, 'points');
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  }

  getDeck(): Deck | null {
    return this.deck;
  }

  cleanup(): void {
    if (this.map) {
      this.map.remove();
    }
  }
}
```

**File**: `src/app/services/map-tools.service.ts`
```typescript
import { Injectable } from '@angular/core';
import { createMapTools } from '@map-tools/ai-tools';
import type { Deck } from '@deck.gl/core';

@Injectable({
  providedIn: 'root'
})
export class MapToolsService {
  private mapTools: any = null;

  initialize(deck: Deck): void {
    this.mapTools = createMapTools({ deck });
  }

  async execute(toolName: string, parameters: any): Promise<any> {
    if (!this.mapTools) {
      return { success: false, message: 'Map tools not initialized' };
    }
    return await this.mapTools.execute(toolName, parameters);
  }
}
```

#### Task 3.7: Create Components

**File**: `src/app/components/map-view/map-view.component.ts`
```typescript
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Output, EventEmitter } from '@angular/core';
import { DeckMapService } from '../../services/deck-map.service';

@Component({
  selector: 'app-map-view',
  standalone: true,
  template: `
    <div class="map-container">
      <div #mapContainer id="map"></div>
      <canvas #deckCanvas id="deck-canvas"></canvas>
    </div>
  `,
  styles: [`
    .map-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    #map {
      position: absolute;
      width: 100%;
      height: 100%;
    }
    #deck-canvas {
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: all;
    }
  `]
})
export class MapViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @ViewChild('deckCanvas', { static: true }) deckCanvas!: ElementRef;
  @Output() deckInit = new EventEmitter<any>();

  constructor(private deckMapService: DeckMapService) {}

  async ngOnInit() {
    const deck = await this.deckMapService.initialize(
      'map',
      this.deckCanvas.nativeElement
    );
    this.deckInit.emit(deck);
  }

  ngOnDestroy() {
    this.deckMapService.cleanup();
  }
}
```

**File**: `src/app/components/chat-ui/chat-ui.component.ts`
```typescript
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-chat-ui',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <div class="chat-header">
        <h3>Map Control Chat</h3>
        <span [class]="'status ' + (isConnected ? 'connected' : 'disconnected')">●</span>
      </div>

      <div class="chat-messages" #messagesContainer>
        <div
          *ngFor="let msg of messages; trackBy: trackByIndex"
          [class]="'message ' + msg.type + (msg.streaming ? ' streaming' : '')"
        >
          {{ msg.content }}
        </div>
      </div>

      <div class="chat-input-container">
        <input
          [(ngModel)]="input"
          type="text"
          placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
          (keypress.enter)="handleSend()"
        />
        <button (click)="handleSend()" [disabled]="!isConnected">Send</button>
      </div>
    </div>
  `,
  styleUrls: ['./chat-ui.component.css']
})
export class ChatUIComponent {
  @Input() isConnected = false;
  @Input() messages: Message[] = [];
  @Output() sendMessage = new EventEmitter<string>();

  input = '';

  handleSend() {
    if (this.input.trim() && this.isConnected) {
      this.sendMessage.emit(this.input.trim());
      this.input = '';
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
```

**File**: `src/app/components/chat-ui/chat-ui.component.css`
```css
.chat-container {
  width: 350px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #ddd;
  background: white;
}

.chat-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status {
  font-size: 12px;
}

.status.connected { color: #22c55e; }
.status.disconnected { color: #ef4444; }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #3b82f6;
  color: white;
  align-self: flex-end;
}

.message.bot {
  background: #f3f4f6;
  color: #111;
  align-self: flex-start;
}

.message.action {
  background: #10b981;
  color: white;
  align-self: flex-start;
  font-size: 13px;
  padding: 8px 12px;
}

.message.streaming {
  position: relative;
}

.message.streaming::after {
  content: '▋';
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.chat-input-container {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

button:hover {
  background: #2563eb;
}

button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
```

#### Task 3.8: Create App Component

**File**: `src/app/app.component.ts`
```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MapViewComponent } from './components/map-view/map-view.component';
import { ChatUIComponent } from './components/chat-ui/chat-ui.component';
import { WebSocketService } from './services/websocket.service';
import { MapToolsService } from './services/map-tools.service';
import { Message } from './models/message.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MapViewComponent, ChatUIComponent],
  template: `
    <div class="app-container">
      <div class="map-wrapper">
        <app-map-view (deckInit)="handleDeckInit($event)"></app-map-view>
      </div>
      <app-chat-ui
        [isConnected]="isConnected"
        [messages]="messages"
        (sendMessage)="handleSendMessage($event)"
      ></app-chat-ui>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      width: 100vw;
      height: 100vh;
    }
    .map-wrapper {
      flex: 1;
      position: relative;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  isConnected = false;
  private subscriptions = new Subscription();
  private readonly WS_URL = 'ws://localhost:3000/ws';

  constructor(
    private wsService: WebSocketService,
    private mapToolsService: MapToolsService
  ) {}

  ngOnInit() {
    this.wsService.connect(this.WS_URL);

    this.subscriptions.add(
      this.wsService.isConnected$.subscribe(connected => {
        this.isConnected = connected;
      })
    );

    this.subscriptions.add(
      this.wsService.message$.subscribe(async data => {
        await this.handleMessage(data);
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }

  handleDeckInit(deck: any) {
    this.mapToolsService.initialize(deck);
  }

  private async handleMessage(data: any) {
    if (data.type === 'stream_chunk') {
      const existingIdx = this.messages.findIndex(m => m.messageId === data.messageId);

      const message: Message = {
        type: 'bot',
        content: data.content,
        streaming: !data.isComplete,
        messageId: data.messageId
      };

      if (existingIdx >= 0) {
        this.messages[existingIdx] = message;
      } else {
        this.messages.push(message);
      }
    } else if (data.type === 'tool_call') {
      const result = await this.mapToolsService.execute(data.tool, data.parameters);
      if (result.success) {
        this.messages.push({
          type: 'action',
          content: `✓ ${result.message}`
        });
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    } else if (data.type === 'error') {
      this.messages.push({
        type: 'bot',
        content: `Error: ${data.content}`
      });
    }
  }

  handleSendMessage(content: string) {
    this.messages.push({
      type: 'user',
      content: content
    });

    this.wsService.send({
      type: 'chat_message',
      content: content,
      timestamp: Date.now()
    });
  }
}
```

#### Task 3.9: Update Styles

**File**: `src/styles.css`
```css
@import '../assets/styles/main.css';
@import 'maplibre-gl/dist/maplibre-gl.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
```

#### Task 3.10: Test Angular Implementation
```bash
cd frontend-angular && ng serve
```

**Validation Checklist:** (Same as React and Vue)

## Validation Gates

### Build Validation
```bash
# React
cd frontend-react && npm run build
# Expected: dist/ folder created, no errors

# Vue
cd frontend-vue && npm run build
# Expected: dist/ folder created, no errors

# Angular
cd frontend-angular && npm run build
# Expected: dist/frontend-angular/ created, no errors
```

### Runtime Validation
```bash
# All implementations should pass these checks:

# 1. Development server starts
npm run dev  # (or ng serve for Angular)
# Expected: Server starts on specified port

# 2. Backend connection
# Expected: Green connection status dot

# 3. Map rendering
# Expected: Map visible with airports as pink circles

# 4. Chat functionality
# Test: Type "zoom in"
# Expected: Map zooms in, action message appears

# Test: Type "fly to San Francisco"
# Expected: Map flies to SF, action message appears

# Test: Type "tell me about the map"
# Expected: AI response streams in

# 5. Console checks
# Expected: No errors in browser console
```

### Cross-Implementation Validation
```bash
# Start all three simultaneously
cd backend && npm run dev &
cd frontend-react && npm run dev &
cd frontend-vue && npm run dev &
cd frontend-angular && ng serve &

# Test identical commands across all three
# Expected: All implementations behave identically
```

## Error Handling & Known Issues

### Issue 1: deck.gl Canvas Not Found
**Symptom**: "Cannot find element with id deck-canvas"
**Solution**: Ensure canvas element exists before Deck initialization
**Framework-specific**:
- React: Use useRef and check ref.current
- Vue: Use onMounted and ensure DOM is ready
- Angular: Use ViewChild with static: true

### Issue 2: MapLibre CSS Not Loading
**Symptom**: Map tiles not visible
**Solution**: Import CSS in main entry file before any component CSS
```javascript
// Must be first import
import 'maplibre-gl/dist/maplibre-gl.css';
```

### Issue 3: WebSocket Reconnection Loop
**Symptom**: Constant reconnection attempts
**Solution**: Implement exponential backoff with max attempts
**Reference**: See vanilla implementation `websocket-client.js:97-104`

### Issue 4: Streaming Messages Not Updating
**Symptom**: Full message appears at once instead of streaming
**Solution**: Ensure message buffer is implemented and UI updates on each chunk
**Key**: Use Map for messageId → content accumulation

### Issue 5: Tool Calls Not Executing
**Symptom**: AI says it performed action but map doesn't change
**Solution**: Verify mapTools is initialized with deck instance
**Check**: `mapTools !== null` before execute call

### Issue 6: Angular Zone Issues
**Symptom**: UI not updating after WebSocket messages
**Solution**: Use RxJS observables and Angular's ChangeDetection
**Pattern**: BehaviorSubjects in services, async pipe in templates

## Success Criteria

### Functional Requirements
- [ ] All three implementations load without errors
- [ ] All show identical UI and behavior
- [ ] WebSocket connects to backend successfully
- [ ] Messages stream character by character
- [ ] Tool calls execute correctly (zoom, fly to, toggle layer)
- [ ] Action confirmation messages appear
- [ ] Connection status updates correctly
- [ ] Auto-reconnection works on disconnect

### Performance Requirements
- [ ] Initial load < 3 seconds
- [ ] Bundle size < 500KB gzipped (per implementation)
- [ ] 60fps during map interactions
- [ ] < 50ms latency for message updates

### Code Quality
- [ ] No console errors
- [ ] No memory leaks (WebSocket cleanup)
- [ ] Proper error handling
- [ ] Framework best practices followed

## Confidence Score: 8/10

**Rationale:**
- **+3**: Complete vanilla JS reference implementation exists
- **+2**: Comprehensive documentation URLs provided
- **+2**: Detailed code examples for each framework
- **+1**: Clear validation gates and error handling
- **-1**: deck.gl React integration may need adjustments
- **-1**: Angular may require additional configuration for deck.gl types

**Risk Mitigation:**
- Start with React (best deck.gl support)
- Test each implementation thoroughly before moving to next
- Keep backend running throughout all implementations
- Compare side-by-side to ensure parity

**Estimated Time:**
- React: 3-4 hours (most straightforward)
- Vue: 3-4 hours (similar to vanilla)
- Angular: 4-5 hours (most complex)
- **Total**: 10-13 hours for all three implementations
