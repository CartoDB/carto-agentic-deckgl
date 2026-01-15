# CARTO AI Chat - TypeScript

A vanilla TypeScript example demonstrating AI-powered map control using deck.gl, CARTO, and natural language processing.

## Features

- **AI Chat Interface**: Natural language control of map visualization
- **deck.gl + MapLibre**: Synchronized WebGL rendering with tile basemaps
- **CARTO Integration**: VectorTileLayer with 1.4M OSM POI data points
- **Tool Execution**: Client-side execution of AI-generated map commands
- **Dual Communication**: HTTP streaming and WebSocket support

## Tech Stack

- **Frontend**: TypeScript, Vite, deck.gl 9.2, MapLibre GL
- **Data**: CARTO API Client for vector tile sources
- **AI Tools**: `@carto/maps-ai-tools` for tool definitions and parsing
- **Styling**: CSS with custom properties for theming

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- CARTO account with API access token
- Backend server running (see `backend/` directory)

### Installation

```bash
cd integration-examples/carto-ai-chat-ts
npm install
```

### Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:
```bash
# CARTO API Configuration
VITE_API_BASE_URL=https://gcp-us-east1.api.carto.com
VITE_API_ACCESS_TOKEN=your_carto_access_token_here

# Communication mode: 'true' for HTTP (default), 'false' for WebSocket
VITE_USE_HTTP=true

# Backend URLs
VITE_WS_URL=ws://localhost:3000/ws
VITE_HTTP_API_URL=http://localhost:3000/api/openai-chat
```

### Running

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Architecture

```
carto-ai-chat-ts/
├── src/
│   ├── index.ts              # Application entry point
│   ├── map/
│   │   └── deckgl-map.ts    # deck.gl + MapLibre setup
│   ├── chat/
│   │   ├── types.ts         # Message type definitions
│   │   ├── http-client.ts   # HTTP NDJSON streaming
│   │   └── websocket-client.ts  # WebSocket with reconnect
│   ├── ui/
│   │   ├── index.ts         # Component exports
│   │   ├── ChatContainer.ts # Chat UI
│   │   ├── ZoomControls.ts  # Zoom buttons
│   │   ├── LayerToggle.ts   # Layer visibility
│   │   └── ToolStatus.ts    # Execution feedback
│   ├── executors/
│   │   └── tool-executors.ts  # AI tool implementations
│   └── utils/
│       └── debounce.ts      # Utility functions
├── index.html               # HTML entry
├── style.css               # (imported in index.ts)
├── package.json
├── tsconfig.json
└── .env.example
```

## Available AI Tools

### View Control
- `fly-to` - Animate camera to coordinates
- `zoom-map` - Zoom in/out by levels
- `set-view-state` - Set absolute view parameters
- `rotate-map` - Rotate map by bearing
- `set-pitch` - Tilt map view
- `reset-view` - Reset to default view

### Layer Visibility
- `toggle-layer` - Show/hide layer by name
- `show-hide-layer` - Show/hide layer by ID

### Styling
- `set-point-color` - Uniform point coloring
- `color-features-by-property` - Conditional coloring with filters
- `reset-visualization` - Reset all styles

## Example Chat Commands

Try these commands in the chat:

- "Zoom in 3 levels"
- "Fly to New York City"
- "Hide the POIs layer"
- "Color points red"
- "Rotate the map 45 degrees"
- "Set the pitch to 60 degrees"
- "Reset the view"

## Communication Modes

### HTTP Mode (Default)
Uses NDJSON streaming over HTTP POST requests. Better for serverless deployments.

```bash
VITE_USE_HTTP=true
```

### WebSocket Mode
Uses persistent WebSocket connection. Better for real-time updates.

```bash
VITE_USE_HTTP=false
```

## UI Components

All UI components follow a class-based pattern with:
- Constructor injection of container element
- `render()` method for HTML generation
- `attachEvents()` for event listeners
- Callback methods for external integration

### ChatContainer
Message display with streaming support, input field, and connection status.

### ZoomControls
+/- buttons with current zoom level display.

### LayerToggle
Checkbox list of available layers with visibility toggle.

### ToolStatus
Transient status indicator for tool execution feedback.

## Development

### Type Checking
```bash
npm run typecheck
```

### Building
```bash
npm run build
```

The build output goes to `dist/` and can be served with any static file server.

## License

MIT
