# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map application with AI-powered natural language control. Users interact with a deck.gl map through chat messages that are processed by OpenAI to generate map manipulation commands executed client-side.

**Tech Stack:**
- Frontend: Vite + Vanilla JS, deck.gl, MapLibre GL
- Backend: Node.js + TypeScript, Express, WebSocket (ws), OpenAI API

## Development Commands

### Backend (Node.js + TypeScript)
```bash
cd backend
npm run dev          # Start development server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build from dist/
npx tsc --noEmit     # Type check without emitting files
```

### Frontend (Vite)
```bash
cd frontend
npm run dev          # Start Vite dev server (typically http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Running the Application
1. Start backend: `cd backend && npm run dev` (runs on http://localhost:3000)
2. Start frontend: `cd frontend && npm run dev` (runs on http://localhost:5173)
3. Backend requires `.env` file with `OPENAI_API_KEY` (see backend/.env.example)

## Architecture

### Communication Flow
```
User Message → Frontend WebSocket → Backend
                                      ↓
                         OpenAI API (streaming + function calling)
                                      ↓
Backend streams back: text chunks + tool_call messages
                                      ↓
Frontend: Display text + Execute tool_calls via ToolExecutor
                                      ↓
                         MapController updates deck.gl
```

### Critical Design Patterns

**1. OpenAI Function Calling Integration**
- Backend: `openai-service.ts` streams responses and accumulates tool calls
- Backend: `tool-definitions.ts` defines OpenAI function schemas (zoom_map, fly_to_location, toggle_layer)
- Frontend: `tool-executor.js` executes the function calls client-side
- **Important**: Assistant responses stored in conversation history do NOT include `tool_calls` property because OpenAI requires tool response messages to follow, which we don't send back

**2. Conversation Context Management**
- `ConversationManager` maintains per-session conversation history (max 10 messages)
- Each WebSocket connection gets a unique session ID
- Both user messages AND assistant responses must be added to history for context continuity
- System prompt is injected at the beginning of every OpenAI request

**3. deck.gl + MapLibre Synchronization**
- deck.gl handles WebGL rendering of data layers
- MapLibre GL renders the base map tiles
- `onViewStateChange` in deck.gl syncs view state to MapLibre using `map.jumpTo()`
- **Critical rendering issue**: Both layers and view state updates require explicit `deck.redraw(true)` calls with scheduled timeouts to ensure visibility

**4. Map Rendering Gotchas**
- Points layer must wait for MapLibre `load` event before being added
- View state updates use `initialViewState` with `transitionDuration` (not `viewState` prop)
- Multiple scheduled redraws are needed: `requestAnimationFrame()`, `setTimeout(50)`, `setTimeout(1100)`
- GeoJSON layer needs explicit `visible: true` and `opacity: 1` properties

### Key Files and Responsibilities

**Backend:**
- `services/openai-service.ts`: Streams OpenAI chat completions, accumulates tool calls
- `services/message-handler.ts`: Orchestrates OpenAI calls and conversation history
- `services/conversation-manager.ts`: Per-session message history with pruning
- `services/tool-definitions.ts`: OpenAI function schemas for map control
- `websocket/websocket-server.ts`: WebSocket connection handling with session IDs

**Frontend:**
- `main.js`: Application entry point, creates map, defines tool executors, wires up WebSocket
- `map/deckgl-map.js`: Creates deck.gl + MapLibre instances, defines GeoJSON layer
- `chat/websocket-client.js`: WebSocket client with auto-reconnect and message routing
- `chat/chat-ui.js`: Manages chat interface and message display

### WebSocket Message Types

**Client → Server:**
```javascript
{ type: 'chat_message', content: string, timestamp: number }
```

**Server → Client:**
```javascript
// Streaming text chunks
{ type: 'stream_chunk', content: string, messageId: string, isComplete: boolean }

// Tool execution command
{ type: 'tool_call', tool: string, parameters: object, callId: string }

// Error
{ type: 'error', content: string, code?: string }
```

### City Coordinates (hardcoded in backend SYSTEM_PROMPT and frontend main.js)
- New York: [-74.0060, 40.7128]
- Los Angeles: [-118.2437, 34.0522]
- Chicago: [-87.6298, 41.8781]
- San Francisco: [-122.4194, 37.7749]
- Seattle: [-122.3321, 47.6062]
- Miami: [-80.1918, 25.7617]
- Boston: [-71.0589, 42.3601]
- Denver: [-104.9903, 39.7392]

**Note**: Coordinates are in GeoJSON format [longitude, latitude] order (not lat, lon)

### GeoJSON Data
- Located at `frontend/public/data/airports.geojson`
- Contains airport data with coordinates and metadata
- Rendered as pink circles with radius based on zoom level

## Common Issues and Solutions

### Issue: Points not visible on initial load
**Cause**: deck.gl doesn't automatically render layers added after initialization
**Solution**: Wait for MapLibre `load` event, add layer, then call `deck.redraw(true)` multiple times with delays

### Issue: Map doesn't update visually when AI executes tools
**Cause**: Setting `viewState` prop overrides controller; no forced redraws
**Solution**: Use `initialViewState` with `transitionDuration`, schedule multiple `deck.redraw(true)` calls

### Issue: Conversation loses context after first message
**Cause**: Assistant responses not being added to conversation history
**Solution**: `openai-service.ts` must return assistant message, `message-handler.ts` must add it to ConversationManager

### Issue: OpenAI API error "tool_calls must be followed by tool response"
**Cause**: When assistant message includes `tool_calls`, OpenAI expects tool response messages
**Solution**: Don't include `tool_calls` in conversation history; only store text content

### Issue: Backend TypeScript error "function must return a value"
**Cause**: Catch blocks not explicitly returning values
**Solution**: Add `return null` or appropriate return value in catch blocks

## Environment Variables

Backend requires `.env` file (see `backend/.env.example`):
```
OPENAI_API_KEY=sk-proj-...     # Required: OpenAI API key
OPENAI_MODEL=gpt-4o            # Optional: Defaults to gpt-4o
PORT=3000                      # Optional: Defaults to 3000
```

## Adding New Map Controls

1. Add function definition to `backend/src/services/tool-definitions.ts`
2. Add execution handler to `frontend/src/commands/tool-executor.js`
3. Add corresponding method to `frontend/src/map/map-controller.js`
4. Update city coordinates in both backend SYSTEM_PROMPT and frontend main.js if needed
