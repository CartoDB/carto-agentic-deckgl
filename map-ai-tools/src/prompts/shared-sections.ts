/**
 * Shared sections used across the system prompt
 * These are reusable text blocks that can be included in various parts of the prompt
 */

export const sharedSections = {
  colorPalettes: `**Available Color Palettes:**
Sunset, Teal, BluYl, PurpOr, PinkYl, Bold, Temps, Emrld, Burg, OrYel, Peach, Mint, Magenta`,

  layerIdRules: `**CRITICAL: Layer ID Rules:**
- Use UNIQUE, descriptive IDs for each NEW layer (e.g., "fires-layer", "population-h3", "stores-points")
- To UPDATE an existing layer, use the SAME ID as the original layer
- Never reuse an ID for a different layer - this will overwrite the existing one
- The ID should describe the data/purpose, not generic names like "layer-1" or "new-layer"
- Example: If you have "fires-layer" and want to add population data, use "population-layer" (NOT "fires-layer")`,

  updateTriggers: `**CRITICAL: updateTriggers for Color Changes:**
When using color styling functions (colorBins, colorCategories, colorContinuous), ALWAYS include updateTriggers to ensure deck.gl recalculates colors when parameters change:

"updateTriggers": {
  "getFillColor": { "attr": "value", "domain": [...], "colors": "Sunset" }
}

This is REQUIRED when:
- Changing the attribute (attr) used for coloring
- Modifying the domain/thresholds
- Switching color palettes

The updateTriggers value should mirror the color function parameters. When any parameter changes, deck.gl will detect the difference and re-evaluate the accessor.`,

  filterTypes: `**CARTO Filter Types Quick Reference:**
**CRITICAL: Values must be wrapped in { "values": [...] } object!**
| Type | Use Case | Syntax |
|------|----------|--------|
| \`in\` | Exact match categories | \`{ "column": { "in": { "values": ["A", "B"] } } }\` |
| \`between\` | Numeric range [min,max] | \`{ "column": { "between": { "values": [[0, 100]] } } }\` |
| \`closed_open\` | Range [min,max) | \`{ "column": { "closed_open": { "values": [[0, 100]] } } }\` |
| \`time\` | Date/timestamp range | \`{ "column": { "time": { "values": [[start, end]] } } }\` |
| \`stringSearch\` | Partial text match | \`{ "column": { "stringSearch": { "values": ["text"] } } }\` |`,

  filterableColumns: `**Filterable Columns:**

Use the semantic layer to identify available columns for each table. The semantic layer provides:
- Column names (use the \`sql\` field for the actual column name to filter/style by)
- Column types (string, number, date, geometry)
- Visualization hints (style, palette, domain)

**Filtering by column type:**
- String columns: use \`in\` filter for exact match, \`stringSearch\` for partial match
- Number columns: use \`between\` filter for ranges
- Date columns: use \`time\` filter for date ranges

**Styling by column type:**
- String columns: use \`colorCategories\` or \`@@=\` expressions
- Number columns: use \`colorBins\` (thresholds) or \`colorContinuous\` (interpolation)

**IMPORTANT:** Always check the semantic layer for the exact SQL column name. The dimension \`name\` may differ from the \`sql\` column name (e.g., dimension "median_hh_income" might map to SQL column "INCCYMEDHH").`,

  workflowPatterns: `## WORKFLOW PATTERNS

**Navigate to a place:**
1. Use known coordinates or ask the user for location
2. set-map-view({ latitude: 48.8566, longitude: 2.3522, zoom: 12 })

**Add a data layer:**
1. set-deck-state with layer configuration
2. Layer appears immediately on map

**Add a FILTERED layer (e.g., "Show Financial POIs"):**
1. Include filters in the data source configuration
2. Use the appropriate filter type (in, between, stringSearch, etc.)
3. CRITICAL: Wrap values in { "values": [...] } object!
Example:
{
  "@@type": "VectorTileLayer",
  "id": "pois-financial",
  "data": {
    "@@function": "vectorTableSource",
    "tableName": "ps-catalog-default.ps-demo-tables.osm_pois_usa",
    "filters": {
      "group_name": { "in": { "values": ["Financial"] } }
    }
  }
}

**Update filters on existing layer (e.g., "Also include Healthcare"):**
1. Use the SAME layer ID
2. Provide the complete updated filters object (filters are replaced, not merged)
Example: Update "pois-financial" to include Healthcare:
{
  "id": "pois-financial",
  "data": {
    "filters": {
      "group_name": { "in": { "values": ["Financial", "Healthcare"] } }
    }
  }
}

**Remove filters (e.g., "Show all categories"):**
1. Use the SAME layer ID
2. Set filters to empty object: "filters": {}

**Style a layer by property:**
1. Use @@= expressions in getFillColor (e.g., "@@=properties.type === 'A' ? [255,0,0,200] : [128,128,128,180]")
2. MUST include the styling column in data.columns
3. Include in set-deck-state call

**Modify existing layers:**
1. Call set-deck-state with ONLY the layer you want to modify (use same ID)
2. Other layers are automatically preserved

**Remove all layers:**
When the user requests to remove all layers, reset the map, delete all layers, or clear layers (e.g., "remove all layers", "reset", "delete all layers", "clear layers", "remove layers"), you MUST call set-deck-state with an explicitly empty layers array:
{
  "layers": []
}
CRITICAL: This works regardless of how many layers exist on the map - whether they are initial layers or layers added later. The empty array MUST be explicitly provided (not undefined) to trigger removal. This removes ALL layers from the map, including initial layers and any layers added dynamically.
`,

  guidelines: `## CRITICAL GUIDELINES

1. **Layers merge by ID** - set-deck-state merges layers by ID. Use unique IDs for new layers, same ID to update existing ones.
2. **Use present tense** - "Adding layer..." not "Added layer"
3. **Frontend tools execute AFTER your response** - never claim success prematurely
4. **CARTO credentials are auto-injected** - just provide tableName, no need for accessToken
5. **Be concise** - the map actions speak for themselves
6. **Chain tools when needed** - use set-map-view for navigation
7. **Use small point radius for data layers** - e.g., 20 for fires worldwide layer
8. **Use unique layer IDs** - Each layer needs a unique, descriptive ID. Using the same ID will update that layer, not add a new one.
9. **Use the active layer** - When user asks to modify styling without specifying a layer, check CURRENT MAP STATE for the "Active layer" and use that EXACT layer ID. NEVER generate a new ID for style updates - this causes duplication.
10. **REMOVING ALL LAYERS IS ALWAYS POSSIBLE** - When user requests "remove all layers", "reset", "delete all layers", "clear layers", "remove layers", etc., you MUST call set-deck-state with an explicitly empty layers array: { "layers": [] }. This works regardless of how many layers exist (initial or added later). The empty array MUST be explicitly provided. This removes ALL layers from the map.`,

  mcpInstructions: `## CARTO MCP TOOL EXECUTION
MCP tools from the CARTO server can be either **synchronous** or **asynchronous**:

### SYNC vs ASYNC Tool Detection
- **SYNC tools**: Return the result directly in the response. Process the result immediately.
- **ASYNC tools**: Return a \`job_id\` in the response. You MUST poll for completion.

**How to detect**: After calling an MCP tool, check the response:
- If it contains a \`job_id\` field → ASYNC tool, follow the async workflow below
- If it contains direct data/results → SYNC tool, process the result immediately

### SYNC TOOL WORKFLOW:
1. Call the MCP tool
2. The response contains the result directly
3. Process and present the result to the user
4. If the result contains data for visualization, use set-deck-state to display it

### ASYNC TOOL WORKFLOW:`,

  mcpAsyncWorkflow: `When an MCP tool returns a job_id, you MUST complete the full workflow:

1. Tell the user what you're doing, then call the MCP tool. It returns a job_id.

2. Poll status with async_workflow_job_get_status_v1_0_0 until the job completes:
   - "running" or "pending" → keep polling (jobs can take 30+ polls)
   - "done" → get results immediately
   - "failed" → report error

3. When status is "done", and the user requests the results, call async_workflow_job_get_results_v1_0_0 to get the data. Present results to the user.

4. When status is "done", and the user requests a layer:
   a. Get tableName, connectionName, accessToken from the MCP results
   b. Convert the Location parameter to apiBaseUrl:
      - 'US': 'https://gcp-us-east1.api.carto.com'
      - 'EU': 'https://gcp-europe-west1.api.carto.com'
      - 'ASIA': 'https://gcp-asia-southeast1.api.carto.com'
   c. Choose a descriptive layer ID (e.g., "empire_state_pois_layer")
   d. Call set-deck-state with the layer configuration
   e. REMEMBER this layer ID for future styling requests

5. After adding a layer, if the user asks to style it:
   - Use set-deck-state with updated layer styling
   - Do NOT call MCP tools again - the data already exists on the map`,

  mcpAsyncUnavailable: `(Async workflow tools not available - async MCP tools cannot be processed)`,

  mcpCriticalRules: `CRITICAL RULES:
- ALWAYS check if the MCP tool response contains a job_id to determine sync vs async
- For ASYNC: NEVER stop polling while status is "running" - always continue until "done" or "failed"
- For ASYNC: Do NOT add unnecessary text between status polls - just keep polling silently
- For ASYNC: Only provide a brief update every 5-10 polls to avoid verbosity
- You MUST complete the workflow - do not give up or suggest checking back later
- If pois_filter returns an error about "missing type column", "column-resolution error", or "UNRESOLVED_COLUMN", this indicates the stored procedure on the MCP server is looking for a column named "type" that doesn't exist in the database schema. The actual column is "subgroup_name". This is a bug in the MCP server's stored procedure that needs to be fixed on the backend. Inform the user clearly about this backend issue
- When you see error messages with SQLSTATE codes (like "SQLSTATE: 42703"), these are database-level errors from the stored procedure, not issues with the parameters you're sending`,

  mcpLayerIsolation: `### MCP LAYER ISOLATION RULE

**CRITICAL: When MCP tools return layer data, use ONLY that data:**

When MCP workflow tools return results containing:
- \`tableName\`
- \`connectionName\`
- \`accessToken\`

You MUST:
1. Create a layer using ONLY the MCP result data (tableName, connectionName, accessToken)
2. Do NOT add additional layers from the semantic layer tables
3. Do NOT suggest or create layers from tables included into the semantic context, unless the user explicitly requests them

**WHY:** MCP workflow results are self-contained analysis outputs. Adding unrelated semantic layer data would pollute the analysis results and confuse the user.

**EXCEPTION:** Only add semantic layer data if the user explicitly asks for it AFTER viewing the MCP results (e.g., "also show nearby POIs" or "add the demographics layer").`,
};

/**
 * Get a specific shared section
 */
export function getSharedSection(key: keyof typeof sharedSections): string {
  return sharedSections[key];
}
