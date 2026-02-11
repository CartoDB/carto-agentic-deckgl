# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered map control framework using `@carto/maps-ai-tools`. Users interact with a deck.gl map through natural language chat. Messages are processed by an LLM (via Vercel AI SDK) that generates tool calls executed client-side to manipulate the map.

**Tech Stack:**
- Core Library: `@carto/maps-ai-tools` (TypeScript, Zod, framework-agnostic)
- Backend: Node.js + TypeScript, Express, WebSocket, Vercel AI SDK v6
- Frontend: Angular 20, deck.gl, MapLibre GL, CARTO

## Project Structure

```
ps-frontend-tools-poc/
├── map-ai-tools/                    # Core library (@carto/maps-ai-tools)
├── backend-integration/
│   └── vercel-ai-sdk/               # Backend server (Express + WebSocket)
└── frontend-integration/
    └── angular/                     # Angular 20 frontend
```

## Development Commands

### Backend (Vercel AI SDK)
```bash
cd backend-integration/vercel-ai-sdk
npm run dev          # Start dev server with hot reload (tsx watch, port 3003)
npm run build        # Compile TypeScript to dist/
npm start            # Run production build
npm run typecheck    # Type check without emitting
```

### Frontend (Angular)
```bash
cd frontend-integration/angular
pnpm install         # Install dependencies
pnpm start           # Start dev server (http://localhost:4200)
pnpm build           # Build for production
npx ng build         # Alternative build command
```

### Core Library
```bash
cd map-ai-tools
npm install
npm run build        # Build ESM + CJS outputs to dist/
```

### Running the Application
1. Build core library: `cd map-ai-tools && npm run build`
2. Start backend: `cd backend-integration/vercel-ai-sdk && npm run dev` (runs on http://localhost:3003)
3. Start frontend: `cd frontend-integration/angular && pnpm start` (runs on http://localhost:4200)

## Architecture

### Communication Flow
```
User Message → Angular WebSocket → Backend (Express)
                                       ↓
                          Vercel AI SDK (streaming + tool calling)
                                       ↓
Backend streams back: text chunks + tool_call messages
                                       ↓
Angular: Display text + Execute tool_calls via ConsolidatedExecutorsService
                                       ↓
                          DeckStateService updates deck.gl
```

### Consolidated Tool (1 frontend-executed tool)

| Tool             | Purpose                                                                                               |
|------------------|-------------------------------------------------------------------------------------------------------|
| `set-deck-state` | Navigate (initialViewState), change basemap (mapStyle), add/update/remove layers, widgets, and effects |

### Key Files — Backend (`backend-integration/vercel-ai-sdk/src/`)

- `server.ts` — Express + WebSocket server, session management
- `services/agent-runner.ts` — ToolLoopAgent orchestration, streaming handler
- `services/conversation-manager.ts` — Per-session conversation history (max 20 messages)
- `agent/providers.ts` — CARTO AI provider configuration
- `agent/tools.ts` — Tool aggregation (local + custom + MCP tools)
- `agent/custom-tools.ts` — Backend-only tools (e.g., LDS geocode)
- `agent/mcp-tools.ts` — MCP server integration
- `prompts/system-prompt.ts` — System prompt builder
- `prompts/custom-prompt.ts` — App-specific AI instructions

### Key Files — Angular Frontend (`frontend-integration/angular/src/app/`)

**Components:**
- `components/map-view/` — deck.gl + MapLibre map container
- `components/chat-ui/` — Chat interface with markdown rendering
- `components/layer-toggle/` — Layer visibility controls with legend
- `components/zoom-controls/` — Zoom in/out buttons
- `components/snackbar/` — Notification component
- `components/confirmation-dialog/` — Confirmation modal

**Services:**
- `services/map-ai-tools.service.ts` — Orchestrates WebSocket messages, tool execution, loader state
- `services/deck-map.service.ts` — Creates and manages deck.gl + MapLibre instances
- `services/websocket.service.ts` — WebSocket connection with auto-reconnect
- `services/consolidated-executors.service.ts` — Executes tool calls against DeckStateService

**State & Config:**
- `state/deck-state.service.ts` — Centralized reactive state (viewState, layers, basemap)
- `config/deck-json-config.ts` — JSONConverter setup for deck.gl JSON specs (@@type, @@function, @@=)
- `config/location-pin.config.ts` — Location pin layer spec generator
- `config/semantic-config.ts` — Welcome chips configuration

**Utils:**
- `utils/layer-merge.utils.ts` — Deep merge for layer spec updates
- `utils/legend.utils.ts` — Extract legend data from layer color styling
- `utils/tooltip.utils.ts` — Tooltip content formatting

### WebSocket Message Types

**Client → Server:**
```typescript
{ type: 'chat_message', content: string, timestamp: number, initialState?: InitialState }
{ type: 'tool_result', toolName: string, callId: string, success: boolean, message: string }
```

**Server → Client:**
```typescript
{ type: 'stream_chunk', content: string, messageId: string, isComplete: boolean }
{ type: 'tool_call_start', toolName: string, callId: string }
{ type: 'tool_call', toolName: string, data: object, callId: string }
{ type: 'mcp_tool_result', toolName: string, result: unknown, callId: string }
{ type: 'error', content: string, code?: string }
```

### deck.gl JSON Spec Pattern

The AI generates JSON specs using special prefixes resolved by JSONConverter:
- `@@type` — Layer class (e.g., `VectorTileLayer`, `H3TileLayer`)
- `@@function` — Data source or styling function (e.g., `vectorTableSource`, `colorBins`)
- `@@=` — Accessor expression (e.g., `@@=properties.population`)
- `@@#` — Constant reference (e.g., `@@#Red`, `@@#FlyToInterpolator`)

## Environment Variables

### Backend (`backend-integration/vercel-ai-sdk/.env`)
```
CARTO_AI_API_BASE_URL=https://...    # Required: LLM API endpoint
CARTO_AI_API_KEY=your-key            # Required: LLM API key
CARTO_AI_API_MODEL=gpt-4o            # Optional: defaults to gpt-4o
PORT=3003                            # Optional: defaults to 3003
```

### Frontend (`frontend-integration/angular/src/environments/environment.ts`)
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://gcp-us-east1.api.carto.com',
  accessToken: 'YOUR_CARTO_TOKEN',
  connectionName: 'carto_dw',
  wsUrl: 'ws://localhost:3003/ws',
  httpApiUrl: 'http://localhost:3003/api/chat',
  useHttp: false,
};
```
