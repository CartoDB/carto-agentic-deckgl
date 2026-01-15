# React Integration Example - @carto/maps-ai-tools

A React application demonstrating how to integrate AI-powered map tools using the `@carto/maps-ai-tools` library. Users interact with a deck.gl map through natural language chat messages, which are processed by OpenAI to execute map manipulation commands client-side.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Backend server running (see `../backend/`)

### Installation

```bash
cd integration-examples/frontend-react
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
User Message → ChatUI → WebSocket → Backend (OpenAI)
                                        ↓
                    Tool call response (e.g., fly-to, zoom-map)
                                        ↓
            useMapAITools hook → parseToolResponse → executor
                                        ↓
                              Map updates visually
```

---

## Using the useMapAITools Hook

The `useMapAITools` hook consolidates all integration logic for AI-powered map tools.

### Import

```javascript
import { useMapAITools } from './hooks';
```

### Usage

```javascript
const {
  isConnected,    // WebSocket connection status
  messages,       // Chat messages array
  loaderState,    // 'thinking' | 'executing' | null
  sendMessage,    // Send chat message function
  executors,      // Tool executor functions (for UI controls)
} = useMapAITools({
  wsUrl: WS_URL,           // WebSocket server URL
  mapInstances,            // { deck, map } from MapView
  mapTools,                // Context from useMapTools()
  onError: showSnackbar,   // Error callback (optional)
});
```

### Example: Minimal Integration

```jsx
function App() {
  const [mapInstances, setMapInstances] = useState(null);
  const mapTools = useMapTools();

  const { isConnected, messages, loaderState, sendMessage } = useMapAITools({
    wsUrl: 'ws://localhost:3000/ws',
    mapInstances,
    mapTools,
  });

  return (
    <>
      <MapView onMapInit={setMapInstances} />
      <ChatUI
        isConnected={isConnected}
        messages={messages}
        loaderState={loaderState}
        onSendMessage={sendMessage}
      />
    </>
  );
}
```

---

## Tool Executors

The `createExecutors` function creates all tool executor functions. Each executor takes params and returns `{ success, message, data? }`.

```javascript
import { createExecutors } from './services/toolExecutors';

// Create executors with map instances and context
const executors = createExecutors({ deck, map, mapTools });

// Execute a tool directly
const result = executors['fly-to']({ lat: 40.7, lng: -74.0, zoom: 12 });
// result: { success: true, message: 'Flying to 40.70, -74.00' }
```

The executors object maps tool names to functions:

```javascript
{
  'fly-to': (params) => { /* navigate map */ },
  'zoom-map': (params) => { /* zoom in/out */ },
  'toggle-layer': (params) => { /* show/hide layer */ },
  'set-point-color': (params) => { /* change point color */ },
  'query-features': (params) => { /* query and count */ },
  'filter-features-by-property': (params) => { /* filter visible */ },
  'color-features-by-property': (params) => { /* color by match */ },
  'size-features-by-property': (params) => { /* size by value */ },
  'aggregate-features': (params) => { /* group and count */ },
}
```

---

## Built-in Tools Reference

### fly-to

Navigate the map to specific coordinates.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | Yes | - | Latitude (-90 to 90) |
| `lng` | number | Yes | - | Longitude (-180 to 180) |
| `zoom` | number | No | 12 | Zoom level (0-22) |

**Example prompt:** "Fly to New York"

### zoom-map

Zoom the map in or out.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `direction` | 'in' \| 'out' | Yes | - | Zoom direction |
| `levels` | number | No | 1 | Number of zoom levels (1-10) |

**Example prompt:** "Zoom in 3 levels"

### toggle-layer

Show or hide a map layer.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `layerName` | string | Yes | - | Name of the layer |
| `visible` | boolean | Yes | - | Whether to show the layer |

**Example prompt:** "Hide the airports layer"

### set-point-color

Set a uniform color for all points.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `r` | number | Yes | - | Red (0-255) |
| `g` | number | Yes | - | Green (0-255) |
| `b` | number | Yes | - | Blue (0-255) |
| `a` | number | No | 200 | Alpha (0-255) |

**Example prompt:** "Make all points blue"

### color-features-by-property

Color features based on property values.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `property` | string | Yes | Property to match |
| `operator` | string | No | `equals`, `startsWith`, `contains`, `regex` |
| `value` | string | Yes | Value to match |
| `r`, `g`, `b`, `a` | number | Yes | Color (RGBA) |

**Example prompt:** "Color airports in California red"

### query-features

Query features and get statistics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `property` | string | Yes | Property to query |
| `operator` | string | No | Match operator |
| `value` | string | No | Value to match |
| `includeNames` | boolean | No | Include sample names |

**Returns:** `{ count, total, sampleNames? }`

**Example prompt:** "How many airports are in Texas?"

### filter-features-by-property

Filter visible features by property value.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `property` | string | Yes* | Property to filter |
| `operator` | string | No | Match operator |
| `value` | string | Yes* | Value to match |
| `reset` | boolean | No | Reset to show all |

*Required unless `reset: true`

**Example prompts:**
- "Show only large airports"
- "Show all airports again"

### size-features-by-property

Size features based on property values.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `property` | string | Yes* | Property for sizing |
| `sizeRules` | array | Yes* | Array of {value, size} |
| `defaultSize` | number | No | Default size in pixels |
| `reset` | boolean | No | Reset to uniform size |

**Example prompt:** "Make large airports bigger"

### aggregate-features

Group and count features by property.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `groupBy` | string | Yes | Property to group by |

**Returns:** `{ groupBy, total, groups: [{value, count}] }`

**Example prompt:** "How many airports per state?"

---

## Library Exports

### TOOL_NAMES

Constants for all available tool names:

```javascript
import { TOOL_NAMES } from '@carto/maps-ai-tools';

TOOL_NAMES.FLY_TO                     // 'fly-to'
TOOL_NAMES.ZOOM_MAP                   // 'zoom-map'
TOOL_NAMES.TOGGLE_LAYER               // 'toggle-layer'
TOOL_NAMES.SET_POINT_COLOR            // 'set-point-color'
TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY // 'color-features-by-property'
TOOL_NAMES.QUERY_FEATURES             // 'query-features'
TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY // 'filter-features-by-property'
TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY  // 'size-features-by-property'
TOOL_NAMES.AGGREGATE_FEATURES         // 'aggregate-features'
```

### parseToolResponse

Parses WebSocket tool call responses:

```javascript
import { parseToolResponse } from '@carto/maps-ai-tools';

const { toolName, data, error } = parseToolResponse(response);

if (error) {
  console.error(error.message);
  return;
}

// toolName: 'fly-to'
// data: { lat: 40.7128, lng: -74.0060, zoom: 12 }
```

---

## Troubleshooting

### WebSocket Connection Fails

- Ensure backend is running on `localhost:3000`
- Check browser console for connection errors
- Verify `WS_URL` in `src/config/constants.js`

### Tools Not Executing

- Check that map is initialized (`mapInstances` is not null)
- Verify WebSocket is connected (`isConnected` is true)
- Check browser console for parsing errors

### Map Not Updating Visually

- Ensure the tool executor returns `{ success: true }`
- Check browser console for any errors during execution

---

## Related Documentation

- [deck.gl Documentation](https://deck.gl/docs)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
