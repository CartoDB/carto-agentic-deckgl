# System Prompt Architecture

The system prompt is built in two layers: a library-generated base prompt and application-specific custom instructions.

---

## Library Prompt

The `buildSystemPrompt()` function from `@carto/agentic-deckgl` generates the base prompt. This function is imported by all three backends and is identical across all SDK integrations.

### Components

The library prompt includes:

1. **Tool-specific instructions** -- How to use `set-deck-state`, `set-marker`, and `set-mask-layer`. Includes:
   - Parameter schemas for each tool
   - Expected behavior and success criteria
   - Common patterns and best practices
   - Error handling guidance

2. **Current map state** -- Contextual information about the current map:
   - Camera position (longitude, latitude, zoom, pitch, bearing)
   - Active layers (IDs, types, data sources, styling)
   - Layer configuration (visibility, opacity, color schemes)
   - Note: System layers (`__` prefix) are excluded from this context

3. **User context** -- Optional contextual information:
   - Country or region
   - Business type or domain
   - Use case or analysis goal

4. **MCP instructions** -- If MCP tools are available:
   - Available MCP tool names and descriptions
   - MCP workflow patterns (e.g., async workflow job status polling)
   - MCP result table caching instructions

5. **Mask layer instructions** -- Guidelines for spatial filtering:
   - Geometry caching behavior (MCP results stored in CARTO tables)
   - Trigger phrases ("filter by this area", "mask the map to this region")
   - No-fabrication rules (never invent table names or geometries)

### Function Signature

```typescript
buildSystemPrompt(
  mapState: {
    viewState: ViewState;
    layers: LayerSpec[];
    basemap: string;
  },
  tools: ToolDefinition[],
  mcpTools?: McpToolDefinition[]
): string
```

---

## Custom Prompt

Application-specific instructions are defined in `prompts/custom-prompt.ts` in each backend. These are appended to the library prompt to add domain-specific rules and constraints.

### Categories

The custom prompt typically includes:

1. **SQL limitations** -- Clarify that no SQL tool is available in this integration (spatial analysis only, no direct database queries)

2. **Table name format** -- Databricks fully-qualified names (FQN) with backticks:
   - Pattern: `` `catalog.schema.table` ``
   - Example: `` `carto-demo-data.demo_tables.usa_counties` ``

3. **Security guardrails** -- Restrict the AI to spatial analysis only:
   - No data modification
   - No administrative operations
   - No credential access

4. **Agent behavior rules** -- Prevent infinite loops and unnecessary messages:
   - No self-responses
   - No tool calls without user request
   - No repeated tool calls with identical parameters

5. **Layer styling guidance** -- Best practices for color schemes and legends:
   - Use CARTO color palettes (Sunset, Teal, Prism, etc.)
   - Provide meaningful domain ranges for `colorBins` and `colorContinuous`
   - Include legend configuration in layer specs

6. **Geocoding workflow sequence** -- Enforce correct tool order:
   - **Step 1**: Call `lds-geocode` to get coordinates
   - **Step 2**: Call `set-deck-state` to update camera position
   - **Step 3**: Call MCP tool (if spatial analysis is needed)

---

## Prompt Assembly

The final system prompt is composed by combining all three layers:

```
Final System Prompt = buildSystemPrompt(mapState, tools, mcpTools)
                    + Semantic Layer Context (markdown-rendered data catalog)
                    + Custom Prompt (application-specific rules)
```

This assembly happens in `prompts/system-prompt.ts` in each backend:

1. **Library prompt** -- Delegates to `buildSystemPrompt()` from `@carto/agentic-deckgl`
2. **Semantic context** -- Injects the markdown-rendered semantic layer (data catalog describing available tables, columns, and visualization hints)
3. **Custom prompt** -- Appends the custom instructions from `prompts/custom-prompt.ts`

The assembled prompt is passed to the AI SDK as the `system` message or `systemInstruction` parameter.

---

## Customization

To customize the system prompt for your application:

1. **Edit `prompts/custom-prompt.ts`** in your backend to add application-specific rules
2. **Do NOT modify the library prompt directly** -- it's imported from `@carto/agentic-deckgl` and should remain unchanged to ensure consistent tool behavior across all backends
3. **Update the semantic layer YAML** to reflect your data catalog (see [Semantic Layer](SEMANTIC_LAYER_GUIDE.md))

---

## Cross-References

- **Semantic Layer**: See [Semantic Layer](SEMANTIC_LAYER_GUIDE.md) for how the data catalog is injected into the system prompt
- **Tool System**: See [Tool System](TOOLS.md) for the tools described in the prompt
