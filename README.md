# @carto/agentic-deckgl

> AI-powered map control framework. Users interact with deck.gl maps through natural language chat. Messages are processed by an LLM that generates tool calls executed client-side to manipulate the map.

## Overview

This repository contains three layers that work together:

1. **Core Library** (`src/`) -- Framework-agnostic TypeScript library that defines the AI tool schema, system prompt builder, deck.gl JSON validation, and SDK converters.
2. **Backend Examples** (`examples/backend/`) -- Server implementations that connect frontends to AI models. Includes OpenAI Agents SDK (default), Vercel AI SDK, and Google ADK backends, all with Express + WebSocket.
3. **Frontend Examples** (`examples/frontend/`) -- Reference implementations in Angular, Vue, React, and Vanilla JS showing how to build the chat-to-map experience.

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

The AI generates deck.gl JSON specifications using 3 consolidated tools (`set-deck-state` for map state, `set-marker` for location pins, and `set-mask-layer` for spatial filtering). The frontend executes these through `JSONConverter` to render layers, update the camera, and change the basemap.

## Project Structure

```text
carto-agentic-deckgl/                        # Root IS the library package
|
+-- src/                                     # Core library source (@carto/agentic-deckgl)
|   +-- definitions/                         # Tool definitions (Zod schemas)
|   +-- converters/                          # AI SDK adapters (Vercel, OpenAI, Google)
|   +-- schemas/                             # deck.gl JSON validation
|   +-- prompts/                             # System prompt builder
|   +-- executors/                           # Response formatting
|   +-- core/                                # Validation utilities
|   +-- utils/                               # Response parsing
|
+-- test/                                    # Core library tests
|   +-- unit/
|       +-- schemas/
|
+-- dist/                                    # Built ESM + CJS outputs
|
+-- examples/
|   +-- backend/
|   |   +-- openai-agents-sdk/               # OpenAI Agents SDK backend (default)
|   |   |   +-- src/
|   |   |   |   +-- server.ts                # Express + WebSocket server
|   |   |   |   +-- agent/                   # Tool aggregation, providers, MCP
|   |   |   |   +-- services/                # Agent runner, conversation manager
|   |   |   |   +-- prompts/                 # System prompt, custom instructions
|   |   |   |   +-- semantic/                # YAML data catalog (OSI semantic model)
|   |   |   +-- tests/                       # Unit tests (Vitest)
|   |   +-- vercel-ai-sdk/                   # Vercel AI SDK v6 backend
|   |   +-- google-adk/                      # Google ADK backend
|   |   +-- README.md                        # Backend examples overview
|   |
|   +-- frontend/
|       +-- angular/                         # Angular 20 (standalone components, RxJS)
|       +-- vue/                             # Vue 3 (Composition API, singleton composables)
|       +-- react/                           # React 19 (Hooks, Context API)
|       +-- vanilla/                         # Vanilla JS (ES6 classes, EventEmitter)
|       +-- README.md                        # Frontend examples overview
|
+-- package.json                             # Library package.json
+-- rollup.config.js                         # Build config (ESM + CJS)
+-- tsconfig.json                            # TypeScript config
+-- vitest.config.ts                         # Test config
+-- docs/
|   +-- LIBRARY.md                           # Core library API reference
|   +-- SEMANTIC_LAYER.md                    # Semantic layer (OSI) documentation
```

## Quick Start

### 1. Configure and start a backend (pick one)

```bash
# Option A: OpenAI Agents SDK (default)
cd examples/backend/openai-agents-sdk

# Option B: Vercel AI SDK
cd examples/backend/vercel-ai-sdk

# Option C: Google ADK
cd examples/backend/google-adk
```

```bash
npm install              # (use --force for google-adk)
cp .env.example .env     # Edit with your CARTO AI credentials
npm run dev              # http://localhost:3003
```

All backends use the same `.env` variables and run on port 3003. See [examples/backend/README.md](examples/backend/README.md) for details.

### 2. Pick a frontend and start it

| Framework | Directory | Install | Start | URL |
|-----------|-----------|---------|-------|-----|
| Angular 20 | `examples/frontend/angular/` | `pnpm install` | `pnpm start` | `http://localhost:4200` |
| Vue 3 | `examples/frontend/vue/` | `pnpm install` | `pnpm dev` | `http://localhost:5174` |
| React 19 | `examples/frontend/react/` | `pnpm install` | `pnpm dev` | `http://localhost:5173` |
| Vanilla JS | `examples/frontend/vanilla/` | `pnpm install` | `pnpm dev` | `http://localhost:5173` |

Each frontend requires CARTO credentials configured in its environment file. See [examples/frontend/README.md](examples/frontend/README.md) for setup details.

---

## Frontend Examples

All 4 frontends implement the same application with identical features: chat interface, deck.gl + MapLibre map, layer toggle with legend, zoom controls, and toast notifications. They differ only in framework-specific patterns.

| Aspect | Angular | Vue | React | Vanilla |
|--------|---------|-----|-------|---------|
| Framework | Angular 20 | Vue 3 | React 19 | None (ES6) |
| State | BehaviorSubject + RxJS | `reactive()` + watchers | `useReducer` + Context | EventEmitter |
| DI Pattern | `@Injectable` services | Singleton composables | Context Providers | Constructor injection |
| deck.gl | Imperative (`new Deck`) | Imperative (`new Deck`) | Declarative (`<DeckGL>`) | Imperative (`new Deck`) |
| Language | TypeScript | TypeScript | TypeScript | JavaScript |

See [examples/frontend/README.md](examples/frontend/README.md) for a detailed comparison and architecture overview.

## Backend Examples

The backend connects frontends to AI models via WebSocket (or HTTP SSE). It handles tool orchestration, session management, and injects a semantic data catalog into the AI's system prompt.

Currently available:

| Backend | SDK | Directory |
|---------|-----|-----------|
| OpenAI Agents SDK (default) | @openai/agents | [openai-agents-sdk/](examples/backend/openai-agents-sdk/) |
| Vercel AI SDK | v6 | [vercel-ai-sdk/](examples/backend/vercel-ai-sdk/) |
| Google ADK | @google/adk | [google-adk/](examples/backend/google-adk/) |

All backends speak the same WebSocket protocol, so any frontend works with any backend. See [examples/backend/README.md](examples/backend/README.md) for the architecture overview.

## Core Library

`@carto/agentic-deckgl` is a framework-agnostic TypeScript library that provides:

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
} from '@carto/agentic-deckgl';
```

See [docs/LIBRARY.md](docs/LIBRARY.md) for the full API reference.

---

## Key Concepts

### Consolidated Tools

The AI controls the map through 3 frontend-executed tools:

| Tool | Description |
| --- | --- |
| `set-deck-state` | Full deck.gl state control: navigation, basemap, layers, widgets, and effects. Layer updates are deep-merged by ID, so partial updates preserve existing properties. |
| `set-marker` | Places a location marker pin at specified coordinates. Markers accumulate across calls; duplicates at the same position are skipped. |
| `set-mask-layer` | Editable mask layer for spatial filtering. Set a GeoJSON geometry or CARTO table name, enable draw mode, or clear. When active, all data layers are clipped to the mask area via `MaskExtension`. |

System layers (IDs prefixed with `__`, such as `__location-marker__`, `__mask-layer__`, and `__editable-mask__`) are automatically hidden from the UI layer toggle, excluded from AI state context, and always rendered on top of user layers.

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

### Semantic Layer (OSI v1.0)

The backend loads YAML-based semantic models following the [Open Semantic Interchange (OSI)](https://github.com/open-semantic-interchange/OSI) v1.0 specification. These models describe available datasets, fields, relationships, metrics, and visualization hints. CARTO geospatial extensions (spatial data types, styling guidance, welcome chips) are delivered via OSI's native `custom_extensions` mechanism. This context is injected into the AI's system prompt so it knows what data is available and how to visualize it. See [docs/SEMANTIC_LAYER.md](docs/SEMANTIC_LAYER.md) for details.

---

## Testing

### Unit Tests

```bash
# Core library (from root)
npm test

# Backend
cd examples/backend/vercel-ai-sdk && npm test

# Frontend (any framework)
cd examples/frontend/react && npm test
```

### E2E Tests

Playwright-based end-to-end tests validate the full AI pipeline: user message → WebSocket → LLM → tool call → deck.gl rendering. Tests run against the React frontend.

The `BACKEND_SDK` env var selects which backend to test against (default: `openai-agents-sdk`).

```bash
cd examples/frontend/react

# Install Playwright browsers (one-time)
npx playwright install chromium

# Run all E2E tests (default: openai-agents-sdk backend)
pnpm e2e

# Run against a specific backend
BACKEND_SDK=vercel-ai-sdk pnpm e2e

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

# Run matrix against a specific backend
pnpm e2e:matrix --backend vercel-ai-sdk
```

See [examples/frontend/react/e2e/README.md](examples/frontend/react/e2e/README.md) for test cases, page objects, screenshot comparison, and CI/CD details.

## Development Commands

### Core Library

```bash
npm install && npm run build    # Build ESM + CJS to dist/
npm run dev                     # Watch mode
npm run type-check              # Type check without emitting
npm test                        # Run unit tests
```

### Backend (OpenAI Agents SDK -- default)

```bash
cd examples/backend/openai-agents-sdk
npm run dev                     # Dev server with hot reload (port 3003)
npm run dev:mock-mcp            # Dev server with MCP mock mode
npm run build                   # Compile TypeScript to dist/
npm run typecheck               # Type check
npm test                        # Run unit tests
```

### Backend (Vercel AI SDK & Google ADK)

```bash
# Vercel AI SDK
cd examples/backend/vercel-ai-sdk
npm run dev                     # Dev server with hot reload (port 3003)
npm test                        # Run unit tests

# OpenAI Agents SDK
cd examples/backend/openai-agents-sdk
npm run dev                     # Dev server with hot reload (port 3003)

# Google ADK
cd examples/backend/google-adk
npm install --force             # --force needed for peer dep conflicts
npm run dev                     # Dev server with hot reload (port 3003)
```

### Frontend (any framework)

```bash
# Angular
cd examples/frontend/angular
pnpm install && pnpm start      # http://localhost:4200
pnpm build                      # Production build
pnpm test                       # Run unit tests

# Vue
cd examples/frontend/vue
pnpm install && pnpm dev        # http://localhost:5174
pnpm build                      # Production build
pnpm test                       # Run unit tests

# React
cd examples/frontend/react
pnpm install && pnpm dev        # http://localhost:5173
pnpm build                      # Production build
pnpm test                       # Run unit tests

# Vanilla
cd examples/frontend/vanilla
pnpm install && pnpm dev        # http://localhost:5173
pnpm build                      # Production build
pnpm test                       # Run unit tests
```

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [docs/LIBRARY.md](docs/LIBRARY.md) | Core library API reference |
| [docs/SEMANTIC_LAYER.md](docs/SEMANTIC_LAYER.md) | Semantic layer (OSI v1.0) documentation |
| [examples/backend/README.md](examples/backend/README.md) | Backend examples overview |
| [examples/backend/openai-agents-sdk/README.md](examples/backend/openai-agents-sdk/README.md) | OpenAI Agents SDK server documentation |
| [examples/backend/vercel-ai-sdk/README.md](examples/backend/vercel-ai-sdk/README.md) | Vercel AI SDK server documentation |
| [examples/backend/google-adk/README.md](examples/backend/google-adk/README.md) | Google ADK server documentation |
| [examples/frontend/README.md](examples/frontend/README.md) | Frontend examples overview |
| [examples/frontend/angular/README.md](examples/frontend/angular/README.md) | Angular integration guide |
| [examples/frontend/vue/README.md](examples/frontend/vue/README.md) | Vue integration guide |
| [examples/frontend/react/README.md](examples/frontend/react/README.md) | React integration guide |
| [examples/frontend/vanilla/README.md](examples/frontend/vanilla/README.md) | Vanilla JS integration guide |
| [examples/frontend/react/e2e/README.md](examples/frontend/react/e2e/README.md) | E2E test suite documentation |

---

## License

MIT
