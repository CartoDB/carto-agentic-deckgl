# React Integration Example - @carto/maps-ai-tools

A React application demonstrating how to integrate AI-powered map tools using the `@carto/maps-ai-tools` library. Users interact with a deck.gl map through natural language chat messages, which are processed by OpenAI to execute map manipulation commands client-side.

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **deck.gl** - WebGL-powered visualization
- **MapLibre GL** - Base map tiles
- **WebSocket** - Real-time communication with backend
- **@carto/maps-ai-tools** - Tool definitions and utilities

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Backend server running (see `../backend/`)

### Installation

```bash
# From repository root
cd integration-examples/frontend-react

# Install dependencies
pnpm install
```

### Environment Setup

The frontend connects to a WebSocket backend. The connection URL is configured in `src/config/constants.js`:

```javascript
export const WS_URL = 'ws://localhost:3000/ws';
```

### Running the Application

```bash
# Terminal 1: Start the backend (from repository root)
cd backend
pnpm install
cp .env.example .env  # Add your OPENAI_API_KEY
pnpm dev

# Terminal 2: Start the frontend
cd integration-examples/frontend-react
pnpm dev
```

Open http://localhost:5173 in your browser.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                            │
│  "Fly to New York" → ChatUI → WebSocket → Backend                   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js)                           │
│  WebSocket Server → OpenAI API (with tool definitions)              │
│                          │                                          │
│                          ▼                                          │
│  Streams response: { type: 'tool_call', tool: 'fly-to', ... }       │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                               │
│                                                                     │
│  useWebSocket ──► parseToolResponse() ──► executors[toolName]()    │
│       │                                          │                  │
│       │                                          ▼                  │
│       │                              ┌─────────────────────┐        │
│       │                              │   Tool Executor     │        │
│       │                              │   - deck.setProps() │        │
│       │                              │   - map.flyTo()     │        │
│       │                              │   - mapTools.*      │        │
│       │                              └─────────────────────┘        │
│       │                                          │                  │
│       ▼                                          ▼                  │
│  ChatUI displays                        Map updates visually        │
│  result message                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **App** | `src/App.jsx` | Main orchestrator, WebSocket handling, tool execution |
| **MapView** | `src/components/MapView.jsx` | deck.gl + MapLibre initialization |
| **ChatUI** | `src/components/ChatUI.jsx` | Chat interface and message display |
| **MapToolsContext** | `src/contexts/MapToolsContext.jsx` | Persistent layer state management |
| **useToolExecutors** | `src/hooks/useToolExecutors.js` | Creates tool executor functions |
| **useWebSocket** | `src/hooks/useWebSocket.js` | WebSocket connection management |

### File Structure

```
src/
├── App.jsx                    # Main app, orchestrates everything
├── components/
│   ├── ChatUI.jsx            # Chat interface
│   ├── MapView.jsx           # deck.gl + MapLibre setup
│   ├── ZoomControls.jsx      # Zoom buttons
│   ├── LayerToggle.jsx       # Layer visibility toggle
│   ├── Snackbar.jsx          # Notifications
│   └── ToolLoader.jsx        # Loading indicator
├── contexts/
│   └── MapToolsContext.jsx   # Persistent state management
├── hooks/
│   ├── useMessages.js        # Chat message state
│   ├── useWebSocket.js       # WebSocket connection
│   └── useToolExecutors.js   # Tool executor factory
├── services/
│   └── toolExecutors/
│       ├── index.js          # Executor registry
│       ├── viewExecutors.js  # fly-to, zoom-map
│       ├── layerExecutors.js # toggle-layer, set-point-color
│       ├── filterExecutors.js # query, filter, color features
│       ├── sizeExecutors.js  # size-features-by-property
│       └── aggregateExecutors.js # aggregate-features
├── config/
│   └── constants.js          # Configuration values
└── styles/
    └── main.css              # Styling
```

---

## Library API Reference

### Imports from @carto/maps-ai-tools

```javascript
import {
  TOOL_NAMES,           // Constants for tool names
  parseToolResponse,    // Parse backend responses
  getAllToolDefinitions, // Get OpenAI function definitions (backend)
  validateToolParams,   // Validate parameters with Zod
} from '@carto/maps-ai-tools';
```

### TOOL_NAMES

Constants for all available tool names:

```javascript
TOOL_NAMES.FLY_TO                    // 'fly-to'
TOOL_NAMES.ZOOM_MAP                  // 'zoom-map'
TOOL_NAMES.TOGGLE_LAYER              // 'toggle-layer'
TOOL_NAMES.SET_POINT_COLOR           // 'set-point-color'
TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY // 'color-features-by-property'
TOOL_NAMES.QUERY_FEATURES            // 'query-features'
TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY // 'filter-features-by-property'
TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY // 'size-features-by-property'
TOOL_NAMES.AGGREGATE_FEATURES        // 'aggregate-features'
```

### parseToolResponse(response)

Parses WebSocket tool call responses:

```javascript
const { toolName, data, error } = parseToolResponse(response);

if (error) {
  console.error(error.message);
  return;
}

// toolName: 'fly-to'
// data: { lat: 40.7128, lng: -74.0060, zoom: 12 }
```

---

## Built-in Tools Reference

### 1. fly-to

Navigate the map to specific coordinates.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | Yes | - | Latitude (-90 to 90) |
| `lng` | number | Yes | - | Longitude (-180 to 180) |
| `zoom` | number | No | 12 | Zoom level (0-22) |

**Example:**
```javascript
// Chat: "Fly to New York"
{ lat: 40.7128, lng: -74.0060, zoom: 12 }
```

### 2. zoom-map

Zoom the map in or out.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `direction` | 'in' \| 'out' | Yes | - | Zoom direction |
| `levels` | number | No | 1 | Number of zoom levels (1-10) |

**Example:**
```javascript
// Chat: "Zoom in 3 levels"
{ direction: 'in', levels: 3 }
```

### 3. toggle-layer

Show or hide a map layer.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerName` | string | Yes | - | Name of the layer |
| `visible` | boolean | Yes | - | Whether to show the layer |

**Example:**
```javascript
// Chat: "Hide the airports layer"
{ layerName: 'Airports', visible: false }
```

### 4. set-point-color

Set a uniform color for all points.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `r` | number | Yes | - | Red (0-255) |
| `g` | number | Yes | - | Green (0-255) |
| `b` | number | Yes | - | Blue (0-255) |
| `a` | number | No | 200 | Alpha (0-255) |

**Example:**
```javascript
// Chat: "Make all points blue"
{ r: 0, g: 100, b: 255, a: 200 }
```

### 5. color-features-by-property

Color features based on property values.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerId` | string | No | 'points-layer' | Target layer ID |
| `property` | string | Yes | - | Property to match |
| `operator` | string | No | 'equals' | Match operator |
| `value` | string | Yes | - | Value to match |
| `r`, `g`, `b`, `a` | number | Yes | - | Color (RGBA) |

**Operators:** `equals`, `startsWith`, `contains`, `regex`

**Example:**
```javascript
// Chat: "Color airports in California red"
{
  layerId: 'points-layer',
  property: 'state',
  operator: 'equals',
  value: 'CA',
  r: 255, g: 0, b: 0, a: 200
}
```

### 6. query-features

Query features and get statistics.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerId` | string | No | 'points-layer' | Target layer ID |
| `property` | string | Yes | - | Property to query |
| `operator` | string | No | 'equals' | Match operator |
| `value` | string | No | '' | Value to match |
| `includeNames` | boolean | No | false | Include sample names |

**Returns:** `{ count, total, sampleNames? }`

**Example:**
```javascript
// Chat: "How many airports are in Texas?"
{
  property: 'state',
  operator: 'equals',
  value: 'TX',
  includeNames: true
}
// Result: { count: 45, total: 500, sampleNames: ['DFW', 'IAH', 'AUS', ...] }
```

### 7. filter-features-by-property

Filter visible features by property value.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerId` | string | No | 'points-layer' | Target layer ID |
| `property` | string | Yes* | - | Property to filter |
| `operator` | string | No | 'equals' | Match operator |
| `value` | string | Yes* | - | Value to match |
| `reset` | boolean | No | false | Reset to show all |

*Required unless `reset: true`

**Example:**
```javascript
// Chat: "Show only large airports"
{ property: 'size', operator: 'equals', value: 'large' }

// Chat: "Show all airports again"
{ reset: true }
```

### 8. size-features-by-property

Size features based on property values.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerId` | string | No | 'points-layer' | Target layer ID |
| `property` | string | Yes* | - | Property for sizing |
| `sizeRules` | array | Yes* | - | Array of {value, size} |
| `defaultSize` | number | No | 8 | Default size in pixels |
| `reset` | boolean | No | false | Reset to uniform size |

**Example:**
```javascript
// Chat: "Make large airports bigger"
{
  property: 'size',
  sizeRules: [
    { value: 'large', size: 20 },
    { value: 'medium', size: 12 },
    { value: 'small', size: 6 }
  ],
  defaultSize: 8
}
```

### 9. aggregate-features

Group and count features by property.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerId` | string | No | 'points-layer' | Target layer ID |
| `groupBy` | string | Yes | - | Property to group by |

**Returns:** `{ groupBy, total, groups: [{value, count}] }`

**Example:**
```javascript
// Chat: "How many airports per state?"
{ groupBy: 'state' }
// Result: { groupBy: 'state', total: 500, groups: [
//   { value: 'CA', count: 50 },
//   { value: 'TX', count: 45 },
//   ...
// ]}
```

---

## Integration Guide: Step-by-Step

### Step 1: Import from the Library

```javascript
// App.jsx
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';
```

### Step 2: Create Tool Executors

Use the `useToolExecutors` hook to create executor functions:

```javascript
// hooks/useToolExecutors.js
import { useMemo } from 'react';
import { createAllExecutors } from '../services/toolExecutors';

export function useToolExecutors(mapInstances, mapTools) {
  return useMemo(() => {
    if (!mapInstances) return {};

    const { deck, map } = mapInstances;
    return createAllExecutors({ deck, map, mapTools });
  }, [mapInstances, mapTools]);
}
```

**Executor Context:**

Each executor receives a context object with:

| Property | Type | Description |
|----------|------|-------------|
| `deck` | Deck | deck.gl instance for layer manipulation |
| `map` | Map | MapLibre GL instance for view sync |
| `mapTools` | Object | Context for state persistence |

### Step 3: Handle WebSocket Tool Calls

```javascript
// App.jsx
const onToolCall = useCallback((response) => {
  // Parse the response
  const { toolName, data, error } = parseToolResponse(response);

  if (error) {
    showSnackbar(`Error: ${error.message}`);
    return;
  }

  // Look up and execute the tool
  const executor = executors[toolName];
  if (executor && data) {
    const result = executor(data);

    // Display result to user
    addMessage({
      type: 'action',
      content: result.success
        ? `✓ ${result.message}`
        : `✗ ${result.message}`,
    });
  }
}, [executors, addMessage, showSnackbar]);
```

### Step 4: Use MapToolsContext for State Persistence

The `MapToolsContext` persists layer state across tool executions:

```javascript
// In an executor
export function createToggleLayerExecutor({ deck, mapTools }) {
  return (params) => {
    // ... toggle layer visibility in deck.gl ...

    // Persist state in context
    mapTools.setLayerVisibility(layerId, params.visible);

    return { success: true, message: `Layer toggled` };
  };
}
```

**Available MapTools Methods:**

```javascript
// Layer registry
mapTools.registerLayer({ id, name, color, visible })
mapTools.getLayers()

// Visibility
mapTools.getLayerVisibility(layerId)
mapTools.setLayerVisibility(layerId, visible)

// Colors
mapTools.getLayerBaseColor(layerId)
mapTools.setLayerBaseColor(layerId, [r, g, b, a])
mapTools.addColorFilter(layerId, filter)
mapTools.createColorAccessor(layerId, defaultColor)

// Filters
mapTools.getActiveFilter(layerId)
mapTools.setActiveFilter(layerId, filter)
mapTools.clearActiveFilter(layerId)
mapTools.getOrSetOriginalData(layerId, data)

// Size rules
mapTools.mergeSizeRules(layerId, property, rules, defaultSize)
mapTools.createSizeAccessor(layerId, property)
mapTools.clearSizeRules(layerId)
```

---

## Adding a Custom Tool

Follow these steps to add a new tool to the system.

### Step 1: Define Tool in Library

Edit `map-ai-tools/src/definitions/tools.ts`:

```typescript
import { z } from 'zod';

export const tools = {
  // ... existing tools ...

  'highlight-feature': {
    name: 'highlight-feature',
    description: 'Highlight a specific feature by ID with a pulsing animation',
    schema: z.object({
      layerId: z.string().default('points-layer').describe('Target layer ID'),
      featureId: z.string().describe('ID of the feature to highlight'),
      color: z.object({
        r: z.number().min(0).max(255),
        g: z.number().min(0).max(255),
        b: z.number().min(0).max(255),
      }).describe('Highlight color'),
      duration: z.number().min(1000).max(10000).default(3000)
        .describe('Highlight duration in milliseconds'),
    }),
  },
};
```

### Step 2: Add Tool Name Constant

Edit `map-ai-tools/src/definitions/dictionary.ts`:

```typescript
export const TOOL_NAMES = {
  // ... existing names ...
  HIGHLIGHT_FEATURE: 'highlight-feature',
} as const;
```

### Step 3: Create Executor

Create `frontend-react/src/services/toolExecutors/highlightExecutors.js`:

```javascript
import { scheduleRedraws, updateLayer } from '../deckUtils';

export function createHighlightFeatureExecutor({ deck, mapTools }) {
  return (params) => {
    const { layerId, featureId, color, duration } = params;
    const highlightColor = [color.r, color.g, color.b, 255];

    const currentLayers = deck.props.layers || [];

    // Store original color
    const originalColor = mapTools.getLayerBaseColor(layerId);

    // Apply highlight
    const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
      layer.clone({
        getFillColor: (feature) =>
          feature.properties.id === featureId
            ? highlightColor
            : originalColor,
        updateTriggers: {
          getFillColor: `highlight-${featureId}-${Date.now()}`
        },
      })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, { immediate: true, delays: [50] });

    // Remove highlight after duration
    setTimeout(() => {
      const resetLayers = updateLayer(deck.props.layers, layerId, (layer) =>
        layer.clone({
          getFillColor: originalColor,
          updateTriggers: { getFillColor: 'reset' },
        })
      );
      deck.setProps({ layers: resetLayers });
      scheduleRedraws(deck, { immediate: true });
    }, duration);

    return {
      success: true,
      message: `Highlighting feature ${featureId} for ${duration}ms`,
    };
  };
}
```

### Step 4: Register Executor

Edit `frontend-react/src/services/toolExecutors/index.js`:

```javascript
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { createHighlightFeatureExecutor } from './highlightExecutors';

export function createDefaultRegistry() {
  return createExecutorRegistry()
    // ... existing registrations ...
    .register(TOOL_NAMES.HIGHLIGHT_FEATURE, createHighlightFeatureExecutor);
}

// Export for custom registries
export { createHighlightFeatureExecutor } from './highlightExecutors';
```

### Step 5: Test the Tool

Try these chat messages:
- "Highlight the airport with ID 'JFK'"
- "Highlight LAX in red for 5 seconds"

---

## Key Patterns

### Executor Registry Pattern

Follows the Open/Closed Principle - add new tools without modifying existing code:

```javascript
const registry = createExecutorRegistry()
  .register(TOOL_NAMES.FLY_TO, createFlyToExecutor)
  .register(TOOL_NAMES.ZOOM_MAP, createZoomMapExecutor)
  // Add new tools here
  .register(TOOL_NAMES.MY_NEW_TOOL, createMyNewToolExecutor);

const executors = registry.createExecutors(context);
```

### Redraw Scheduling

deck.gl requires explicit redraws after updates:

```javascript
import { scheduleRedraws, REDRAW_PRESETS } from '../deckUtils';

// After updating deck.gl
scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

// Available presets:
// - instant: immediate redraw only
// - short: immediate + 50ms + 600ms
// - flyTo: immediate + 50ms + 1100ms (for transitions)
// - dataUpdate: immediate + 50ms
```

### deck.gl + MapLibre Synchronization

Keep both map libraries in sync:

```javascript
import { syncMapLibreView } from '../deckUtils';

// After updating deck.gl view state
syncMapLibreView(map, {
  longitude: lng,
  latitude: lat,
  zoom: newZoom,
}, { animate: true, duration: 1000 });
```

---

## Troubleshooting

### WebSocket Connection Fails

- Ensure backend is running on `localhost:3000`
- Check browser console for connection errors
- Verify `WS_URL` in `src/config/constants.js`

### Tools Not Executing

- Check that `mapInstances` is set (map initialized)
- Verify executor is registered in `createDefaultRegistry()`
- Check browser console for parsing errors

### Map Not Updating Visually

- Ensure `scheduleRedraws()` is called after deck.setProps()
- Check that `updateTriggers` are set for accessor functions
- Verify layer ID matches registered layer

### Layer Visibility Issues

- Use `mapTools.setLayerVisibility()` to persist state
- Check that `visible` property is being cloned correctly
- Verify layer exists with `layerExists(layers, layerId)`

---

## API Types Reference

### Executor Return Type

```typescript
interface ExecutorResult {
  success: boolean;
  message: string;
  data?: {
    count?: number;
    total?: number;
    groups?: Array<{ value: string; count: number }>;
    sampleNames?: string[];
  };
}
```

### Executor Factory Signature

```typescript
type ExecutorFactory = (context: ExecutorContext) => Executor;

interface ExecutorContext {
  deck: Deck;           // deck.gl instance
  map: Map;             // MapLibre GL instance
  mapTools: MapTools;   // State management context
}

type Executor = (params: ToolParams) => ExecutorResult;
```

### Tool Parameter Types

See the [Built-in Tools Reference](#built-in-tools-reference) section for parameter types of each tool.

---

## Related Documentation

- [deck.gl Documentation](https://deck.gl/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Zod Documentation](https://zod.dev/)
