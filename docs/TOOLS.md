# Tool System

The framework uses 3 consolidated frontend-executed tools that replace 40+ granular tools. The AI generates tool calls with JSON parameters; the backend forwards them to the frontend via WebSocket (or HTTP/SSE); the frontend executes them against the deck.gl map state.

---

## Tool Overview

| Tool | Purpose |
|------|---------|
| `set-deck-state` | Navigate (initialViewState), change basemap (mapStyle), add/update/remove layers, widgets, and effects |
| `set-marker` | Place, remove, or clear location marker pins at specified coordinates |
| `set-mask-layer` | Editable mask layer for spatial filtering (set geometry or table name, draw mode, or clear). Uses MaskExtension |

---

## Tool Sources

Tools are aggregated from three sources in each backend's `agent/tools.ts`:

### Local Tools

Imported from `@carto/agentic-deckgl` and converted via SDK-specific functions:

- **OpenAI Agents SDK**: `getToolsForOpenAIAgents()` -- uses a custom `zodV4ToJsonSchema()` converter to handle `z.unknown()` in layer configs
- **Vercel AI SDK**: `getToolsForVercelAI()` -- native SDK converter
- **Google ADK**: `getToolsForGoogleADK()` -- ADK handles Zod schemas natively

These functions validate parameters with Zod schemas and return a `FrontendToolResult` marker (`{ __frontend_tool__: true, toolName, data }`) that signals the backend to forward the tool call to the frontend instead of executing it server-side.

### Custom Tools

Backend-only tools executed server-side (defined in `agent/custom-tools.ts`):

- **`lds-geocode`** -- CARTO LDS Geocoding. Converts addresses, cities, or landmarks to latitude/longitude coordinates. Only available when `CARTO_LDS_API_BASE_URL` and `CARTO_LDS_API_KEY` are configured.

### MCP Tools

Remote tools from MCP (Model Context Protocol) servers. Configured via environment variables (`CARTO_MCP_URL`, `CARTO_MCP_API_KEY`). Tool definitions are fetched from the MCP server at startup and converted to the backend SDK's format.

Tool results are executed server-side and sent to the frontend via `mcp_tool_result` messages. The `MCP_WHITELIST_CARTO` environment variable filters which tools are available (comma-separated list of tool names; all tools are included if unset).

---

## set-deck-state

The primary tool for manipulating the map. It follows a **three-phase pipeline** to ensure correct rendering order:

### Phase 1: ViewState

Update camera position via `setInitialViewState()`. Accepts partial updates:

```typescript
{
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
}
```

### Phase 2: Basemap

Change the map style via `setBasemap()`. Supported basemaps: `positron`, `dark-matter`, `voyager`.

### Phase 3: Layers

Process layer changes with the following steps:

1. **Remove layers** listed in `removeLayerIds` (array of layer ID strings)
2. **Deep merge** incoming layers with existing layers (matched by ID) using `mergeLayerSpecs()` -- this allows partial updates without resending the entire layer spec
3. **Apply layer order** if `layerOrder` is specified (array of layer IDs defining render order)
4. **Ensure system layers** (`__` prefix) render on top of user layers
5. **Validate columns** with `validateLayerColumns()` -- checks that referenced columns exist in the data source
6. **Track active layer** -- updates the active layer ID (skipping system layers)
7. **Update state** via `setDeckLayers()` -- triggers re-render through the JSONConverter

The same pipeline handles widgets and effects (deck.gl extensions like ambient lighting or post-processing effects).

---

## set-marker

Places an `IconLayer` with ID `__location-marker__` at specified coordinates.

**Accumulation behavior**: Markers accumulate across calls -- each new position is added to the existing set. If a marker already exists at the exact same coordinates, it is not duplicated.

**System layer**: The marker layer is a system layer -- hidden from the layer toggle UI and excluded from the AI state context (so the AI doesn't see or manipulate it).

---

## set-mask-layer

Manages an editable mask layer for spatial filtering. Three actions are supported:

| Action | Behavior |
|--------|----------|
| `set` | Applies a GeoJSON geometry or CARTO table name as the mask. All data layers are visually clipped to the mask area. The mask enters edit mode (translate + modify) so the user can adjust it. When a `tableName` is provided, the geometry is fetched from the CARTO table via `vectorTableSource`. |
| `enable-draw` | Activates drawing mode (`DrawPolygonMode`). The user draws a polygon on the map to define the mask area. |
| `clear` | Removes the mask. All data layers return to full visibility. |

### Three-Layer Composition

The mask layer uses a three-layer composition:

1. **`GeoJsonLayer`** (`__mask-layer__`) with `operation: 'mask'` -- defines the GPU-accelerated mask geometry
2. **`EditableGeoJsonLayer`** (`__editable-mask__`) -- user interaction layer for drawing and editing polygons
3. **`MaskExtension`** -- injected into all data layers when a mask is active, linking them to the mask geometry

Both mask layers are system layers (`__` prefix) -- hidden from the UI layer toggle and AI state context.

---

## System Layers

Layers with IDs prefixed by `__` (e.g., `__location-marker__`, `__mask-layer__`, `__editable-mask__`) are treated as **system layers**:

- **Rendering**: Always placed on top of user layers in the layer stack
- **UI**: Filtered out of the layer toggle panel
- **AI context**: Excluded from the initial state sent to the backend, so the AI doesn't see or manipulate them
- **Active layer tracking**: Skipped when determining the active layer ID

---

## MCP Mock Mode

When the `MCP_MOCK_MODE=true` environment variable is set (OpenAI Agents SDK backend only), the backend uses fixture-backed tool responses instead of connecting to a real MCP server. Useful for testing and development without MCP credentials.

Mock fixtures are defined in `agent/mcp-mock-fixtures.ts` and return pre-defined responses for each MCP tool.

---

## Source Files

| Module | Path | Purpose |
| ------ | ---- | ------- |
| Tool definitions | `src/definitions/tools.ts` | Zod schemas and tool registry for the 3 consolidated tools |
| Tool name constants | `src/definitions/dictionary.ts` | `TOOL_NAMES` enum |
| Tool prompts | `src/prompts/tool-prompts.ts` | Per-tool instruction blocks included in the system prompt |
| SDK converters | `src/converters/agentic-sdks.ts` | `getToolsForOpenAIAgents()`, `getToolsForVercelAI()`, `getToolsForGoogleADK()` |
| Spec schemas | `src/schemas/deckgl-json.ts` | Zod schemas for @deck.gl/json layer specs |

For adding new tools or modifying existing ones, see [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Cross-References

- **Library**: See [Library Architecture](LIBRARY.md) for the full API reference, SDK converters, and how tool definitions are created from Zod schemas
- **System Prompt**: See [System Prompt Architecture](SYSTEM_PROMPT.md) for how tools are described to the AI and included in the system prompt
- **Communication Protocol**: See [Communication Protocol](COMMUNICATION_PROTOCOL.md) for how tool calls are transmitted from backend to frontend and how tool results are sent back (tool results are WebSocket only — HTTP/SSE has no back-channel)
- **Backend Integration**: See [Backend Integration Guide](LIBRARY_BACKEND_INTEGRATION.md) for how to register tools and detect frontend tool results
- **Frontend Integration**: See [Frontend Integration Guide](LIBRARY_FRONTEND_INTEGRATION.md) for how to execute tool calls on the client
