// frontend/src/main.js
import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMap, createPointsLayer } from './map/deckgl-map.js';
import { WebSocketClient } from './chat/websocket-client.js';
import { ChatUI } from './chat/chat-ui.js';
import { createMapTools } from '@map-tools/ai-tools';

// Configuration
const WS_URL = 'ws://localhost:3000/ws';
const GEOJSON_PATH = '/data/airports.geojson';

// Initialize map
const { deck, map } = createMap('map', 'deck-canvas');

// Wait for map to be fully loaded before adding layers
map.on('load', () => {
  // Small delay to ensure everything is ready
  setTimeout(() => {
    // Load GeoJSON data and add points layer
    fetch(GEOJSON_PATH)
      .then(response => response.json())
      .then(data => {
        const pointsLayer = createPointsLayer(data);
        deck.setProps({
          layers: [pointsLayer],
          _animate: true
        });
        // Force multiple redraws to ensure points are visible
        setTimeout(() => deck.redraw(), 0);
        setTimeout(() => deck.redraw(), 100);
        console.log('✓ Points layer loaded with', data.features.length, 'points');
      })
      .catch(error => {
        console.error('Error loading GeoJSON:', error);
      });
  }, 100);
});

// Initialize map tools executor from library
const mapTools = createMapTools({
  deck
});

// Initialize chat UI
const chatUI = new ChatUI(
  document.getElementById('chat-messages'),
  document.getElementById('chat-input'),
  document.getElementById('send-button'),
  document.getElementById('connection-status')
);

// Initialize WebSocket client with message handlers
const wsClient = new WebSocketClient(
  WS_URL,
  async (data) => {
    // Handle different message types
    if (data.type === 'stream_chunk') {
      // Update streaming message
      chatUI.updateStreamingMessage(data.messageId, data.content, data.isComplete);
    }
    else if (data.type === 'tool_call') {
      // Execute tool call using library
      const result = await mapTools.execute(data.tool, data.parameters);
      if (result.success) {
        chatUI.addActionMessage(result.message);
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    }
    else if (data.type === 'error') {
      // Display error
      chatUI.addMessage(`Error: ${data.content}`, false);
    }
  },
  (connected) => {
    chatUI.setConnectionStatus(connected);
    if (!connected) {
      chatUI.addMessage('Disconnected from server', false);
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

console.log('✓ Application initialized with AI support');
