# @carto/map-ai-tools

> A framework-agnostic TypeScript library for AI-powered map controls. Enables natural language interaction with deck.gl maps using LLM function calling.

## Overview

`@carto/map-ai-tools` provides a set of tools that allow AI agents to control interactive maps through natural language. The library uses a "teach the agent deck.gl" pattern where the AI generates deck.gl JSON specifications that are executed on the frontend.

**Key Features:**

- **6 Consolidated Tools**: Complete map control with minimal complexity
- **Framework Agnostic**: Works with Vercel AI SDK, OpenAI Agents, Google ADK
- **Type-Safe**: Full TypeScript support with Zod validation
- **CARTO Integration**: Native support for CARTO data sources and spatial indexes
- **Streaming Support**: Real-time tool execution with WebSocket communication

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Available Tools](#available-tools)
- [Integration Guide](#integration-guide)
  - [Vercel AI SDK](#vercel-ai-sdk)
  - [OpenAI Agents SDK](#openai-agents-sdk)
  - [Google ADK](#google-adk)
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
cd ../../frontend-integration/vanilla
npm install
```

### Environment Setup

Create `.env` file in your backend directory:

```env
# Required
OPENAI_API_KEY=sk-proj-your-key-here

# CARTO credentials (for data layers)
CARTO_ACCESS_TOKEN=your-carto-token
CARTO_API_BASE_URL=https://gcp-us-east1.api.carto.com
CARTO_CONNECTION_NAME=carto_dw
```

### Running the Demo

```bash
# Terminal 1: Start backend
cd backend-integration/vercel-ai-sdk
npm run dev

# Terminal 2: Start frontend
cd frontend-integration/vanilla
npm run dev
```

Open http://localhost:5173 and start chatting with the map.

---

## Project Structure

```
ps-frontend-tools-poc/
├── map-ai-tools/                    # Core library
│   ├── src/
│   │   ├── definitions/             # Tool definitions with Zod schemas
│   │   │   └── tools.ts             # 6 consolidated tools
│   │   ├── converters/              # AI framework adapters
│   │   │   └── agentic-sdks.ts      # Vercel, OpenAI, Google converters
│   │   ├── schemas/                 # deck.gl JSON schemas
│   │   │   ├── layer-specs.ts       # Layer type schemas
│   │   │   └── initial-state.ts     # Map state schema
│   │   └── core/                    # Validation utilities
│   └── dist/                        # Built ESM + CJS outputs
│
├── backend-integration/
│   └── vercel-ai-sdk/               # Vercel AI SDK backend
│       ├── src/
│       │   ├── prompts/             # System prompts for AI
│       │   ├── services/            # Agent runner, WebSocket
│       │   └── agent/               # Tool definitions
│       └── server.ts                # Express + WebSocket server
│
└── frontend-integration/
    ├── vanilla/                     # Vanilla TypeScript
    ├── react/                       # React 19
    └── vue/                         # Vue 3
```

---

## Available Tools

The library provides 6 consolidated tools that give AI complete control over the map:

| Tool | Type | Description |
|------|------|-------------|
| `geocode` | data | Convert place names to coordinates |
| `set-map-view` | spec | Navigate to coordinates with zoom/pitch/bearing |
| `set-basemap` | spec | Change basemap style (dark-matter, positron, voyager) |
| `set-deck-state` | spec | Add/update layers, widgets, and effects |
| `take-map-screenshot` | data | Capture current map view as image |
| `carto-query` | data | Execute SQL queries against CARTO DW |

### Tool Details

#### `geocode`
```typescript
{
  query: string  // "New York City", "123 Main St, Boston"
}
// Returns: { lat, lng, display_name }
```

#### `set-map-view`
```typescript
{
  latitude: number,      // -90 to 90
  longitude: number,     // -180 to 180
  zoom: number,          // 0 to 22
  pitch?: number,        // 0 to 85 degrees
  bearing?: number,      // -180 to 180 degrees
  transitionDuration?: number  // milliseconds
}
```

#### `set-basemap`
```typescript
{
  basemap: 'dark-matter' | 'positron' | 'voyager'
}
```

#### `set-deck-state`
The most powerful tool - accepts deck.gl JSON specifications:

```typescript
{
  layers?: Array<{
    '@@type': string,           // Layer type
    id: string,                 // Unique identifier
    data: object,               // Data source configuration
    getFillColor?: any,         // Color accessor
    // ... other deck.gl properties
  }>,
  widgets?: Array<object>,
  effects?: Array<object>
}
```

#### `carto-query`
```typescript
{
  sql: string,                    // SQL query
  connectionName?: string,        // Default: 'carto_dw'
  format?: 'geojson' | 'json'     // Default: 'geojson'
}
```

---

## Integration Guide

### Vercel AI SDK

The library provides native Vercel AI SDK v4 support:

```typescript
import { streamText } from 'ai';
import { getToolsRecordForVercelAI } from '@carto/map-ai-tools';

// Get tools in Vercel AI SDK format
const tools = getToolsRecordForVercelAI();

// Use with streamText
const result = await streamText({
  model: openai('gpt-4o'),
  tools,
  messages,
  system: buildSystemPrompt(toolNames, initialState),
});

// Handle tool results
for await (const part of result.fullStream) {
  if (part.type === 'tool-call') {
    // Tool calls are marked for frontend execution
    // Send to frontend via WebSocket
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
import { tool } from '@openai/agents';
import { getToolsForOpenAIAgents } from '@carto/map-ai-tools';

// Get tool definitions
const toolDefs = getToolsForOpenAIAgents();

// Convert to OpenAI agent tools
const agentTools = toolDefs.map(def => tool(def));
```

### Google ADK

```typescript
import { FunctionTool } from '@google/adk';
import { getToolsForGoogleADK } from '@carto/map-ai-tools';

// Get tool definitions
const toolDefs = getToolsForGoogleADK();

// Convert to ADK tools
const adkTools = toolDefs.map(def => new FunctionTool(def));
```

---

## Layer Types

The library supports multiple deck.gl layer types optimized for CARTO data:

### VectorTileLayer
For point, line, and polygon data from CARTO tables:

```json
{
  "@@type": "VectorTileLayer",
  "id": "airports-layer",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "carto-demo-data.demo_tables.airports"
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
    "aggregationExp": "SUM(population) as value"
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
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
    "aggregationExp": "SUM(sales) as value"
  },
  "getFillColor": {
    "@@function": "colorBins",
    "attr": "value",
    "domain": [0, 100, 1000, 10000],
    "colors": "PurpOr"
  },
  "extruded": true,
  "getElevation": "@@=properties.value"
}
```

---

## Data Sources

### Table Sources
Load data from CARTO tables:

| Source | Use Case |
|--------|----------|
| `vectorTableSource` | Vector tiles from table |
| `h3TableSource` | H3 aggregated data (requires `aggregationExp`) |
| `quadbinTableSource` | Quadbin aggregated data (requires `aggregationExp`) |

### Query Sources
Load data from SQL queries:

| Source | Use Case |
|--------|----------|
| `vectorQuerySource` | Vector tiles from SQL |
| `h3QuerySource` | H3 data from SQL |
| `quadbinQuerySource` | Quadbin data from SQL |

### Aggregation Expressions

For H3 and Quadbin layers, you must specify an aggregation:

```
"aggregationExp": "SUM(population) as value"
"aggregationExp": "AVG(temperature) as value"
"aggregationExp": "COUNT(*) as value"
"aggregationExp": "MAX(revenue) as value"
```

---

## Color Styling

### Color Functions

#### colorBins (threshold-based)
Discrete color breaks for numeric data:

```json
{
  "@@function": "colorBins",
  "attr": "value",
  "domain": [0, 100, 500, 1000, 5000],
  "colors": "Sunset"
}
```

#### colorCategories (categorical)
Map categories to colors:

```json
{
  "@@function": "colorCategories",
  "attr": "category",
  "domain": ["A", "B", "C", "D"],
  "colors": "Bold"
}
```

#### colorContinuous (interpolation)
Smooth color gradient:

```json
{
  "@@function": "colorContinuous",
  "attr": "value",
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

**Important**: When using `@@=` expressions, include the column in `data.columns`:

```json
{
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "my_table",
    "columns": ["type"]
  }
}
```

---

## Architecture

### Communication Flow

```
┌─────────────┐     WebSocket      ┌─────────────┐
│   Frontend  │◄──────────────────►│   Backend   │
│  (deck.gl)  │                    │  (Node.js)  │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ Tool Execution                   │ LLM API
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  DeckState  │                    │   OpenAI    │
│   Manager   │                    │   GPT-4o    │
└─────────────┘                    └─────────────┘
```

### State Management

The frontend uses a centralized `DeckState` class:

```typescript
class DeckState {
  // View state (lat, lng, zoom, pitch, bearing)
  setViewState(partial: Partial<MapViewState>): void;

  // Deck configuration (layers, widgets, effects)
  setDeckConfig(config: DeckConfig): void;

  // Active layer tracking
  setActiveLayerId(layerId: string): void;

  // Subscribe to changes
  subscribe(listener: ChangeListener): () => void;
}
```

### Layer Merging

When updating layers, the library uses deep merge:

```typescript
// Incoming update
{ "id": "my-layer", "getFillColor": { "colors": "Teal" } }

// Merged result (preserves existing properties)
{
  "id": "my-layer",
  "data": { ... },  // Preserved
  "getFillColor": {
    "@@function": "colorBins",  // Preserved
    "attr": "value",            // Preserved
    "domain": [0, 100, 1000],   // Preserved
    "colors": "Teal"            // Updated
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
  getAllToolDefinitions,
  getConsolidatedToolDefinitions,

  // Validation
  validateToolParams,
  validateWithZod,

  // Tool type checking
  isSpecTool,
  isDataTool,

  // AI SDK converters
  getToolsForVercelAI,
  getToolsRecordForVercelAI,
  getToolsForOpenAIAgents,
  getToolsForGoogleADK,

  // Frontend tool detection
  isFrontendToolResult,
  parseFrontendToolResult,

  // Layer schemas
  supportedLayerTypes,
  getLayerSpecSchema,
} from '@carto/map-ai-tools';
```

### Type Definitions

```typescript
type ToolName =
  | 'geocode'
  | 'set-map-view'
  | 'set-basemap'
  | 'set-deck-state'
  | 'take-map-screenshot'
  | 'carto-query';

interface FrontendToolResult {
  __frontend_tool__: true;
  toolName: string;
  data: unknown;
}

type SupportedLayerType =
  | 'VectorTileLayer'
  | 'H3TileLayer'
  | 'QuadbinTileLayer'
  | 'GeoJsonLayer'
  | 'ScatterplotLayer'
  | 'PathLayer'
  | 'ArcLayer';
```

---

## Examples

### Natural Language Commands

**Navigation:**
```
"Fly to San Francisco"
"Go to Madrid and zoom in"
"Show me Paris at zoom level 14"
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
"Make it 3D with height based on value"
"Change the palette to Teal"
```

**Data Queries:**
```
"How many points are in the layer?"
"What's the average population by state?"
"Show me the top 10 cities by population"
```

### Programmatic Usage

```typescript
import { createConsolidatedExecutors } from './executors';

// Create executors with context
const executors = createConsolidatedExecutors({
  deckState,
  zoomControls,
  layerToggle,
  toolStatus,
  chatContainer,
});

// Execute a tool
const result = await executors['set-deck-state']({
  layers: [{
    '@@type': 'VectorTileLayer',
    id: 'my-layer',
    data: {
      '@@function': 'vectorTableSource',
      tableName: 'my_table'
    },
    getFillColor: [255, 0, 0, 200]
  }]
});
```

---

## Troubleshooting

### Layer Not Visible
- Check that `visible: true` is set (or not explicitly false)
- Verify the data source table name is correct
- For spatial index layers (H3/Quadbin), ensure `aggregationExp` is provided

### Colors Not Updating
- Include `updateTriggers` when using color functions:
  ```json
  "updateTriggers": {
    "getFillColor": { "colors": "Teal" }
  }
  ```

### Layer Duplication
- When updating a layer, use the **same ID** as the original
- The AI is instructed to use the "active layer" when no layer is specified

### WebSocket Connection Issues
- Ensure backend is running on the expected port
- Check CORS settings if frontend/backend are on different origins

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
