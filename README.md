# @carto/maps-ai-tools

> A framework-agnostic TypeScript library for AI-powered map controls. Enables natural language interaction with deck.gl maps using LLM function calling.

## Overview

`@carto/maps-ai-tools` provides a single consolidated tool that gives AI agents complete control over interactive maps through natural language. The library uses a "teach the agent deck.gl" pattern where the AI generates deck.gl JSON specifications that are executed on the frontend via `JSONConverter`.

**Key Features:**

- **1 Consolidated Tool**: Complete map control through a single `set-deck-state` tool
- **Framework Agnostic**: Works with Vercel AI SDK, OpenAI Agents SDK, Google ADK
- **Type-Safe**: Full TypeScript support with Zod v4 validation
- **CARTO Integration**: Native support for CARTO data sources and spatial indexes (H3, Quadbin)
- **Streaming Support**: Real-time tool execution with WebSocket communication

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [The Tool](#the-tool)
- [Integration Guide](#integration-guide)
- [Layer Types](#layer-types)
- [Data Sources](#data-sources)
- [Color Styling](#color-styling)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## Quick Start

### Installation

```bash
# Install the core library
cd map-ai-tools
npm install
npm run build

# Install backend integration
cd ../backend-integration/vercel-ai-sdk
npm install

# Install frontend integration
cd ../../frontend-integration/angular
pnpm install
```

### Environment Setup

**Backend** (`backend-integration/vercel-ai-sdk/.env`):

```env
CARTO_AI_API_BASE_URL=https://...    # Required: LLM API endpoint
CARTO_AI_API_KEY=your-key            # Required: LLM API key
CARTO_AI_API_MODEL=gpt-4o            # Optional: defaults to gpt-4o
PORT=3003                            # Optional: defaults to 3003
```

**Frontend** (`frontend-integration/angular/src/environments/environment.ts`):

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

### Running the Application

```bash
# Terminal 1: Build core library
cd map-ai-tools && npm run build

# Terminal 2: Start backend
cd backend-integration/vercel-ai-sdk && npm run dev    # http://localhost:3003

# Terminal 3: Start frontend
cd frontend-integration/angular && pnpm start          # http://localhost:4200
```

Open http://localhost:4200 and start chatting with the map.

---

## Project Structure

```
ps-frontend-tools-poc/
├── map-ai-tools/                    # Core library (@carto/maps-ai-tools v2.0.0)
│   ├── src/
│   │   ├── definitions/             # Tool definition with Zod schema
│   │   ├── converters/              # AI framework adapters (Vercel, OpenAI, Google)
│   │   ├── schemas/                 # deck.gl JSON schemas
│   │   ├── prompts/                 # System prompt builder and tool prompts
│   │   ├── executors/               # Response formatting utilities
│   │   └── core/                    # Validation utilities
│   └── dist/                        # Built ESM + CJS outputs
│
├── backend-integration/
│   └── vercel-ai-sdk/               # Vercel AI SDK v6 backend
│       └── src/
│           ├── server.ts            # Express + WebSocket server
│           ├── services/            # Agent runner, conversation manager
│           ├── agent/               # Tool aggregation, MCP tools, providers
│           ├── prompts/             # System prompt, custom prompt
│           └── semantic/            # Semantic layer (YAML data catalog)
│               ├── schema.ts        # GeoCube, dimension, measure types
│               ├── loader.ts        # YAML loading + markdown rendering
│               └── layers/*.yaml    # Data cube definitions
│
└── frontend-integration/
    └── angular/                     # Angular 20 frontend
        └── src/app/
            ├── components/          # map-view, chat-ui, layer-toggle, zoom-controls
            ├── services/            # map-ai-tools, deck-map, websocket, executors
            ├── state/               # deck-state.service.ts (centralized state)
            ├── config/              # deck-json-config, location-pin, semantic-config
            └── utils/               # layer-merge, legend, tooltip
```

---

## The Tool

The library provides a single consolidated tool that gives AI complete control over the map:

### `set-deck-state`

Manages all deck.gl visualization state: navigation, basemap, layers, widgets, and effects.

```typescript
{
  // Navigate the map
  initialViewState?: {
    latitude: number,           // -90 to 90
    longitude: number,          // -180 to 180
    zoom: number,               // 0 to 22
    pitch?: number,             // 0 to 85 degrees
    bearing?: number,           // -180 to 180 degrees
    transitionDuration?: number // Animation duration in ms (default: 1000)
  },

  // Change basemap
  mapStyle?: 'dark-matter' | 'positron' | 'voyager',

  // Add/update layers (merged with existing by ID)
  layers?: Array<{
    '@@type': string,           // Layer type (VectorTileLayer, H3TileLayer, etc.)
    id: string,                 // Unique identifier
    data: object,               // Data source configuration
    // ... other deck.gl properties
  }>,

  // Set widgets
  widgets?: Array<object>,

  // Set effects
  effects?: Array<object>,

  // Reorder layers (first ID at bottom, last on top)
  layerOrder?: string[],

  // Remove layers by ID (processed before additions)
  removeLayerIds?: string[],
}
```

The AI generates this JSON structure, which is sent to the frontend and executed by the `ConsolidatedExecutorsService`. Layer updates are deep-merged by ID, so partial updates preserve existing properties.

---

## Integration Guide

### Vercel AI SDK

```typescript
import { streamText } from 'ai';
import { getToolsRecordForVercelAI, buildSystemPrompt } from '@carto/maps-ai-tools';

const tools = getToolsRecordForVercelAI();

const result = await streamText({
  model: yourModel,
  tools,
  messages,
  system: buildSystemPrompt({ toolNames: ['set-deck-state'], mapState }),
});

for await (const part of result.fullStream) {
  if (part.type === 'tool-call') {
    ws.send(JSON.stringify({
      type: 'tool_call',
      toolName: part.toolName,
      data: part.args,
      callId: part.toolCallId,
    }));
  }
}
```

### OpenAI Agents SDK

```typescript
import { getToolsForOpenAIAgents } from '@carto/maps-ai-tools';

const toolDefs = getToolsForOpenAIAgents();
```

### Google ADK

```typescript
import { getToolsForGoogleADK } from '@carto/maps-ai-tools';

const toolDefs = getToolsForGoogleADK();
```

---

## Layer Types

### VectorTileLayer

For point, line, and polygon data from CARTO tables:

```json
{
  "@@type": "VectorTileLayer",
  "id": "airports-layer",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "carto-demo-data.demo_tables.airports",
    "columns": ["type"]
  },
  "getFillColor": [200, 100, 50, 180],
  "getPointRadius": 20,
  "pickable": true
}
```

### H3TileLayer

For hexagonal spatial aggregation (H3 index):

```json
{
  "@@type": "H3TileLayer",
  "id": "population-h3",
  "data": {
    "@@function": "h3TableSource",
    "tableName": "my_h3_table",
    "aggregationExp": "SUM(population) as population"
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
    "domain": [0, 1000, 10000, 100000],
    "colors": "Sunset"
  }
}
```

### QuadbinTileLayer

For square cell spatial aggregation (Quadbin index):

```json
{
  "@@type": "QuadbinTileLayer",
  "id": "sales-quadbin",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "my_quadbin_table",
    "aggregationExp": "SUM(sales) as sales"
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "sales",
    "domain": [0, 100, 1000, 10000],
    "colors": "PurpOr"
  },
  "extruded": true,
  "getElevation": "@@=properties.sales"
}
```

### Multi-Aggregation (3D with different metrics)

Use comma-separated aggregations when different visual channels need different metrics:

```json
{
  "@@type": "QuadbinTileLayer",
  "id": "population-3d",
  "data": {
    "@@function": "quadbinTableSource",
    "tableName": "my_table",
    "aggregationExp": "SUM(population) as population, SUM(male) as male"
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "population",
    "domain": [0, 1000, 10000],
    "colors": "Sunset"
  },
  "extruded": true,
  "getElevation": "@@=properties.male"
}
```

---

## Data Sources

### Table Sources

| Source | Use Case |
|--------|----------|
| `vectorTableSource` | Vector tiles from table |
| `h3TableSource` | H3 aggregated data (requires `aggregationExp`) |
| `quadbinTableSource` | Quadbin aggregated data (requires `aggregationExp`) |

### Query Sources

| Source | Use Case |
|--------|----------|
| `vectorQuerySource` | Vector tiles from SQL |
| `h3QuerySource` | H3 data from SQL |
| `quadbinQuerySource` | Quadbin data from SQL |

### Aggregation Expressions

For H3 and Quadbin layers, the alias must match the column name used in styling:

```
"aggregationExp": "SUM(population) as population"
"aggregationExp": "AVG(temperature) as temperature"
"aggregationExp": "COUNT(*) as count"
"aggregationExp": "MAX(revenue) as revenue"
```

For multiple aggregations (e.g., color by one metric, extrude by another):

```
"aggregationExp": "SUM(population) as population, AVG(income) as income"
```

### CARTO Column Filters

VectorTileLayer supports server-side column filtering to optimize tile size:

```json
{
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "my_table",
    "columns": ["population", "name", "type"]
  }
}
```

Only the listed columns will be included in the vector tiles. Required when using `@@=` expressions or `colorCategories`/`colorBins`/`colorContinuous` with VectorTileLayer.

---

## Color Styling

### Color Functions

#### colorBins (threshold-based)

```json
{
  "@@function": "colorBins",
  "attr": "population",
  "domain": [0, 100, 500, 1000, 5000],
  "colors": "Sunset"
}
```

#### colorCategories (categorical)

```json
{
  "@@function": "colorCategories",
  "attr": "type",
  "domain": ["residential", "commercial", "industrial"],
  "colors": "Bold"
}
```

#### colorContinuous (interpolation)

```json
{
  "@@function": "colorContinuous",
  "attr": "temperature",
  "domain": [0, 100],
  "colors": "Temps"
}
```

### Available Palettes

| Palette | Description |
|---------|-------------|
| `Sunset` | Orange to purple gradient |
| `Teal` | Cyan to dark teal |
| `PurpOr` | Purple to orange diverging |
| `Temps` | Blue to red temperature scale |
| `BluYl` | Blue to yellow |
| `Burg` | Burgundy shades |
| `PinkYl` | Pink to yellow |
| `RedOr` | Red to orange |
| `Bold` | Distinct categorical colors |

### Expressions (@@=)

For VectorTileLayer, use expressions for dynamic styling:

```json
{
  "getFillColor": "@@=properties.type === 'airport' ? [255, 0, 0, 200] : [128, 128, 128, 180]"
}
```

### deck.gl JSON Special Prefixes

- `@@type` -- Layer class (e.g., `"@@type": "VectorTileLayer"`)
- `@@function` -- Data source or styling function (e.g., `"@@function": "colorBins"`)
- `@@=` -- Accessor expression (e.g., `"@@=properties.population"`)
- `@@#` -- Constant reference (e.g., `"@@#Red"`)

---

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
                          DeckStateService updates state
                                       ↓
                DeckMapService.renderFromState() → JSONConverter → deck.gl
```

### Semantic Layer

The backend includes a **semantic layer** that provides the AI with structured knowledge about available data. It acts as a data catalog injected into the system prompt so the AI knows which tables exist, what columns they have, and how to visualize them.

**Configuration** is defined in YAML files (`semantic/layers/*.yaml`). Each file declares:

- **GeoCubes** -- data sources with their SQL table name, geometry type (point/polygon/h3/quadbin), dimensions, measures, and visualization hints
- **Business types** -- domain-specific context (relevant POIs, demographic factors)
- **Demographics and proximity priorities** -- available analysis dimensions
- **Initial view state and welcome message** -- app-level defaults

**How it works:**

```
YAML config → loadSemanticLayer() → renderSemanticLayerAsMarkdown()
    ↓
Injected into AI system prompt as structured markdown
    ↓
AI references table names, columns, and viz hints when generating tool calls
```

**Key types** (defined in `semantic/schema.ts`):

- `GeoCube` -- table definition with dimensions, measures, joins, and viz hints
- `GeoDimension` -- filterable/groupable column (name, sql, type)
- `GeoMeasure` -- aggregatable column (name, sql, aggregation type)
- `GeoVizHint` -- recommended styling (color function, palette, domain)
- `SemanticLayer` -- root config combining cubes, business context, and metadata

**Loader functions** (from `semantic/loader.ts`):

- `loadSemanticLayer()` -- reads first YAML from `semantic/layers/`
- `renderSemanticLayerAsMarkdown(layer)` -- converts to prompt-ready markdown
- `getPrimaryCube(layer)` -- returns the first cube
- `getInitialViewState(layer)` -- extracts map view from primary cube
- `getWelcomeMessage(layer)` -- returns welcome message string

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

### State Management

The Angular frontend uses `DeckStateService` (centralized reactive state with RxJS BehaviorSubjects):

```typescript
class DeckStateService {
  // View state (lat, lng, zoom, pitch, bearing)
  setViewState(partial: Partial<MapViewState> & { transitionDuration?: number }): void;

  // Deck configuration (layers, widgets, effects)
  setDeckConfig(config: DeckConfig): void;

  // Basemap style
  setBasemap(basemap: Basemap): void;

  // Active layer tracking
  setActiveLayerId(layerId: string): void;

  // Observables for reactive UI
  state$: Observable<StateChange>;
  layers$: Observable<LayerSpec[]>;
  viewState$: Observable<MapViewState>;
}
```

### Layer Merging

When updating layers, the executor deep-merges by ID:

```typescript
// Incoming update (partial)
{ "id": "my-layer", "getFillColor": { "colors": "Teal" } }

// Merged result (preserves existing properties)
{
  "id": "my-layer",
  "data": { ... },                    // Preserved
  "getFillColor": {
    "@@function": "colorBins",        // Preserved
    "attr": "population",             // Preserved
    "domain": [0, 100, 1000],         // Preserved
    "colors": "Teal"                  // Updated
  }
}
```

---

## API Reference

### Core Exports

```typescript
import {
  // Tool definitions
  tools,
  getToolNames,
  getTool,
  getToolDefinition,
  getAllToolDefinitions,
  getToolDefinitionsByNames,
  consolidatedToolNames,
  getConsolidatedToolDefinitions,

  // Validation
  validateToolParams,
  validateWithZod,

  // Tool type checking
  isSpecTool,
  isDataTool,
  getSpecTools,
  getDataTools,

  // AI SDK converters
  getToolsForVercelAI,
  getToolsRecordForVercelAI,
  getToolsForOpenAIAgents,
  getToolsForGoogleADK,
  isFrontendToolResult,
  parseFrontendToolResult,

  // System prompt builder
  buildSystemPrompt,
  toolPrompts,
  getToolPrompt,
  sharedSections,

  // Schemas
  deckGLJsonSpecSchema,
  layerSpecSchema,
  supportedLayerTypes,
  getLayerSpecSchema,

  // Response utilities
  parseToolResponse,
  successResponse,
  errorResponse,
  ErrorCodes,
} from '@carto/maps-ai-tools';
```

### Type Definitions

```typescript
type ToolName = 'set-deck-state';

type Basemap = 'dark-matter' | 'positron' | 'voyager';

interface DeckStateData {
  viewState: MapViewState;
  deckConfig: DeckConfig;
  basemap: Basemap;
  activeLayerId?: string;
  transitionDuration: number;
}

interface DeckConfig {
  layers: LayerSpec[];
  widgets: Record<string, unknown>[];
  effects: Record<string, unknown>[];
}

interface FrontendToolResult {
  __frontend_tool__: true;
  toolName: string;
  data: unknown;
}
```

---

## Examples

### Natural Language Commands

**Navigation:**
```
"Fly to San Francisco"
"Go to Madrid and zoom in"
"Show me Paris at zoom level 14"
"Rotate map 180 degrees with a very slow transition"
```

**Layer Creation:**
```
"Add a layer showing airports from carto-demo-data.demo_tables.airports"
"Create a population heatmap using H3 aggregation"
"Show sales by region using a quadbin layer"
```

**Styling:**
```
"Color the layer by population using the Sunset palette"
"Use colorBins with domain [0, 100, 1000, 10000]"
"Make it 3D with height based on population"
"Change the palette to Teal"
```

**Map Controls:**
```
"Switch to dark mode"
"Use the voyager basemap"
"Remove the airports layer"
"Reorder layers: put population on top"
```

---

## Development Commands

### Core Library

```bash
cd map-ai-tools
npm install && npm run build      # Build ESM + CJS to dist/
npm run dev                       # Watch mode
npm run type-check                # Type check without emitting
```

### Backend (Vercel AI SDK)

```bash
cd backend-integration/vercel-ai-sdk
npm run dev                       # Dev server with hot reload (port 3003)
npm run build                     # Compile TypeScript to dist/
npm run typecheck                 # Type check
```

### Frontend (Angular)

```bash
cd frontend-integration/angular
pnpm install                      # Install dependencies
pnpm start                        # Dev server (http://localhost:4200)
pnpm build                        # Production build
```

---

## Troubleshooting

### Layer Not Visible

- Check that `visible: true` is set (or not explicitly false)
- Verify the data source table name is correct
- For spatial index layers (H3/Quadbin), ensure `aggregationExp` is provided
- For VectorTileLayer with expressions, ensure required columns are in `data.columns`

### Colors Not Updating

- Include `updateTriggers` when using color functions:

  ```json
  "updateTriggers": {
    "getFillColor": { "colors": "Teal" }
  }
  ```

- Ensure `attr` matches the aggregation alias (e.g., `"attr": "population"` with `"SUM(population) as population"`)

### Transition Not Working

- Ensure `transitionDuration` is passed in `initialViewState` (not at the root level)
- Default transition is 1000ms when not specified

### WebSocket Connection Issues

- Ensure backend is running on the expected port
- Check CORS settings if frontend/backend are on different origins

---

## License

MIT
