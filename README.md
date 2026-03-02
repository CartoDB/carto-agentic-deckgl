# @carto/maps-ai-tools

> AI-powered map control framework. Users interact with deck.gl maps through natural language chat. Messages are processed by an LLM that generates tool calls executed client-side to manipulate the map.

## Overview

This monorepo contains three layers that work together:

1. **Core Library** (`map-ai-tools/`) -- Framework-agnostic TypeScript library that defines the AI tool schema, system prompt builder, deck.gl JSON validation, and SDK converters.
2. **Backend Integrations** (`backend-integration/`) -- Server implementations that connect frontends to AI models. Currently includes Vercel AI SDK with Express + WebSocket.
3. **Frontend Integrations** (`frontend-integration/`) -- Reference implementations in Angular, Vue, React, and Vanilla JS showing how to build the chat-to-map experience.

## Architecture

```text
User Message --> Frontend (WebSocket) --> Backend Server
                                              |
                                    AI SDK (streaming + tool calling)
                                              |
                              text chunks + tool_call messages
                                              |
                Frontend: Display text + Execute tool calls
                                              |
                              deck.gl state update --> Map renders
```

The AI generates deck.gl JSON specifications using 2 consolidated tools (`set-deck-state` for map state and `set-marker` for location pins). The frontend executes these through `JSONConverter` to render layers, update the camera, and change the basemap.

## Project Structure

```text
ps-frontend-tools-poc/
|
+-- map-ai-tools/                         # Core library (@carto/maps-ai-tools)
|   +-- src/
|   |   +-- definitions/                  # Tool definitions (Zod schemas)
|   |   +-- converters/                   # AI SDK adapters (Vercel, OpenAI, Google)
|   |   +-- schemas/                      # deck.gl JSON validation
|   |   +-- prompts/                      # System prompt builder
|   |   +-- executors/                    # Response formatting
|   |   +-- core/                         # Validation utilities
|   |   +-- utils/                        # Response parsing
|   +-- dist/                             # Built ESM + CJS outputs
|   +-- README.md                         # Library API documentation
|
+-- backend-integration/
|   +-- vercel-ai-sdk/                    # Vercel AI SDK v6 backend
|   |   +-- src/
|   |   |   +-- server.ts                 # Express + WebSocket server
|   |   |   +-- agent/                    # Tool aggregation, providers, MCP
|   |   |   +-- services/                 # Agent runner, conversation manager
|   |   |   +-- prompts/                  # System prompt, custom instructions
|   |   |   +-- semantic/                 # YAML data catalog (GeoCubes)
|   |   +-- tests/                        # Unit tests (Vitest)
|   |   +-- README.md                     # Backend server documentation
|   +-- README.md                         # Backend integrations overview
|
+-- frontend-integration/
|   +-- angular/                          # Angular 20 (standalone components, RxJS)
|   +-- vue/                              # Vue 3 (Composition API, singleton composables)
|   +-- react/                            # React 19 (Hooks, Context API)
|   +-- vanilla/                          # Vanilla JS (ES6 classes, EventEmitter)
|   +-- README.md                         # Frontend integrations overview
```

## Quick Start

### 1. Build the core library

```bash
cd map-ai-tools
npm install && npm run build
```

### 2. Configure and start the backend

```bash
cd backend-integration/vercel-ai-sdk
npm install
cp .env.example .env   # Edit with your CARTO AI credentials
npm run dev             # http://localhost:3003
```

See [backend-integration/vercel-ai-sdk/README.md](backend-integration/vercel-ai-sdk/README.md) for environment variable details.

### 3. Pick a frontend and start it

| Framework | Directory | Install | Start | URL |
|-----------|-----------|---------|-------|-----|
| Angular 20 | `frontend-integration/angular/` | `pnpm install` | `pnpm start` | `http://localhost:4200` |
| Vue 3 | `frontend-integration/vue/` | `npm install` | `npm run dev` | `http://localhost:5174` |
| React 19 | `frontend-integration/react/` | `npm install` | `npm run dev` | `http://localhost:5173` |
| Vanilla JS | `frontend-integration/vanilla/` | `npm install` | `npm run dev` | `http://localhost:5173` |

Each frontend requires CARTO credentials configured in its environment file. See [frontend-integration/README.md](frontend-integration/README.md) for setup details.

---

## Frontend Integrations

All 4 frontends implement the same application with identical features: chat interface, deck.gl + MapLibre map, layer toggle with legend, zoom controls, and toast notifications. They differ only in framework-specific patterns.

| Aspect | Angular | Vue | React | Vanilla |
|--------|---------|-----|-------|---------|
| Framework | Angular 20 | Vue 3 | React 19 | None (ES6) |
| State | BehaviorSubject + RxJS | `reactive()` + watchers | `useReducer` + Context | EventEmitter |
| DI Pattern | `@Injectable` services | Singleton composables | Context Providers | Constructor injection |
| deck.gl | Imperative (`new Deck`) | Imperative (`new Deck`) | Declarative (`<DeckGL>`) | Imperative (`new Deck`) |
| Language | TypeScript | TypeScript | TypeScript | JavaScript |

See [frontend-integration/README.md](frontend-integration/README.md) for a detailed comparison and architecture overview.

## Backend Integrations

The backend connects frontends to AI models via WebSocket (or HTTP SSE). It handles tool orchestration, session management, and injects a semantic data catalog into the AI's system prompt.

Currently available:

- **Vercel AI SDK** -- Express + WebSocket server using Vercel AI SDK v6 with OpenAI-compatible endpoints. Supports MCP tool servers and CARTO LDS geocoding.

See [backend-integration/README.md](backend-integration/README.md) for the backend architecture overview.

## Core Library (`map-ai-tools`)

`@carto/maps-ai-tools` is a framework-agnostic TypeScript library that provides:

- **Tool definitions** with Zod v4 validation schemas
- **System prompt builder** with tool-specific instructions, map state context, and user context
- **SDK converters** for Vercel AI SDK, OpenAI Agents SDK, and Google ADK
- **deck.gl JSON schemas** for layer validation
- **Response utilities** for tool execution results

```typescript
import {
  getToolsRecordForVercelAI,
  buildSystemPrompt,
  validateToolParams,
} from '@carto/maps-ai-tools';
```

See [map-ai-tools/README.md](map-ai-tools/README.md) for the full API reference.

---

## Key Concepts

### Consolidated Tools

The AI controls the map through 2 frontend-executed tools:

| Tool             | Description                                                                                                                                                          |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `set-deck-state` | Full deck.gl state control: navigation, basemap, layers, widgets, and effects. Layer updates are deep-merged by ID, so partial updates preserve existing properties. |
| `set-marker`     | Places a location marker pin at specified coordinates. Markers accumulate across calls; duplicates at the same position are skipped.                                 |

System layers (IDs prefixed with `__`, such as the marker layer) are automatically hidden from the UI layer toggle, excluded from AI state context, and always rendered on top of user layers.

### deck.gl JSON Spec

The AI generates JSON specs using special prefixes resolved by `JSONConverter`:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `@@type` | Layer class | `"@@type": "VectorTileLayer"` |
| `@@function` | Data source or styling function | `"@@function": "colorBins"` |
| `@@=` | Accessor expression | `"@@=properties.population"` |
| `@@#` | Constant reference | `"@@#Red"` |

### WebSocket Protocol

Frontends communicate with the backend via WebSocket messages:

**Client to Server:**

- `chat_message` -- User's natural language input + current map state
- `tool_result` -- Result of executing a tool call on the frontend

**Server to Client:**

- `stream_chunk` -- Streaming text response from the AI
- `tool_call` -- Tool call to execute on the frontend
- `mcp_tool_result` -- Result from an MCP tool executed on the backend
- `error` -- Error message

### Semantic Layer

The backend loads YAML-based data catalogs (GeoCubes) that describe available tables, columns, and visualization hints. This context is injected into the AI's system prompt so it knows what data is available and how to visualize it.

---

## Testing

### Unit Tests

```bash
# Core library
cd map-ai-tools && npm test

# Backend
cd backend-integration/vercel-ai-sdk && npm test

# Frontend (any framework)
cd frontend-integration/react && npm test
```

### E2E Tests

Playwright-based end-to-end tests validate the full AI pipeline: user message → WebSocket → LLM → tool call → deck.gl rendering. Tests run against the React frontend.

```bash
cd frontend-integration/react

# Install Playwright browsers (one-time)
npx playwright install chromium

# Run all E2E tests (auto-starts backend + frontend)
pnpm e2e

# Headed mode (watch in browser)
pnpm e2e:headed

# Interactive UI mode
pnpm e2e:ui

# Run a single test
pnpm e2e -- --grep "Counties"

# Run with a specific LLM model
TEST_MODEL="ac_7xhfwyml::openai::gpt-5.2" pnpm e2e

# Run full model matrix
pnpm e2e:matrix
```

See [frontend-integration/react/e2e/README.md](frontend-integration/react/e2e/README.md) for test cases, page objects, screenshot comparison, and CI/CD details.

## Development Commands

### Core Library

```bash
cd map-ai-tools
npm install && npm run build    # Build ESM + CJS to dist/
npm run dev                     # Watch mode
npm run type-check              # Type check without emitting
npm test                        # Run unit tests
```

### Backend (Vercel AI SDK)

```bash
cd backend-integration/vercel-ai-sdk
npm run dev                     # Dev server with hot reload (port 3003)
npm run build                   # Compile TypeScript to dist/
npm run typecheck               # Type check
npm test                        # Run unit tests
```

### Frontend (any framework)

```bash
# Angular
cd frontend-integration/angular
pnpm install && pnpm start      # http://localhost:4200
pnpm build                      # Production build
npm test                        # Run unit tests

# Vue
cd frontend-integration/vue
npm install && npm run dev      # http://localhost:5174
npm run build                   # Production build
npm test                        # Run unit tests

# React
cd frontend-integration/react
npm install && npm run dev      # http://localhost:5173
npm run build                   # Production build
npm test                        # Run unit tests

# Vanilla
cd frontend-integration/vanilla
npm install && npm run dev      # http://localhost:5173
npm run build                   # Production build
npm test                        # Run unit tests
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [map-ai-tools/README.md](map-ai-tools/README.md) | Core library API reference |
| [backend-integration/README.md](backend-integration/README.md) | Backend integrations overview |
| [backend-integration/vercel-ai-sdk/README.md](backend-integration/vercel-ai-sdk/README.md) | Vercel AI SDK server documentation |
| [frontend-integration/README.md](frontend-integration/README.md) | Frontend integrations overview |
| [frontend-integration/angular/README.md](frontend-integration/angular/README.md) | Angular integration guide |
| [frontend-integration/vue/README.md](frontend-integration/vue/README.md) | Vue integration guide |
| [frontend-integration/react/README.md](frontend-integration/react/README.md) | React integration guide |
| [frontend-integration/vanilla/README.md](frontend-integration/vanilla/README.md) | Vanilla JS integration guide |
| [frontend-integration/react/e2e/README.md](frontend-integration/react/e2e/README.md) | E2E test suite documentation |

---

## License

MIT
