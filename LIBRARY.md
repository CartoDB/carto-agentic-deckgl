# @carto/agentic-deckgl

Isomorphic JavaScript library for AI-powered map controls using OpenAI function calling and deck.gl.

## Installation

```bash
npm install @carto/agentic-deckgl
```

## Features

- **Isomorphic** - Works in both Node.js and browser environments
- **Type-safe** - Full TypeScript support with Zod validation
- **Consolidated Tools** - Tools for complete map control (deck.gl state, marker placement, spatial mask filtering)
- **Prompts Module** - Built-in system prompt generation for AI agents
- **Tree-shakeable** - Import only what you need via subpath exports

## Subpath Exports

```typescript
// Main entry - all exports
import { ... } from '@carto/agentic-deckgl';

// Specific modules
import { ... } from '@carto/agentic-deckgl/definitions';
import { ... } from '@carto/agentic-deckgl/prompts';
import { ... } from '@carto/agentic-deckgl/schemas';
import { ... } from '@carto/agentic-deckgl/executors';
import { ... } from '@carto/agentic-deckgl/converters';
```

## Quick Start

### Backend (Node.js)

```typescript
import {
  getConsolidatedToolDefinitions,
  buildSystemPrompt,
  TOOL_NAMES,
} from '@carto/agentic-deckgl';

// Get tool definitions for OpenAI
const tools = getConsolidatedToolDefinitions();

// Build system prompt with current map state
const systemPrompt = buildSystemPrompt({
  toolNames: [
    TOOL_NAMES.SET_DECK_STATE,
    TOOL_NAMES.SET_MARKER,
    TOOL_NAMES.SET_MASK_LAYER,
  ],
  initialState: {
    viewState: { latitude: 40.7128, longitude: -74.006, zoom: 12 },
    layers: [{ id: 'my-layer', type: 'VectorTileLayer', visible: true }],
    activeLayerId: 'my-layer',
  },
  userContext: {
    country: 'United States',
    businessType: 'Retail',
  },
});

// Use with OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Add a layer showing population density' },
  ],
  tools,
});
```

### Frontend (Browser)

```typescript
import { parseToolResponse, isSuccessResponse } from '@carto/agentic-deckgl';

// Execute tools from WebSocket
websocket.on('tool_call', async (message) => {
  const result = await executeToolOnMap(message.tool, message.parameters);
  const parsed = parseToolResponse(result);

  if (isSuccessResponse(parsed)) {
    console.log('Success:', parsed.message);
  }
});
```

## Consolidated Tools

The library provides 3 consolidated tools for complete map control:

| Tool | Description |
| --- | --- |
| `set-deck-state` | Full deck.gl state control (navigation, basemap, layers, widgets, effects) |
| `set-marker` | Place a location marker pin at specified coordinates |
| `set-mask-layer` | Editable mask layer for spatial filtering (set geometry or table name, draw mode, or clear) |

### Tool Names

```typescript
import { TOOL_NAMES } from '@carto/agentic-deckgl';

TOOL_NAMES.SET_DECK_STATE  // 'set-deck-state'
TOOL_NAMES.SET_MARKER      // 'set-marker'
TOOL_NAMES.SET_MASK_LAYER  // 'set-mask-layer'
```

## Prompts Module

The prompts module provides system prompt generation for AI agents controlling deck.gl maps.

### Building System Prompts

```typescript
import {
  buildSystemPrompt,
  type BuildSystemPromptOptions,
} from '@carto/agentic-deckgl';

const options: BuildSystemPromptOptions = {
  // Required: list of available tool names
  toolNames: ['set-deck-state', 'set-marker', 'set-mask-layer'],

  // Optional: current map state for context
  initialState: {
    viewState: { latitude: 40.7128, longitude: -74.006, zoom: 12 },
    layers: [{ id: 'population-layer', type: 'H3TileLayer', visible: true }],
    activeLayerId: 'population-layer',
  },

  // Optional: user context for business analysis
  userContext: {
    country: 'United States',
    businessType: 'Restaurant',
    demographics: ['millennials', 'urban professionals'],
    proximityPriorities: [
      { name: 'Public Transit', weight: 8 },
      { name: 'Foot Traffic', weight: 7 },
    ],
  },

  // Optional: pre-rendered semantic context (app-specific)
  semanticContext: '## Available Data Tables\n...',

  // Optional: MCP tool names (enables MCP instructions)
  mcpToolNames: ['pois_filter', 'async_workflow_job_get_status_v1_0_0'],

  // Optional: additional prompt text
  additionalPrompt: 'Focus on data visualization.',
};

const prompt = buildSystemPrompt(options);
```

### Accessing Tool Prompts

```typescript
import {
  toolPrompts,
  getToolPrompt,
  getToolPrompts,
} from '@carto/agentic-deckgl';

// Get a single tool's prompt
const deckStatePrompt = getToolPrompt('set-deck-state');

// Get prompts for multiple tools
const combinedPrompts = getToolPrompts(['set-map-view', 'set-deck-state']);

// Access all tool prompts
console.log(Object.keys(toolPrompts));
// ['set-deck-state', 'set-marker', 'set-mask-layer']
```

### Shared Sections

```typescript
import { sharedSections, getSharedSection } from '@carto/agentic-deckgl';

// Access specific sections
const workflows = getSharedSection('workflowPatterns');
const guidelines = getSharedSection('guidelines');
const mcpInstructions = getSharedSection('mcpInstructions');

// Available sections
console.log(Object.keys(sharedSections));
// ['colorPalettes', 'layerIdRules', 'updateTriggers', 'workflowPatterns',
//  'guidelines', 'mcpInstructions', 'mcpPoisFilter', 'mcpAsyncWorkflow',
//  'mcpAsyncUnavailable', 'mcpCriticalRules']
```

### Helper Functions

```typescript
import {
  buildMapStateSection,
  buildUserContextSection,
} from '@carto/agentic-deckgl';

// Build just the map state section
const mapSection = buildMapStateSection({
  viewState: { latitude: 40.7128, longitude: -74.006, zoom: 12 },
  layers: [{ id: 'layer-1', type: 'VectorTileLayer' }],
  activeLayerId: 'layer-1',
});

// Build just the user context section
const userSection = buildUserContextSection({
  country: 'Spain',
  businessType: 'Retail',
});
```

## Schema Validation

```typescript
import {
  validateToolParams,
  deckGLJsonSpecSchema,
  layerSpecSchema,
} from '@carto/agentic-deckgl';

// Validate tool parameters
const result = validateToolParams('set-map-view', {
  latitude: 40.7128,
  longitude: -74.006,
  zoom: 12,
});

if (result.success) {
  console.log('Valid params:', result.data);
} else {
  console.error('Validation errors:', result.errors);
}
```

## SDK Converters

Convert tool definitions for different AI SDKs:

```typescript
import {
  getToolsForOpenAIAgents,
  getToolsForVercelAI,
  getToolsForGoogleADK,
} from '@carto/agentic-deckgl';

// For OpenAI Agents SDK
const openaiTools = getToolsForOpenAIAgents();

// For Vercel AI SDK
const vercelTools = getToolsForVercelAI();

// For Google ADK
const googleTools = getToolsForGoogleADK();
```

## Types

```typescript
import type {
  // Prompt types
  ToolPromptConfig,
  MapViewState,
  LayerState,
  MapState,
  UserContext,
  BuildSystemPromptOptions,

  // Tool types
  ToolName,
  ToolNameValue,

  // Response types
  ToolResponse,
  ParsedToolResponse,
} from '@carto/agentic-deckgl';
```

## Architecture

```
@carto/agentic-deckgl/
├── definitions/     # Tool definitions with Zod schemas
├── prompts/         # System prompt generation
│   ├── types.ts     # Type definitions
│   ├── tool-prompts.ts    # Tool-specific prompts
│   ├── shared-sections.ts # Reusable prompt sections
│   └── builder.ts   # buildSystemPrompt() function
├── schemas/         # deck.gl JSON schemas
├── executors/       # Response formatting utilities
├── converters/      # SDK-specific converters
└── utils/           # Response parsing utilities
```

## License

MIT
