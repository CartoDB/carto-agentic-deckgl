# PRP-001: Interactive Map with Chat-Based Control System

**Status:** Ready for Implementation
**Confidence Score:** 8/10
**Estimated Complexity:** Medium-High
**Implementation Time:** 8-12 hours

---

## 📋 PROJECT OVERVIEW

### What We're Building

A full-stack web application consisting of:
1. **Frontend**: Vanilla JavaScript/HTML webapp with deck.gl map visualization and chat interface
2. **Backend**: Node.js/TypeScript server with WebSocket support and OpenAI integration (Phase 1: echo server)
3. **Features**: Real-time chat communication to control map state (zoom, pan, layer visibility)

### User Story

As a web application user, I want to visualize geospatial data on an interactive map and control it through natural language chat commands so that I can intuitively explore and manipulate map visualizations without needing to learn complex UI controls.

### Success Criteria

- [ ] Map displays with CARTO VOYAGER basemap and a GeoJSON points layer
- [ ] Chat interface sends/receives messages in real-time via WebSocket
- [ ] Backend echoes messages back to frontend (Phase 1)
- [ ] Map responds to chat commands: zoom in/out, fly to coordinates, toggle layer visibility
- [ ] Clean separation between frontend and backend (two npm projects)
- [ ] Both applications run successfully with `npm run dev`

---

## 🔬 TECHNICAL REQUIREMENTS

### Frontend Stack

- **Runtime**: Browser (ES6+)
- **Framework**: Pure vanilla JavaScript (NO React/Vue/Angular)
- **Map Library**: deck.gl v9+ with @deck.gl/carto
- **Base Map**: MapLibre GL JS v3+ with CARTO basemaps
- **Build Tool**: Vite (for npm module bundling and dev server)
- **Communication**: WebSocket (native or Socket.io client)

### Backend Stack

- **Runtime**: Node.js v18+
- **Language**: TypeScript v5+
- **Framework**: Express.js
- **WebSocket**: ws library or Socket.io
- **AI Integration**: OpenAI Node.js SDK (Phase 2+)
- **Environment**: dotenv for configuration

### Data Requirements

- GeoJSON file with random points across the United States
- Points must have valid [longitude, latitude] coordinates
- Include basic properties (name, id, etc.)

---

## 📚 RESEARCH FINDINGS & DOCUMENTATION

### Core Documentation (CRITICAL - Read These First)

#### deck.gl Resources
- **Official Standalone Guide**: https://deck.gl/docs/get-started/using-standalone
- **GeoJsonLayer API**: https://deck.gl/docs/api-reference/layers/geojson-layer
- **Deck Class API**: https://deck.gl/docs/api-reference/core/deck
- **Using with MapLibre**: https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre

#### CARTO Basemaps
- **Basemap Constants**: https://deck.gl/docs/api-reference/carto/basemap
- **CARTO for deck.gl**: https://docs.carto.com/carto-for-developers/key-concepts/carto-for-deck.gl/basemaps
- **Build Public App Guide**: https://docs.carto.com/carto-for-developers/guides/build-a-public-application
- **Key Insight**: CARTO basemaps can be used WITHOUT API tokens or authentication

#### WebSocket Implementation
- **ws npm package**: https://www.npmjs.com/package/ws
- **Socket.io**: https://socket.io/docs/ (alternative, includes fallbacks)
- **Tutorial Reference**: https://dev.to/devland/build-a-real-time-chat-app-using-nodejs-and-websocket-441g

#### OpenAI Integration (Phase 2+)
- **Official SDK**: https://github.com/openai/openai-node
- **npm package**: https://www.npmjs.com/package/openai
- **API Documentation**: https://platform.openai.com/docs/api-reference
- **Chat Completions**: https://platform.openai.com/docs/guides/chat-completions

#### Vite Setup
- **Official Guide**: https://vite.dev/guide/
- **Command**: `npm create vite@latest`

### Code Examples from Research

#### deck.gl Vanilla JS Setup
```javascript
// NPM approach (recommended)
import {Deck} from '@deck.gl/core';
import {GeoJsonLayer} from '@deck.gl/layers';
import {BASEMAP} from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

// Initialize maplibre with CARTO basemap
const map = new maplibregl.Map({
  container: 'map',
  style: BASEMAP.VOYAGER,
  interactive: false
});

// Initialize deck.gl
const deck = new Deck({
  canvas: 'deck-canvas',
  initialViewState: {
    latitude: 37.7749,
    longitude: -122.4194,
    zoom: 5
  },
  controller: true,
  layers: [
    new GeoJsonLayer({
      id: 'geojson-layer',
      data: '/data/points.geojson',
      filled: true,
      pointType: 'circle',
      getFillColor: [200, 0, 80, 180],
      getPointRadius: 4
    })
  ]
});
```

#### WebSocket Backend (ws library)
```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    // Echo back (Phase 1)
    ws.send(JSON.stringify({
      type: 'message',
      content: data.content,
      timestamp: Date.now()
    }));
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

#### GeoJSON Data Structure
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      },
      "properties": {
        "name": "San Francisco",
        "id": 1
      }
    }
  ]
}
```

---

## 🏗️ SYSTEM ARCHITECTURE

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│              FRONTEND (Vite)                 │
│                                              │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │   HTML/CSS   │◄────►│  Chat Component  │ │
│  │  Structure   │      │   (WebSocket)    │ │
│  └──────────────┘      └─────────────────┘ │
│         │                       │           │
│         ▼                       ▼           │
│  ┌──────────────────────────────────────┐  │
│  │      Main JavaScript Controller       │  │
│  │    (Map State + Command Handler)      │  │
│  └──────────────────────────────────────┘  │
│         │                       │           │
│         ▼                       ▼           │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │  deck.gl Map │      │   MapLibre GL   │ │
│  │  + GeoJSON   │      │ (CARTO Basemap) │ │
│  └──────────────┘      └─────────────────┘ │
└─────────────────┬───────────────────────────┘
                  │
        WebSocket │ (ws:// or wss://)
                  │
┌─────────────────▼───────────────────────────┐
│         BACKEND (Node.js + TypeScript)      │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │        Express HTTP Server            │  │
│  └──────────────────────────────────────┘  │
│         │                                   │
│         ▼                                   │
│  ┌──────────────────────────────────────┐  │
│  │      WebSocket Server (ws)            │  │
│  │  - Connection Management              │  │
│  │  - Message Echo (Phase 1)             │  │
│  └──────────────────────────────────────┘  │
│         │                                   │
│         ▼ (Phase 2)                        │
│  ┌──────────────────────────────────────┐  │
│  │      OpenAI Integration               │  │
│  │  - Parse natural language             │  │
│  │  - Generate map commands              │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Communication Protocol

#### Message Format (JSON)
```typescript
// Client → Server
{
  type: 'chat_message',
  content: string,
  timestamp: number
}

// Server → Client (Phase 1: Echo)
{
  type: 'message',
  content: string,
  timestamp: number
}

// Server → Client (Phase 2: Command)
{
  type: 'map_command',
  action: 'zoom' | 'fly_to' | 'toggle_layer',
  params: {
    zoom?: number,
    coordinates?: [number, number],
    layerId?: string,
    visible?: boolean
  },
  originalMessage: string
}
```

---

## 📂 PROJECT STRUCTURE

### Repository Layout
```
frontend-tools/
├── frontend/                    # Vite vanilla JS project
│   ├── public/
│   │   └── data/
│   │       └── us-points.geojson
│   ├── src/
│   │   ├── main.js             # Entry point
│   │   ├── map/
│   │   │   ├── deckgl-map.js   # deck.gl initialization
│   │   │   ├── map-controller.js # Map state management
│   │   │   └── layers.js       # Layer definitions
│   │   ├── chat/
│   │   │   ├── chat-ui.js      # Chat DOM manipulation
│   │   │   └── websocket-client.js # WebSocket connection
│   │   ├── commands/
│   │   │   └── command-parser.js # Parse commands & update map
│   │   └── styles/
│   │       └── main.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── backend/                     # Node.js TypeScript project
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── server.ts           # Express server setup
│   │   ├── websocket/
│   │   │   ├── websocket-server.ts # WebSocket setup
│   │   │   └── connection-manager.ts # Connection handling
│   │   ├── services/
│   │   │   └── message-handler.ts # Echo logic (Phase 1)
│   │   └── types/
│   │       └── messages.ts     # TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── PRPs/
    └── PRP-001_generate_project.md
```

---

## 🛠️ IMPLEMENTATION BLUEPRINT

### Phase 1: Project Setup

#### Step 1.1: Initialize Frontend Project
```bash
# Create Vite project
cd frontend-tools
npm create vite@latest frontend -- --template vanilla
cd frontend

# Install dependencies
npm install @deck.gl/core @deck.gl/layers @deck.gl/carto maplibre-gl

# Install dev dependencies
npm install -D vite
```

#### Step 1.2: Initialize Backend Project
```bash
# Create backend directory
cd frontend-tools
mkdir backend && cd backend

# Initialize npm project
npm init -y

# Install dependencies
npm install express ws cors dotenv

# Install TypeScript and types
npm install -D typescript @types/node @types/express @types/ws ts-node nodemon

# Initialize TypeScript
npx tsc --init
```

**tsconfig.json configuration:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

#### Step 1.3: Generate Sample GeoJSON Data
```javascript
// Script to generate random US points (run with node)
const fs = require('fs');

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

const features = [];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix',
                'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin',
                'Seattle', 'Denver', 'Boston', 'Portland', 'Miami', 'Atlanta',
                'San Francisco', 'Detroit', 'Nashville', 'Las Vegas'];

for (let i = 0; i < 20; i++) {
  features.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      // Random coordinates within continental US bounds
      // Longitude: -125 to -66, Latitude: 24 to 49
      coordinates: [
        randomInRange(-125, -66),
        randomInRange(24, 49)
      ]
    },
    properties: {
      id: i + 1,
      name: cities[i] || `City ${i + 1}`,
      population: Math.floor(randomInRange(50000, 5000000))
    }
  });
}

const geojson = {
  type: 'FeatureCollection',
  features
};

fs.writeFileSync('us-points.geojson', JSON.stringify(geojson, null, 2));
console.log('Generated us-points.geojson with 20 random US cities');
```

---

### Phase 2: Backend Implementation

#### Step 2.1: Define TypeScript Types
```typescript
// backend/src/types/messages.ts
export interface ClientMessage {
  type: 'chat_message';
  content: string;
  timestamp: number;
}

export interface ServerMessage {
  type: 'message' | 'error';
  content: string;
  timestamp: number;
}

export interface MapCommand {
  type: 'map_command';
  action: 'zoom' | 'fly_to' | 'toggle_layer';
  params: {
    zoom?: number;
    coordinates?: [number, number];
    layerId?: string;
    visible?: boolean;
  };
  originalMessage: string;
}
```

#### Step 2.2: Create WebSocket Server
```typescript
// backend/src/websocket/websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { handleMessage } from '../services/message-handler';

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log(`[WebSocket] New connection from ${request.socket.remoteAddress}`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'message',
      content: 'Connected to chat server',
      timestamp: Date.now()
    }));

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Invalid message format',
          timestamp: Date.now()
        }));
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Connection closed');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  return wss;
}
```

#### Step 2.3: Implement Message Handler (Echo Logic)
```typescript
// backend/src/services/message-handler.ts
import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage } from '../types/messages';

export function handleMessage(ws: WebSocket, message: ClientMessage): void {
  console.log('[Message] Received:', message);

  // Phase 1: Simple echo
  const response: ServerMessage = {
    type: 'message',
    content: message.content, // Echo the same content
    timestamp: Date.now()
  };

  ws.send(JSON.stringify(response));
  console.log('[Message] Sent echo response');
}
```

#### Step 2.4: Create Express Server
```typescript
// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket/websocket-server';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  return server;
}
```

#### Step 2.5: Create Entry Point
```typescript
// backend/src/index.ts
import dotenv from 'dotenv';
import { createServer } from './server';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = createServer();

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`=================================`);
});
```

#### Step 2.6: Add npm Scripts
```json
// backend/package.json
{
  "name": "map-chat-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

### Phase 3: Frontend Implementation

#### Step 3.1: HTML Structure
```html
<!-- frontend/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interactive Map Chat</title>
  <link href="https://unpkg.com/maplibre-gl@3.0.0/dist/maplibre-gl.css" rel="stylesheet" />
</head>
<body>
  <div id="app">
    <div id="map-container">
      <div id="map"></div>
      <canvas id="deck-canvas"></canvas>
    </div>

    <div id="chat-container">
      <div id="chat-header">
        <h3>Map Control Chat</h3>
        <span id="connection-status" class="disconnected">●</span>
      </div>

      <div id="chat-messages"></div>

      <div id="chat-input-container">
        <input
          type="text"
          id="chat-input"
          placeholder="Type a command (e.g., 'zoom in', 'fly to New York')"
          autocomplete="off"
        />
        <button id="send-button">Send</button>
      </div>
    </div>
  </div>

  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

#### Step 3.2: CSS Styles
```css
/* frontend/src/styles/main.css */
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

#app {
  display: flex;
  width: 100%;
  height: 100%;
}

#map-container {
  flex: 1;
  position: relative;
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

#chat-container {
  width: 350px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #ddd;
  background: white;
}

#chat-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#connection-status {
  font-size: 12px;
}

#connection-status.connected {
  color: #22c55e;
}

#connection-status.disconnected {
  color: #ef4444;
}

#chat-messages {
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

#chat-input-container {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

#chat-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

#send-button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

#send-button:hover {
  background: #2563eb;
}

#send-button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
```

#### Step 3.3: WebSocket Client
```javascript
// frontend/src/chat/websocket-client.js
export class WebSocketClient {
  constructor(url, onMessage, onConnectionChange) {
    this.url = url;
    this.ws = null;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.onConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.onConnectionChange(false);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

#### Step 3.4: Chat UI Handler
```javascript
// frontend/src/chat/chat-ui.js
export class ChatUI {
  constructor(messagesContainer, inputElement, sendButton, statusIndicator) {
    this.messagesContainer = messagesContainer;
    this.inputElement = inputElement;
    this.sendButton = sendButton;
    this.statusIndicator = statusIndicator;
  }

  addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    messageDiv.textContent = content;

    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  clearInput() {
    this.inputElement.value = '';
  }

  setConnectionStatus(connected) {
    this.statusIndicator.className = connected ? 'connected' : 'disconnected';
    this.sendButton.disabled = !connected;
  }

  onSendMessage(callback) {
    const sendMessage = () => {
      const content = this.inputElement.value.trim();
      if (content) {
        callback(content);
        this.clearInput();
      }
    };

    this.sendButton.addEventListener('click', sendMessage);
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
}
```

#### Step 3.5: Map Controller
```javascript
// frontend/src/map/map-controller.js
export class MapController {
  constructor(deckInstance, initialViewState) {
    this.deck = deckInstance;
    this.viewState = { ...initialViewState };
    this.layers = new Map();
  }

  updateViewState(newViewState, animate = true) {
    this.viewState = { ...this.viewState, ...newViewState };
    this.deck.setProps({
      initialViewState: this.viewState,
      ...(animate && {
        viewState: this.viewState,
        onViewStateChange: null
      })
    });
  }

  zoomIn(levels = 1) {
    const newZoom = this.viewState.zoom + levels;
    this.updateViewState({ zoom: newZoom });
  }

  zoomOut(levels = 1) {
    const newZoom = Math.max(0, this.viewState.zoom - levels);
    this.updateViewState({ zoom: newZoom });
  }

  flyTo(longitude, latitude, zoom = 10) {
    this.updateViewState({ longitude, latitude, zoom });
  }

  toggleLayer(layerId) {
    const currentLayers = this.deck.props.layers;
    const updatedLayers = currentLayers.map(layer => {
      if (layer.id === layerId) {
        return layer.clone({ visible: !layer.props.visible });
      }
      return layer;
    });
    this.deck.setProps({ layers: updatedLayers });
  }

  getLayerVisibility(layerId) {
    const layer = this.deck.props.layers.find(l => l.id === layerId);
    return layer ? layer.props.visible : false;
  }
}
```

#### Step 3.6: Command Parser
```javascript
// frontend/src/commands/command-parser.js
export class CommandParser {
  constructor(mapController) {
    this.mapController = mapController;

    // City coordinates database
    this.cities = {
      'new york': [-74.0060, 40.7128],
      'los angeles': [-118.2437, 34.0522],
      'chicago': [-87.6298, 41.8781],
      'san francisco': [-122.4194, 37.7749],
      'seattle': [-122.3321, 47.6062],
      'miami': [-80.1918, 25.7617],
      'boston': [-71.0589, 42.3601],
      'denver': [-104.9903, 39.7392]
    };
  }

  parse(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Zoom commands
    if (lowerMessage.includes('zoom in')) {
      const match = lowerMessage.match(/zoom in\s+(\d+)/);
      const levels = match ? parseInt(match[1]) : 1;
      this.mapController.zoomIn(levels);
      return true;
    }

    if (lowerMessage.includes('zoom out')) {
      const match = lowerMessage.match(/zoom out\s+(\d+)/);
      const levels = match ? parseInt(match[1]) : 1;
      this.mapController.zoomOut(levels);
      return true;
    }

    // Fly to city
    for (const [city, coords] of Object.entries(this.cities)) {
      if (lowerMessage.includes(city)) {
        this.mapController.flyTo(coords[0], coords[1]);
        return true;
      }
    }

    // Fly to coordinates
    const coordMatch = lowerMessage.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch && (lowerMessage.includes('fly to') || lowerMessage.includes('go to'))) {
      const lon = parseFloat(coordMatch[1]);
      const lat = parseFloat(coordMatch[2]);
      this.mapController.flyTo(lon, lat);
      return true;
    }

    // Toggle layer visibility
    if (lowerMessage.includes('hide') || lowerMessage.includes('show')) {
      if (lowerMessage.includes('point')) {
        this.mapController.toggleLayer('points-layer');
        return true;
      }
    }

    return false; // Command not recognized
  }
}
```

#### Step 3.7: deck.gl Map Setup
```javascript
// frontend/src/map/deckgl-map.js
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

export function createMap(container, canvasId) {
  // Initial view state (centered on US)
  const initialViewState = {
    longitude: -95.7129,
    latitude: 37.0902,
    zoom: 4,
    pitch: 0,
    bearing: 0
  };

  // Create MapLibre map with CARTO basemap
  const map = new maplibregl.Map({
    container: container,
    style: BASEMAP.VOYAGER,
    interactive: false,
    center: [initialViewState.longitude, initialViewState.latitude],
    zoom: initialViewState.zoom
  });

  // Create deck.gl instance
  const deck = new Deck({
    canvas: canvasId,
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
    },
    layers: []
  });

  return { deck, map, initialViewState };
}

export function createPointsLayer(data) {
  return new GeoJsonLayer({
    id: 'points-layer',
    data: data,
    pickable: true,
    filled: true,
    pointType: 'circle',
    getFillColor: [200, 0, 80, 180],
    getPointRadius: 8,
    pointRadiusMinPixels: 4,
    pointRadiusMaxPixels: 100,
    onHover: info => {
      if (info.object) {
        console.log('Hover:', info.object.properties);
      }
    }
  });
}
```

#### Step 3.8: Main Entry Point
```javascript
// frontend/src/main.js
import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMap, createPointsLayer } from './map/deckgl-map.js';
import { MapController } from './map/map-controller.js';
import { WebSocketClient } from './chat/websocket-client.js';
import { ChatUI } from './chat/chat-ui.js';
import { CommandParser } from './commands/command-parser.js';

// Configuration
const WS_URL = 'ws://localhost:3000/ws';
const GEOJSON_PATH = '/data/us-points.geojson';

// Initialize map
const { deck, map, initialViewState } = createMap('map', 'deck-canvas');

// Load GeoJSON data and add points layer
fetch(GEOJSON_PATH)
  .then(response => response.json())
  .then(data => {
    const pointsLayer = createPointsLayer(data);
    deck.setProps({ layers: [pointsLayer] });
    console.log('✓ Points layer loaded');
  })
  .catch(error => {
    console.error('Error loading GeoJSON:', error);
  });

// Initialize map controller
const mapController = new MapController(deck, initialViewState);

// Initialize command parser
const commandParser = new CommandParser(mapController);

// Initialize chat UI
const chatUI = new ChatUI(
  document.getElementById('chat-messages'),
  document.getElementById('chat-input'),
  document.getElementById('send-button'),
  document.getElementById('connection-status')
);

// Initialize WebSocket client
const wsClient = new WebSocketClient(
  WS_URL,
  (data) => {
    // Handle incoming messages
    if (data.type === 'message') {
      chatUI.addMessage(data.content, false);
      // Try to parse as command
      commandParser.parse(data.content);
    }
  },
  (connected) => {
    // Handle connection status changes
    chatUI.setConnectionStatus(connected);
    if (connected) {
      chatUI.addMessage('Connected to chat server', false);
    } else {
      chatUI.addMessage('Disconnected from chat server', false);
    }
  }
);

// Handle sending messages
chatUI.onSendMessage((content) => {
  chatUI.addMessage(content, true);
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

console.log('✓ Application initialized');
```

---

## ✅ VALIDATION GATES

### Backend Validation

```bash
# Navigate to backend directory
cd backend

# TypeScript type checking
npx tsc --noEmit

# Start server (should run without errors)
npm run dev

# Test WebSocket endpoint (in another terminal)
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":1234567890}
```

### Frontend Validation

```bash
# Navigate to frontend directory
cd frontend

# Start dev server
npm run dev

# Browser console checks:
# 1. No errors in console
# 2. WebSocket connection established
# 3. Map renders with basemap
# 4. Points layer visible
```

### Integration Testing

**Manual Test Checklist:**

1. **WebSocket Connection**
   - [ ] Open browser console, verify "Connected" message
   - [ ] Connection status indicator shows green
   - [ ] Send a test message "Hello" → Should echo back

2. **Map Rendering**
   - [ ] CARTO Voyager basemap loads correctly
   - [ ] GeoJSON points layer displays
   - [ ] Map is interactive (pan, zoom with mouse/touch)

3. **Chat Commands**
   - [ ] "zoom in" → Map zooms in by 1 level
   - [ ] "zoom out 2" → Map zooms out by 2 levels
   - [ ] "fly to San Francisco" → Map flies to SF coordinates
   - [ ] "hide points" → Points layer becomes invisible
   - [ ] "show points" → Points layer becomes visible again

4. **Error Handling**
   - [ ] Invalid JSON from server → Error logged, no crash
   - [ ] WebSocket disconnect → Auto-reconnect attempts
   - [ ] Invalid command → Message echoed but no map change

### Build Validation

```bash
# Backend build
cd backend
npm run build
# Check dist/ folder created with .js files

# Frontend build
cd frontend
npm run build
# Check dist/ folder created with assets
```

---

## ⚠️ GOTCHAS & COMMON PITFALLS

### Critical Issues to Avoid

1. **Coordinate Order Confusion**
   - ❌ WRONG: `[latitude, longitude]`
   - ✅ CORRECT: `[longitude, latitude]` (GeoJSON standard)
   - This is the #1 cause of "points not appearing" bugs

2. **MapLibre Version Compatibility**
   - deck.gl interleaving requires MapLibre GL v3+
   - If using v2, layer rendering may not work correctly
   - Always check version: `npm list maplibre-gl`

3. **WebSocket URL Protocol**
   - Development: `ws://localhost:3000/ws`
   - Production HTTPS: Must use `wss://` (secure WebSocket)
   - Mixed content error if using `ws://` on HTTPS site

4. **CARTO Basemap Constants**
   - ❌ Don't use hardcoded URLs
   - ✅ Use `BASEMAP.VOYAGER` from `@deck.gl/carto`
   - The constant includes proper style configuration

5. **deck.gl Canvas Layering**
   - MapLibre renders to its own container
   - deck.gl renders to separate canvas
   - Canvas must have `pointer-events: all` for interaction

6. **View State Synchronization**
   - Must sync deck.gl view state → MapLibre on changes
   - Use `onViewStateChange` callback
   - Missing sync causes basemap/layers misalignment

7. **TypeScript Path Resolution**
   - Use `"moduleResolution": "node"` in tsconfig.json
   - Import extensions matter: `.js` vs `.ts`
   - Set `"esModuleInterop": true` for better compatibility

8. **Environment Variables**
   - Vite requires `VITE_` prefix for client-side vars
   - Backend uses standard `process.env`
   - Never expose backend API keys to frontend

9. **WebSocket Connection Timing**
   - Don't send messages before `onopen` fires
   - Check `readyState === WebSocket.OPEN` before sending
   - Implement reconnection logic (exponential backoff)

10. **GeoJSON Data Loading**
    - Ensure file is in `public/data/` not `src/`
    - Vite serves `public/` at root: `/data/file.geojson`
    - Check CORS if loading from external URL

### Performance Considerations

- **Large GeoJSON Files**: For >1000 points, consider using deck.gl's data filtering or clustering
- **Layer Updates**: Recreate layers instead of mutating (deck.gl uses immutability)
- **WebSocket Message Size**: Keep messages under 64KB for better performance
- **Map Animations**: `transitionDuration` prop controls animation speed (default 0)

### Browser Compatibility

- **WebGL2 Required**: deck.gl requires WebGL2 support (95% of browsers)
- **WebSocket Support**: All modern browsers (IE11 needs fallback)
- **ES6 Modules**: Vite outputs modern ES modules (no IE11 support)

---

## 📝 IMPLEMENTATION TASK LIST

Execute in this exact order:

### Phase A: Project Setup (1-2 hours)
- [ ] Create frontend project with Vite
- [ ] Create backend project with TypeScript
- [ ] Generate sample US GeoJSON data file
- [ ] Install all frontend dependencies
- [ ] Install all backend dependencies
- [ ] Configure tsconfig.json for backend
- [ ] Create .env.example files for both projects

### Phase B: Backend Implementation (2-3 hours)
- [ ] Create TypeScript type definitions (messages.ts)
- [ ] Implement WebSocket server setup
- [ ] Implement connection management
- [ ] Implement echo message handler (Phase 1)
- [ ] Create Express server with health endpoint
- [ ] Create entry point (index.ts)
- [ ] Add npm scripts (dev, build, start)
- [ ] Test backend: start server, verify health endpoint
- [ ] Test WebSocket: connect via browser dev tools

### Phase C: Frontend Core (2-3 hours)
- [ ] Create HTML structure with map and chat containers
- [ ] Create CSS styles (responsive layout)
- [ ] Implement WebSocket client class
- [ ] Implement chat UI class
- [ ] Test WebSocket connection from frontend
- [ ] Test chat message send/receive

### Phase D: Map Implementation (2-3 hours)
- [ ] Create deck.gl map initialization
- [ ] Create MapLibre basemap with CARTO VOYAGER
- [ ] Implement view state synchronization
- [ ] Create GeoJSON layer factory function
- [ ] Load GeoJSON data and render points
- [ ] Test map rendering and interaction
- [ ] Implement MapController class
- [ ] Test programmatic map control (zoom, pan)

### Phase E: Command Integration (1-2 hours)
- [ ] Implement CommandParser class
- [ ] Add zoom in/out command parsing
- [ ] Add fly-to city command parsing
- [ ] Add fly-to coordinates parsing
- [ ] Add layer toggle command parsing
- [ ] Integrate command parser with chat message handler
- [ ] Test each command type individually

### Phase F: Integration & Testing (1-2 hours)
- [ ] Create main.js entry point
- [ ] Wire up all components
- [ ] Test full user flow: message → echo → command → map update
- [ ] Test error scenarios (disconnect, invalid commands)
- [ ] Test reconnection logic
- [ ] Verify all validation gates pass
- [ ] Test build process for both frontend and backend
- [ ] Create README with setup instructions

### Phase G: Documentation (30min-1 hour)
- [ ] Document environment variables
- [ ] Document available chat commands
- [ ] Document project structure
- [ ] Add inline code comments
- [ ] Create deployment notes

---

## 🎯 CONFIDENCE SCORE: 8/10

### Why 8/10?

**Strengths (+):**
- Clear, well-researched technical stack
- Comprehensive documentation and examples
- Proven technologies (deck.gl, MapLibre, WebSocket)
- Detailed implementation blueprint with code snippets
- Phased approach reduces complexity
- Executable validation gates

**Risk Areas (-):**
- First-time integration of deck.gl + MapLibre + CARTO (learning curve)
- WebSocket reconnection logic can be tricky
- View state synchronization between deck.gl and MapLibre requires careful testing
- GeoJSON coordinate order is a common source of bugs
- No existing codebase patterns to reference

### Success Probability

- **Phase 1 (Echo backend + basic frontend)**: 95% - Straightforward WebSocket implementation
- **Phase 2 (Map rendering)**: 85% - Well-documented, but requires attention to coordinate systems
- **Phase 3 (Command integration)**: 90% - Simple string parsing and map API calls
- **Overall one-pass success**: 80% - High if implementer carefully follows coordinate conventions and synchronization patterns

### Recommendations for Success

1. **Start with backend**: Get WebSocket echo working first (easy validation)
2. **Map rendering next**: Focus on getting points to display correctly (coordinate order!)
3. **Add commands last**: Easiest part once map control API is working
4. **Test incrementally**: Don't build everything then test - validate each phase
5. **Use browser dev tools**: WebSocket tab and console are your friends
6. **Reference example repos**: deck.gl examples on GitHub if stuck

---

## 📚 ADDITIONAL RESOURCES

### Example Repositories

- deck.gl examples: https://github.com/visgl/deck.gl/tree/master/examples
- MapLibre examples: https://maplibre.org/maplibre-gl-js/docs/examples/
- WebSocket chat examples: Search GitHub for "websocket chat nodejs"

### Debugging Tools

- **Chrome DevTools** → Network → WS tab (monitor WebSocket messages)
- **deck.gl debugging**: Add `debug: true` to Deck constructor
- **MapLibre debugging**: `map.showTileBoundaries = true`

### Phase 2+ Considerations (OpenAI Integration)

When ready to implement natural language processing:

1. Add OpenAI SDK to backend dependencies
2. Store API key in backend .env file
3. Modify message handler to call OpenAI API
4. Parse OpenAI response to extract map commands
5. Return structured command object instead of echo

---

## 📞 SUPPORT & QUESTIONS

If blocked during implementation:

1. Check browser console for errors (99% of issues show there)
2. Verify WebSocket connection status
3. Confirm GeoJSON coordinates are [lon, lat] not [lat, lon]
4. Check deck.gl and MapLibre versions match requirements
5. Review the specific API documentation URLs provided above

---

**END OF PRP-001**

*Last Updated: 2025-11-05*
*Document Version: 1.0*
