# Update backend-vercel-ai to Use Consolidated Tools

## Goal
Synchronize `backend-vercel-ai` with `map-ai-tools` by updating it to consume the consolidated tools pattern (6 tools instead of 40+).

## Current State
- **map-ai-tools**: Has `consolidatedToolNames` and `getConsolidatedToolDefinitions()` defined but NOT exported from main index
- **backend-vercel-ai**: Uses `getToolsForVercelAI()` without filtering → gets ALL 40+ tools
- **frontend-vanilla**: Already refactored to use consolidated tools with executors

---

## Phase 1: Export Consolidated Tools from map-ai-tools

### File: `map-ai-tools/src/definitions/index.ts`

Add exports for consolidated tools:

```typescript
export {
  // ... existing exports ...
  consolidatedToolNames,
  getConsolidatedToolDefinitions,
} from './tools';
```

### File: `map-ai-tools/src/index.ts`

Add re-exports:

```typescript
export {
  // ... existing exports ...
  consolidatedToolNames,
  getConsolidatedToolDefinitions,
} from './definitions';
```

---

## Phase 2: Update backend-vercel-ai/src/agent/tools.ts

Change from using all tools to using only consolidated tools:

```typescript
import { tool, type Tool } from 'ai';
import {
  getToolsForVercelAI,
  consolidatedToolNames,  // NEW
  isFrontendToolResult,
  type VercelAIToolDef,
  type ToolName,
} from '@carto/maps-ai-tools';
import { getMCPTools, getMCPToolNames } from './mcp-tools.js';

/**
 * Create local map tools for Vercel AI SDK v6
 * Uses CONSOLIDATED tools pattern (6 tools instead of 40+)
 */
export function createMapTools(): Record<string, Tool> {
  // Pass consolidated tool names to filter
  const toolDefs = getToolsForVercelAI(consolidatedToolNames as ToolName[]);

  return Object.fromEntries(
    toolDefs.map((def: VercelAIToolDef & { name: string }) => [
      def.name,
      tool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: def.execute,
      }),
    ])
  );
}

/**
 * Get all tool names for system prompt
 */
export function getAllToolNames(): string[] {
  const localNames = consolidatedToolNames;  // Use consolidated list
  const mcpNames = getMCPToolNames();
  return [...new Set([...localNames, ...mcpNames])];
}

/**
 * Get local tool names only (consolidated)
 */
export function getToolNames(): string[] {
  return [...consolidatedToolNames];
}
```

---

## Phase 3: Update System Prompt for Consolidated Tools

### File: `backend-vercel-ai/src/prompts/system-prompt.ts`

Replace the current prompt with guidance for the 6 consolidated tools:

```typescript
export function buildSystemPrompt(
  toolNames: string[],
  initialState?: InitialState
): string {
  let prompt = `You are a helpful map assistant that controls an interactive deck.gl map visualization.

## AVAILABLE TOOLS

You have 6 consolidated tools for complete map control:

### 1. geocode
Get coordinates for any place name.
- Input: { query: "New York City" }
- Output: { lat, lng, display_name }

### 2. set-map-view
Navigate the map to specific coordinates.
- Input: { latitude, longitude, zoom, pitch?, bearing? }
- Use after geocode to fly to a location

### 3. set-basemap
Change the map style.
- Options: "dark-matter", "positron", "voyager"

### 4. set-deck-state ⭐ MOST POWERFUL
Set complete visualization state with deck.gl JSON format.
This REPLACES all existing layers - include all layers you want to keep.

Layer example:
{
  "@@type": "VectorTileLayer",
  "id": "my-layer",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "carto-demo-data.demo_tables.airports"
  },
  "getFillColor": [200, 100, 50, 180],
  "getLineColor": [255, 255, 255],
  "getPointRadius": 500
}

For styling by property, use colorCategories/colorBins:
{
  "@@type": "VectorTileLayer",
  "id": "styled-layer",
  "data": { "@@function": "vectorTableSource", "tableName": "..." },
  "getFillColor": {
    "@@function": "colorCategories",
    "attr": "type",
    "domain": ["airport", "heliport"],
    "colors": [[255,0,0], [0,255,0]]
  }
}

### 5. take-map-screenshot
Capture current map view for analysis.
- Input: { reason: "why capturing" }

### 6. carto-query
Execute SQL against CARTO Data Warehouse.
- Input: { sql: "SELECT * FROM ...", connectionName?, format? }
- Use for data exploration before creating layers

## WORKFLOW PATTERNS

**Navigate to a place:**
1. geocode({ query: "Paris" }) → get coordinates
2. set-map-view({ latitude: 48.8566, longitude: 2.3522, zoom: 12 })

**Add a data layer:**
1. set-deck-state with layer configuration
2. Layer appears immediately on map

**Style a layer by property:**
1. Use colorCategories or colorBins in getFillColor
2. Include in set-deck-state call

**Change multiple things:**
1. Call set-deck-state once with all layers you want
2. Include viewState changes via set-map-view

## CRITICAL GUIDELINES

1. set-deck-state REPLACES all layers - always include existing layers you want to keep
2. Use present tense: "Adding layer..." not "Added layer"
3. Frontend tools execute AFTER your response - never claim success prematurely
4. For CARTO data sources, credentials are auto-injected - just provide tableName

`;

  // Add current state context
  if (initialState) {
    prompt += `\n## CURRENT MAP STATE\n`;
    const vs = initialState.viewState || initialState.initialViewState;
    if (vs) {
      prompt += `- Position: lat=${vs.latitude.toFixed(4)}, lng=${vs.longitude.toFixed(4)}, zoom=${vs.zoom.toFixed(1)}\n`;
    }
    if (initialState.layers?.length > 0) {
      prompt += `- Layers: ${initialState.layers.map(l => l.id).join(', ')}\n`;
    }
  }

  // Add MCP tool guidance if available
  const hasAsyncWorkflowTools = toolNames.some(t => t.includes('async_workflow'));
  if (hasAsyncWorkflowTools) {
    prompt += `\n## MCP TOOLS\nMCP tools are also available for remote data operations. Poll async jobs until "done".\n`;
  }

  return prompt;
}
```

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `map-ai-tools/src/definitions/index.ts` | MODIFY | Export `consolidatedToolNames`, `getConsolidatedToolDefinitions` |
| `map-ai-tools/src/index.ts` | MODIFY | Re-export consolidated tools from definitions |
| `backend-vercel-ai/src/agent/tools.ts` | MODIFY | Use `consolidatedToolNames` filter |
| `backend-vercel-ai/src/prompts/system-prompt.ts` | MODIFY | Rewrite for 6-tool pattern |

---

## Tool Mapping (for reference)

| Consolidated Tool | Replaces |
|-------------------|----------|
| `geocode` | (new capability) |
| `set-map-view` | fly-to, zoom-map, set-view-state, rotate-map, set-pitch |
| `set-basemap` | (new capability) |
| `set-deck-state` | toggle-layer, add-layer, add-vector-layer, remove-layer, update-layer-style, set-point-color, color-features-by-property, filter-features-by-property |
| `take-map-screenshot` | (new capability) |
| `carto-query` | query-features, aggregate-features |

---

## Verification Plan

1. **Build map-ai-tools**
   ```bash
   cd map-ai-tools && npm run build
   ```

2. **Build backend-vercel-ai**
   ```bash
   cd backend-vercel-ai && npm run build
   ```

3. **Integration Test**
   - Start backend: `cd backend-vercel-ai && npm run dev`
   - Start frontend: `cd integration-examples/frontend-vanilla && npm run dev`
   - Test via chat:
     - "Show me Paris" → geocode + set-map-view
     - "Add airports layer" → set-deck-state with VectorTileLayer
     - "Change basemap to dark" → set-basemap
     - "Color airports by type" → set-deck-state with colorCategories
