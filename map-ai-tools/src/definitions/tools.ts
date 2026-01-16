import * as z from 'zod';

/**
 * Tool output types:
 * - 'spec': Returns a @deck.gl/json spec to be applied via JSONConverter
 * - 'data': Returns query data (not a spec)
 */
type ToolOutputType = 'spec' | 'data';

/**
 * Consolidated Tool Definitions
 *
 * These 6 tools provide complete map control using the "Teach the agent Deck.gl" pattern
 * from simpleAgentMap. Instead of 40+ granular tools, we use JSONConverter as the central engine.
 */
export const tools = {
  // ============================================================================
  // Consolidated Tools (simpleAgentMap pattern)
  // These 6 tools replace the 40+ granular tools for simpler integration
  // ============================================================================

  'geocode': {
    name: 'geocode',
    description: 'Get coordinates for a place name using geocoding service. Returns lat, lng, and display_name.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      query: z.string().describe('The address or place name to geocode'),
    }),
  },

  'set-map-view': {
    name: 'set-map-view',
    description: 'Set the map view to specific coordinates with optional pitch/bearing. Use after geocoding a place.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
      longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
      zoom: z.number().min(0).max(22).describe('Zoom level (0-22)'),
      pitch: z.number().min(0).max(85).optional().describe('Map pitch/tilt in degrees (0-85)'),
      bearing: z.number().min(-180).max(180).optional().describe('Map bearing/rotation in degrees'),
      transitionDuration: z.number().min(0).optional().describe('Animation duration in milliseconds'),
    }),
  },

  'set-basemap': {
    name: 'set-basemap',
    description: 'Change the map basemap style. Options: dark-matter (dark theme), positron (light theme), voyager (colorful roads).',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      basemap: z.enum(['dark-matter', 'positron', 'voyager']).describe('Basemap style'),
    }),
  },

  'set-deck-state': {
    name: 'set-deck-state',
    description: `Set Deck.gl visualization state including layers, widgets, and effects.

IMPORTANT: You MUST pass a "layers" array containing layer objects. Each layer needs @@type.

Example - Adding a VectorTileLayer:
{
  "layers": [
    {
      "@@type": "VectorTileLayer",
      "id": "my-layer",
      "data": { "@@function": "vectorTableSource", "tableName": "cartobq.public.airports" },
      "getFillColor": [200, 200, 200, 180],
      "pickable": true
    }
  ]
}

Example - Adding a QuadbinTileLayer with colorBins:
{
  "layers": [
    {
      "@@type": "QuadbinTileLayer",
      "id": "population-quadbin",
      "data": {
        "@@function": "quadbinTableSource",
        "tableName": "my_quadbin_table",
        "aggregationExp": "SUM(population) as value"
      },
      "getFillColor": { "@@function": "colorBins", "attr": "value", "domain": [0, 1000, 10000], "colors": "Sunset" }
    }
  ]
}

Example - Updating layer style (keep same id, include properties to change):
{
  "layers": [
    {
      "id": "population-quadbin",
      "getFillColor": { "@@function": "colorBins", "attr": "value", "domain": [0, 1000, 10000], "colors": "PurpOr" }
    }
  ]
}

Available layer types: VectorTileLayer, H3TileLayer, QuadbinTileLayer, GeoJsonLayer, ScatterplotLayer, PathLayer, ArcLayer.
Available data sources: vectorTableSource, vectorQuerySource, h3TableSource (requires aggregationExp), h3QuerySource, quadbinTableSource (requires aggregationExp), quadbinQuerySource.
Available color palettes: Sunset, PurpOr, Teal, Temps, BluYl, Burg, PinkYl, RedOr, etc.`,
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layers: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl layer configurations in JSON format. Each layer must have @@type.'
      ),
      widgets: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl widget configurations. Each widget must have @@type.'
      ),
      effects: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl effect configurations like LightingEffect.'
      ),
    }),
  },

  'take-map-screenshot': {
    name: 'take-map-screenshot',
    description: 'Capture a screenshot of the current map view for analysis or sharing.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      reason: z.string().describe('Why the screenshot is being taken'),
    }),
  },

  'carto-query': {
    name: 'carto-query',
    description: 'Execute a SQL query against CARTO Data Warehouse. Returns GeoJSON or JSON data.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      sql: z.string().describe('SQL query to execute against CARTO Data Warehouse'),
      connectionName: z.string().optional().describe('CARTO connection name. Defaults to carto_dw.'),
      format: z.enum(['geojson', 'json']).optional().describe(
        'Response format. Use geojson for spatial data (default), json for tabular data.'
      ),
    }),
  },

} as const;

/**
 * Type-safe tool names
 */
export type ToolName = keyof typeof tools;

/**
 * Get a list of all tool names
 */
export function getToolNames(): ToolName[] {
  return Object.keys(tools) as ToolName[];
}

/**
 * Get a specific tool by name
 */
export function getTool<T extends ToolName>(name: T) {
  return tools[name];
}

/**
 * Convert a tool to OpenAI function calling format
 */
export function getToolDefinition(name: ToolName) {
  const tool = tools[name];
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.schema, { target: 'openapi-3.0' }),
    },
  };
}

/**
 * Get all tools in OpenAI function calling format
 */
export function getAllToolDefinitions() {
  return getToolNames().map(getToolDefinition);
}

/**
 * Get tool definitions for specific tools only
 */
export function getToolDefinitionsByNames(names: ToolName[]) {
  return names.map(getToolDefinition);
}

/**
 * Validate parameters for a tool using Zod
 */
export function validateToolParams(name: ToolName, params: unknown) {
  const tool = tools[name];
  return tool.schema.safeParse(params);
}

/**
 * Check if a tool returns a @deck.gl/json spec
 */
export function isSpecTool(name: ToolName): boolean {
  return tools[name].outputType === 'spec';
}

/**
 * Check if a tool returns data (query tool)
 */
export function isDataTool(name: ToolName): boolean {
  return tools[name].outputType === 'data';
}

/**
 * Get all spec-returning tools
 */
export function getSpecTools(): ToolName[] {
  return getToolNames().filter(isSpecTool);
}

/**
 * Get all data-returning tools
 */
export function getDataTools(): ToolName[] {
  return getToolNames().filter(isDataTool);
}

/**
 * Consolidated tool names
 * These 6 tools replace the 40+ granular tools for simpler integration
 */
export const consolidatedToolNames: ToolName[] = [
  'geocode',
  'set-map-view',
  'set-basemap',
  'set-deck-state',
  'take-map-screenshot',
  'carto-query',
];

/**
 * Get consolidated tool definitions
 * Use this for the simplified JSONConverter-based architecture
 */
export function getConsolidatedToolDefinitions() {
  return consolidatedToolNames.map(getToolDefinition);
}
