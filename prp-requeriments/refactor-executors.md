# Refactoring frontend-vanilla to use JSONConverter as Central Engine

## Goal
Refactor `integration-examples/frontend-vanilla/` to use JSONConverter as the central rendering engine, consolidating 18+ tools into ~6 tools (similar to simpleAgentMap).

## Scope
- **Frontend**: Create DeckState class, simplify executors, central rendering
- **Shared Package**: Add consolidated tool definitions to `@carto/maps-ai-tools`
- **Backend**: Update to use new consolidated tools

---

## Phase 1: Create DeckState Class

### File: `src/state/DeckState.ts` (NEW)

```typescript
import type { MapViewState } from '@deck.gl/core';

export type Basemap = 'dark-matter' | 'positron' | 'voyager';

export interface DeckConfig {
  layers?: Record<string, any>[];
  widgets?: Record<string, any>[];
  effects?: Record<string, any>[];
}

export interface DeckStateData {
  viewState: MapViewState;
  deckConfig: DeckConfig;
  basemap: Basemap;
}

type ChangeListener = (state: DeckStateData, changedKeys: string[]) => void;

export class DeckState {
  private viewState: MapViewState;
  private deckConfig: DeckConfig;
  private basemap: Basemap;
  private listeners: Set<ChangeListener> = new Set();

  constructor(initialState?: Partial<DeckStateData>) { ... }

  // Getters
  getViewState(): MapViewState;
  getDeckConfig(): DeckConfig;
  getBasemap(): Basemap;
  getState(): DeckStateData;

  // Setters with notification
  setViewState(partial: Partial<MapViewState>): void;
  setDeckConfig(config: DeckConfig): void;
  setBasemap(basemap: Basemap): void;

  // Subscribe to changes
  subscribe(listener: ChangeListener): () => void;
}
```

---

## Phase 2: Add Consolidated Tool Definitions

### File: `map-ai-tools/src/definitions/tools.ts` (MODIFY)

Add new consolidated tools alongside existing ones:

```typescript
// ============================================================================
// Consolidated Tools (simpleAgentMap pattern)
// ============================================================================

'geocode': {
  name: 'geocode',
  description: 'Get coordinates for a place name using geocoding service.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    query: z.string().describe('The address or place name to geocode'),
  }),
},

'set-map-view': {
  name: 'set-map-view',
  description: 'Set the map view to specific coordinates with optional pitch/bearing.',
  outputType: 'spec' as ToolOutputType,
  schema: z.object({
    latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
    longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
    zoom: z.number().min(0).max(22).describe('Zoom level 1-20'),
    pitch: z.number().min(0).max(85).optional().describe('Map pitch (0-85)'),
    bearing: z.number().min(-180).max(180).optional().describe('Map bearing'),
    transitionDuration: z.number().optional().describe('Animation duration in ms'),
  }),
},

'set-basemap': {
  name: 'set-basemap',
  description: 'Change the map basemap style. Options: dark-matter, positron, voyager',
  outputType: 'spec' as ToolOutputType,
  schema: z.object({
    basemap: z.enum(['dark-matter', 'positron', 'voyager']).describe('Basemap style'),
  }),
},

'set-deck-state': {
  name: 'set-deck-state',
  description: `Set Deck.gl visualization state including layers, widgets, and effects.
Pass configurations in Deck.gl JSON format with @@type, @@function prefixes.
This REPLACES all existing layers - include all layers you want to keep.

Example layer:
{
  "@@type": "VectorTileLayer",
  "id": "my-layer",
  "data": { "@@function": "vectorTableSource", "tableName": "..." },
  "getFillColor": [200, 200, 200, 180]
}`,
  outputType: 'spec' as ToolOutputType,
  schema: z.object({
    layers: z.array(z.record(z.any())).optional().describe(
      'Array of Deck.gl layer configurations in JSON format'
    ),
    widgets: z.array(z.record(z.any())).optional().describe(
      'Array of Deck.gl widget configurations'
    ),
    effects: z.array(z.record(z.any())).optional().describe(
      'Array of Deck.gl effect configurations'
    ),
  }),
},

'take-map-screenshot': {
  name: 'take-map-screenshot',
  description: 'Capture a screenshot of the current map view for analysis.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    reason: z.string().describe('Why the screenshot is being taken'),
  }),
},

'carto-query': {
  name: 'carto-query',
  description: 'Execute a SQL query against CARTO Data Warehouse.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    sql: z.string().describe('SQL query to execute'),
    connectionName: z.string().optional().describe('CARTO connection name'),
    format: z.enum(['geojson', 'json']).optional().describe('Response format'),
  }),
},
```

Also add helper function:
```typescript
export function getConsolidatedToolDefinitions() {
  const consolidatedToolNames: ToolName[] = [
    'geocode', 'set-map-view', 'set-basemap',
    'set-deck-state', 'take-map-screenshot', 'carto-query'
  ];
  return consolidatedToolNames.map(getToolDefinition);
}
```

---

## Phase 3: Update JSONConverter Configuration

### File: `src/config/deckJsonConfig.ts` (MODIFY)

Ensure full deck.gl/carto support matching simpleAgentMap:

```typescript
import { JSONConverter } from '@deck.gl/json';
import * as DeckLayers from '@deck.gl/layers';
import {
  VectorTileLayer, H3TileLayer, QuadbinTileLayer, RasterTileLayer,
  vectorTableSource, vectorTilesetSource, vectorQuerySource,
  h3TableSource, quadbinTableSource, rasterSource,
  colorBins, colorCategories, colorContinuous,
} from '@deck.gl/carto';

export const deckJsonConfiguration = {
  classes: {
    ...DeckLayers,
    // CARTO layers
    VectorTileLayer, H3TileLayer, QuadbinTileLayer, RasterTileLayer,
    // Interpolators
    FlyToInterpolator, LinearInterpolator,
  },
  functions: {
    // CARTO data sources
    vectorTableSource, vectorTilesetSource, vectorQuerySource,
    h3TableSource, quadbinTableSource, rasterSource,
    // CARTO styling
    colorBins, colorCategories, colorContinuous,
    // Existing custom functions...
  },
  constants: {
    // Color constants...
  },
};
```

---

## Phase 4: Create Central Rendering Function

### File: `src/map/deckgl-map.ts` (MODIFY)

Add central rendering function that converts JSON → layers:

```typescript
import { getJsonConverter } from '../config/deckJsonConfig';
import type { DeckStateData } from '../state/DeckState';

const CARTO_CREDENTIALS = {
  accessToken: import.meta.env.VITE_API_ACCESS_TOKEN,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  connectionName: import.meta.env.VITE_CONNECTION_NAME || 'carto_dw',
};

// Inject CARTO credentials into layer data sources
function injectCartoCredentials(layerJson: Record<string, any>): Record<string, any> {
  const layer = JSON.parse(JSON.stringify(layerJson));
  if (layer.data?.['@@function']?.toLowerCase().includes('source')) {
    layer.data.accessToken = layer.data.accessToken || CARTO_CREDENTIALS.accessToken;
    layer.data.apiBaseUrl = layer.data.apiBaseUrl || CARTO_CREDENTIALS.apiBaseUrl;
    layer.data.connectionName = layer.data.connectionName || CARTO_CREDENTIALS.connectionName;
  }
  return layer;
}

// Central rendering function
export function renderFromState(
  deck: Deck,
  map: maplibregl.Map,
  state: DeckStateData,
  changedKeys: string[]
): void {
  const jsonConverter = getJsonConverter();

  // Update view state
  if (changedKeys.includes('viewState')) {
    deck.setProps({
      initialViewState: {
        ...state.viewState,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      },
    });
    map.jumpTo({
      center: [state.viewState.longitude, state.viewState.latitude],
      zoom: state.viewState.zoom,
      bearing: state.viewState.bearing ?? 0,
      pitch: state.viewState.pitch ?? 0,
    });
  }

  // Update basemap
  if (changedKeys.includes('basemap')) {
    const basemapUrl = BASEMAP[state.basemap.toUpperCase().replace('-', '_')];
    map.setStyle(basemapUrl);
  }

  // Update layers via JSONConverter
  if (changedKeys.includes('deckConfig')) {
    const convertedLayers = (state.deckConfig.layers || []).map((layerJson, index) => {
      try {
        const layerId = layerJson.id || `layer-${index}`;
        const layerWithId = { ...layerJson, id: layerId };
        const layerWithCredentials = injectCartoCredentials(layerWithId);
        return jsonConverter.convert(layerWithCredentials);
      } catch (error) {
        console.error('Failed to convert layer:', error, layerJson);
        return null;
      }
    }).filter(Boolean);

    deck.setProps({ layers: convertedLayers });
    scheduleRedraws(deck);
  }
}
```

---

## Phase 5: Create Consolidated Executors

### File: `src/executors/consolidated-executors.ts` (NEW)

~200 lines replacing 1857 lines:

```typescript
import type { DeckState } from '../state/DeckState';
import type { ZoomControls, LayerToggle, ToolStatus, ChatContainer } from '../ui';

export interface ConsolidatedExecutorContext {
  deckState: DeckState;
  zoomControls: ZoomControls;
  layerToggle: LayerToggle;
  toolStatus: ToolStatus;
  chatContainer: ChatContainer;
  sendToolResult?: (result: any) => void;
}

export function createConsolidatedExecutors(context: ConsolidatedExecutorContext) {
  const { deckState, zoomControls, layerToggle, toolStatus } = context;

  return {
    'geocode': async (params: { query: string }) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(params.query)}&format=json&limit=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'CARTO-Demo/1.0' } });
      const data = await response.json();
      if (!data.length) return { success: false, message: `Not found: ${params.query}` };
      return {
        success: true,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display_name: data[0].display_name,
      };
    },

    'set-map-view': (params) => {
      deckState.setViewState({
        latitude: params.latitude,
        longitude: params.longitude,
        zoom: params.zoom,
        pitch: params.pitch ?? 0,
        bearing: params.bearing ?? 0,
      });
      zoomControls.setZoomLevel(params.zoom);
      return { success: true, message: 'Map view updated' };
    },

    'set-basemap': (params) => {
      deckState.setBasemap(params.basemap);
      return { success: true, message: 'Basemap updated' };
    },

    'set-deck-state': (params) => {
      const config = {
        layers: params.layers || [],
        widgets: params.widgets || [],
        effects: params.effects || [],
      };
      deckState.setDeckConfig(config);

      // Update layer toggle UI
      layerToggle.setLayers(config.layers.map(l => ({
        id: l.id,
        name: l.id,
        visible: l.visible !== false,
        color: '#036fe2',
      })));

      return {
        success: true,
        message: `Config updated: ${config.layers.length} layer(s)`,
      };
    },

    'take-map-screenshot': async (params) => {
      // Canvas capture implementation
      return { success: true, message: 'Screenshot captured', reason: params.reason };
    },

    'carto-query': async (params) => {
      // CARTO SQL API query
      return { success: true, message: 'Query executed' };
    },
  };
}
```

---

## Phase 6: Update Index.ts

### File: `src/index.ts` (MODIFY)

Key changes:

```typescript
import { DeckState } from './state/DeckState';
import { createConsolidatedExecutors } from './executors/consolidated-executors';
import { createMap, renderFromState, INITIAL_VIEW_STATE } from './map/deckgl-map';

// Create central state
const deckState = new DeckState({
  viewState: INITIAL_VIEW_STATE,
  deckConfig: { layers: [], widgets: [], effects: [] },
  basemap: 'positron',
});

// Create map
const { deck, map } = createMap('map', 'deck-canvas', (viewState) => {
  // User interactions update state (but don't re-render - just sync)
  deckState.setViewState(viewState);
  zoomControls.setZoomLevel(viewState.zoom ?? 3);
});

// Subscribe to state changes - central rendering
deckState.subscribe((state, changedKeys) => {
  renderFromState(deck, map, state, changedKeys);
});

// Create consolidated executors
const executors = createConsolidatedExecutors({
  deckState,
  zoomControls,
  layerToggle,
  toolStatus,
  chatContainer,
});
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/state/DeckState.ts` | CREATE | Central state management class |
| `src/executors/consolidated-executors.ts` | CREATE | Simplified executors (~200 lines) |
| `src/map/deckgl-map.ts` | MODIFY | Add `renderFromState()` function |
| `src/config/deckJsonConfig.ts` | MODIFY | Add CARTO styling functions |
| `src/index.ts` | MODIFY | Wire up DeckState + consolidated executors |
| `map-ai-tools/src/definitions/tools.ts` | MODIFY | Add consolidated tool definitions |

### Files to Remove
| File | Action | Reason |
|------|--------|--------|
| `src/executors/tool-executors.ts` | DELETE | Replaced by consolidated-executors.ts |
| `src/executors/json-spec-executor.ts` | DELETE | Logic moved to deckgl-map.ts renderFromState() |

---

## Tool Mapping (Old → New)

| Old Tools | New Tool | How |
|-----------|----------|-----|
| fly-to, zoom-map, set-view-state, rotate-map, set-pitch | `set-map-view` | Combined view control |
| toggle-layer, show-hide-layer | `set-deck-state` | Include/exclude layer from array |
| set-point-color, color-features-by-property | `set-deck-state` | Use colorBins/colorCategories in layer JSON |
| filter-features-by-property | `set-deck-state` | Use SQL in vectorQuerySource |
| add-layer, add-vector-layer | `set-deck-state` | Add layer to config.layers array |
| remove-layer | `set-deck-state` | Exclude layer from array |
| update-layer-style, update-layer-props | `set-deck-state` | Update layer config |
| reset-visualization | `set-deck-state` | Pass original config |
| (new) | `geocode` | Place name → coordinates |
| (new) | `set-basemap` | Change basemap style |
| (new) | `take-map-screenshot` | Capture for AI analysis |
| (new) | `carto-query` | SQL queries |

---

## Verification Plan

1. **Unit Tests**
   - Test DeckState class: setters, getters, subscription
   - Test consolidated executors: each tool returns expected result

2. **Integration Test**
   - Start frontend dev server: `cd integration-examples/frontend-vanilla && npm run dev`
   - Test tool calls via chat:
     - "Show me New York" → geocode + set-map-view
     - "Add a layer for airports" → set-deck-state with VectorTileLayer
     - "Change basemap to dark" → set-basemap
     - "Color airports by type" → set-deck-state with colorCategories

3. **Visual Verification**
   - Confirm layers render correctly
   - Confirm view transitions are smooth
   - Confirm basemap changes work
   - Confirm layer toggle UI updates

---

## Implementation Order

1. **Phase 1**: Create `DeckState.ts` - can be tested independently
2. **Phase 2**: Add consolidated tools to `map-ai-tools` - no breaking changes
3. **Phase 3**: Update `deckJsonConfig.ts` - add missing functions
4. **Phase 4**: Add `renderFromState()` to `deckgl-map.ts`
5. **Phase 5**: Create `consolidated-executors.ts`
6. **Phase 6**: Update `index.ts` to use new architecture
7. **Test**: Verify all functionality works

Estimated: ~500 new lines of code, replacing ~1800 lines
