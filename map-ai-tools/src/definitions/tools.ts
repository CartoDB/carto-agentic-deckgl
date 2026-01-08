import * as z from 'zod';
import { supportedLayerTypes, layerTypeSchema } from '../schemas/layer-specs';
import { colorSchema, optionalNumber, optionalBoolean, coerceBoolean } from '../schemas/coercion-helpers';

/**
 * Size rule for dynamic feature sizing
 */
const sizeRuleSchema = z.object({
  value: z.string().describe('The property value to match'),
  size: z.number().min(1).max(200).describe('The size in pixels for matching features'),
});

/**
 * Tool output types:
 * - 'spec': Returns a @deck.gl/json spec to be applied via JSONConverter
 * - 'data': Returns query data (not a spec)
 */
type ToolOutputType = 'spec' | 'data';

/**
 * Complete tool definitions - name, description, schema, and output type
 * This is the single source of truth for all tool metadata
 */
export const tools = {
  // ============================================================================
  // View State Tools
  // ============================================================================

  'fly-to': {
    name: 'fly-to',
    description: 'Fly the map to a specific location with smooth animation. Use this to navigate to coordinates.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      lat: z.number().min(-90).max(90).describe('Latitude coordinate (-90 to 90)'),
      lng: z.number().min(-180).max(180).describe('Longitude coordinate (-180 to 180)'),
      zoom: z.number().min(0).max(22).default(12).describe('Zoom level (0 to 22). Default is 12.'),
      pitch: z.number().min(0).max(85).default(0).describe('Map pitch/tilt in degrees (0 to 85). Default is 0.'),
      bearing: z.number().min(-180).max(180).default(0).describe('Map bearing/rotation in degrees. Default is 0.'),
      transitionDuration: z.number().min(0).default(1000).describe('Animation duration in ms. Default is 1000.'),
    }),
  },

  'zoom-map': {
    name: 'zoom-map',
    description: 'Control the map zoom level. Use this when the user wants to zoom in or out.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      direction: z.enum(['in', 'out']).describe('Zoom direction: "in" to zoom in, "out" to zoom out'),
      levels: z.number().min(1).max(10).default(1).describe('Number of zoom levels to change (default: 1)'),
    }),
  },

  'set-view-state': {
    name: 'set-view-state',
    description: 'Set absolute view state values. Use this to set specific view parameters like pitch, bearing, or exact zoom level.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      longitude: z.number().min(-180).max(180).nullable().optional().describe('Longitude coordinate'),
      latitude: z.number().min(-90).max(90).nullable().optional().describe('Latitude coordinate'),
      zoom: z.number().min(0).max(22).nullable().optional().describe('Zoom level (0 to 22)'),
      pitch: z.number().min(0).max(85).nullable().optional().describe('Map pitch/tilt in degrees (0 to 85)'),
      bearing: z.number().min(-180).max(180).nullable().optional().describe('Map bearing/rotation in degrees'),
      transitionDuration: z.number().min(0).default(500).describe('Animation duration in ms. Default is 500.'),
    }),
  },

  'rotate-map': {
    name: 'rotate-map',
    description: 'Rotate the map view by adjusting the bearing. Use positive values to rotate clockwise.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      bearing: z.number().min(-180).max(180).describe('Target bearing/rotation in degrees (-180 to 180)'),
      relative: z.boolean().default(false).describe('If true, adds to current bearing. If false, sets absolute bearing.'),
      transitionDuration: z.number().min(0).default(500).describe('Animation duration in ms. Default is 500.'),
    }),
  },

  'set-pitch': {
    name: 'set-pitch',
    description: 'Tilt the map view by adjusting the pitch angle. 0 is looking straight down, 85 is nearly horizontal.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      pitch: z.number().min(0).max(85).describe('Target pitch/tilt in degrees (0 to 85)'),
      transitionDuration: z.number().min(0).default(500).describe('Animation duration in ms. Default is 500.'),
    }),
  },

  // ============================================================================
  // Layer Visibility & Styling Tools
  // ============================================================================

  'toggle-layer': {
    name: 'toggle-layer',
    description: 'Show or hide a map layer by its name or ID.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerName: z.string().describe('The name or ID of the layer to toggle'),
      visible: z.boolean().describe('Whether the layer should be visible (true) or hidden (false)'),
    }),
  },

  'set-point-color': {
    name: 'set-point-color',
    description: 'Set a uniform color for all points on a layer. Use this to change the color of all points at once.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to color. Default is "points-layer".'),
      r: z.number().int().min(0).max(255).describe('Red color component (0-255)'),
      g: z.number().int().min(0).max(255).describe('Green color component (0-255)'),
      b: z.number().int().min(0).max(255).describe('Blue color component (0-255)'),
      a: z.number().int().min(0).max(255).default(200).describe('Alpha (opacity) component (0-255). Default is 200.'),
    }),
  },

  'color-features-by-property': {
    name: 'color-features-by-property',
    description: 'Color features conditionally based on a property value. Filters can be stacked - features matching multiple filters will use the first matching color.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to color. Default is "points-layer".'),
      property: z.string().describe('The feature property to filter by (e.g., "name", "type", "region")'),
      operator: z.enum(['equals', 'startsWith', 'contains', 'regex']).default('equals').describe('The comparison operator. Default is "equals".'),
      value: z.string().describe('The value to compare against'),
      r: z.number().int().min(0).max(255).describe('Red color component (0-255)'),
      g: z.number().int().min(0).max(255).describe('Green color component (0-255)'),
      b: z.number().int().min(0).max(255).describe('Blue color component (0-255)'),
      a: z.number().int().min(0).max(255).default(180).describe('Alpha (opacity) component (0-255). Default is 180.'),
    }),
  },

  'filter-features-by-property': {
    name: 'filter-features-by-property',
    description: 'Filter the visible features on a layer based on property values. Only matching features will be displayed. Use reset=true to show all features again.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to filter. Default is "points-layer".'),
      property: z.string().nullable().optional().describe('The feature property to filter by (e.g., "name", "type", "region"). Not required when reset=true.'),
      operator: z.enum(['equals', 'startsWith', 'contains', 'regex']).default('equals').describe('The comparison operator. Default is "equals".'),
      value: z.string().nullable().optional().describe('The value to compare against. Not required when reset=true.'),
      reset: z.boolean().default(false).describe('Set to true to clear all filters and show all features. Default is false.'),
    }),
  },

  'size-features-by-property': {
    name: 'size-features-by-property',
    description: 'Set the size of features dynamically based on a property value. Define rules to map property values to sizes in pixels.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to resize. Default is "points-layer".'),
      property: z.string().nullable().optional().describe('The feature property to use for sizing (e.g., "type", "category"). Not required when reset=true.'),
      sizeRules: z.array(sizeRuleSchema).nullable().optional().describe('Array of rules mapping property values to sizes'),
      defaultSize: z.number().min(1).max(200).default(8).describe('Default size in pixels for features that don\'t match any rule. Default is 8.'),
      reset: z.boolean().default(false).describe('Set to true to reset to uniform sizing. Default is false.'),
    }),
  },

  'show-hide-layer': {
    name: 'show-hide-layer',
    description: `Show or hide a map layer. Use this tool when user asks to:
- "hide the subway" → { layerId: "subway", visible: false }
- "show traffic" → { layerId: "traffic-before", visible: true }
- "turn off the congestion zone" → { layerId: "congestion-zone", visible: false }
- "display regional improvement" → { layerId: "regional-improvement", visible: true }

This tool ONLY changes visibility. For other style changes (colors, width, opacity), use update-layer-style instead.`,
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().min(1).describe('The layer ID to show/hide (required)'),
      visible: z.preprocess(
        coerceBoolean,
        z.boolean().describe('true to show the layer, false to hide it')
      ),
    }),
  },

  'update-layer-style': {
    name: 'update-layer-style',
    description: `Update visual styling of a map layer.

**CRITICAL - PARTIAL UPDATES ONLY:**
- ONLY include properties the user explicitly mentioned in their request
- If user says "make it blue" → ONLY include lineColor (or fillColor), nothing else
- If user says "change width to 50" → ONLY include widthMinPixels, nothing else
- If user says "make trails blue and thicker" → ONLY include lineColor and widthMinPixels
- Do NOT include opacity, visible, stroked, filled, fadeTrail, capRounded, jointRounded, extruded, wireframe, or ANY other properties unless the user specifically asked for them
- Omitted properties are automatically preserved via layer.clone() - you don't need to specify them

Uses @deck.gl/json standard with layer.clone() for state preservation.

IMPORTANT: Do NOT use "default" as a value. If user wants to reset styles, use the reset-visualization tool instead.

VISIBILITY RULES:
- To HIDE a layer: use visible: false (e.g., "hide subway" → { layerId: "subway", visible: false })
- To SHOW a layer: use visible: true (e.g., "show subway" → { layerId: "subway", visible: true })

COLOR SELECTION RULES (CRITICAL - follow exactly):
- If user mentions "line", "lines", "stroke", "border", "outline", "edge", or "trail" → ONLY set lineColor, do NOT set fillColor
- If user mentions "fill", "background", "interior", or "inside" → ONLY set fillColor, do NOT set lineColor
- If user request is ambiguous (e.g., "make it red", "change color") → set BOTH fillColor and lineColor
- NEVER add a color property that wasn't implied by user's words
- For data-driven layers (QuadbinTileLayer, H3TileLayer), use colorScheme instead of fillColor/lineColor

PROPERTY USAGE BY LAYER TYPE:
- GeoJsonLayer (polygons): fillColor, lineColor, lineWidth, lineWidthMinPixels, opacity, stroked, filled, extruded, elevation, visible
- TripsLayer (trails): lineColor, widthMinPixels, trailLength, opacity, fadeTrail, visible
- PathLayer (lines): lineColor, widthMinPixels, widthMaxPixels, opacity, capRounded, jointRounded, visible
- ScatterplotLayer (points): fillColor, lineColor, pointRadius, radiusMinPixels, radiusMaxPixels, stroked, filled, visible
- QuadbinTileLayer/H3TileLayer: colorScheme (CARTO palette name), opacity, visible

**IMPORTANT**: ONLY include the 1-3 properties the user explicitly requested. Never include unrequested properties - they are automatically preserved.
Colors: names (red, blue, green, yellow, orange, purple, pink, cyan, white, black, gray) or RGBA arrays [r,g,b,a].
Color schemes: Purp, BluYl, Emrld, PinkYl, SunsetDark, Teal, RedOr, etc.`,
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().describe('The layer ID to update'),
      colorScheme: z.string().nullable().optional()
        .describe('CARTO color palette name for data-driven layers (e.g., "Purp", "BluYl", "SunsetDark", "Emrld", "PinkYl")'),
      fillColor: colorSchema
        .describe('Fill color for polygons/points - name or RGBA array'),
      lineColor: colorSchema
        .describe('Line/stroke/trail color - name or RGBA array'),
      opacity: optionalNumber(0, 1)
        .describe('Layer opacity from 0 (transparent) to 1 (opaque)'),
      visible: optionalBoolean
        .describe('Layer visibility (true/false)'),
      lineWidth: optionalNumber(0)
        .describe('Line width in meters (GeoJsonLayer getLineWidth)'),
      lineWidthMinPixels: optionalNumber(0)
        .describe('Minimum line width in pixels - prevents lines from becoming too thin'),
      lineWidthMaxPixels: optionalNumber(0)
        .describe('Maximum line width in pixels - prevents lines from becoming too thick'),
      widthMinPixels: optionalNumber(0)
        .describe('Minimum path/trail width in pixels (TripsLayer, PathLayer)'),
      widthMaxPixels: optionalNumber(0)
        .describe('Maximum path/trail width in pixels (TripsLayer, PathLayer)'),
      widthScale: optionalNumber(0)
        .describe('Width multiplier for all paths/trails'),
      pointRadius: optionalNumber(0)
        .describe('Point/circle radius in meters'),
      radiusMinPixels: optionalNumber(0)
        .describe('Minimum point radius in pixels'),
      radiusMaxPixels: optionalNumber(0)
        .describe('Maximum point radius in pixels'),
      radiusScale: optionalNumber(0)
        .describe('Radius multiplier for all points'),
      stroked: optionalBoolean
        .describe('Whether to draw stroke/outline around polygons and points'),
      filled: optionalBoolean
        .describe('Whether to draw filled polygons and points'),
      trailLength: optionalNumber(0)
        .describe('Trail length - how long it takes for path to fade out (TripsLayer)'),
      fadeTrail: optionalBoolean
        .describe('Whether trail fades out (TripsLayer) - if false, trailLength has no effect'),
      capRounded: optionalBoolean
        .describe('Round line caps (true) or square caps (false)'),
      jointRounded: optionalBoolean
        .describe('Round line joints (true) or miter joints (false)'),
      elevation: optionalNumber(0)
        .describe('Extrusion height in meters (for extruded polygons)'),
      elevationScale: optionalNumber(0)
        .describe('Elevation multiplier'),
      extruded: optionalBoolean
        .describe('Whether to extrude polygons into 3D'),
      wireframe: optionalBoolean
        .describe('Whether to show wireframe for extruded polygons'),
    }),
  },

  'reset-visualization': {
    name: 'reset-visualization',
    description: `Reset the visualization to its original state. Use this when user asks to "reset", "restore defaults", "go back to original", or "undo changes".

This tool resets:
- All layer styles to their original colors, widths, and properties
- Optionally resets the view state (camera position, zoom, pitch, bearing)
- Optionally navigates to a specific slide

Use this tool instead of trying to set properties to "default" values.`,
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      resetLayers: optionalBoolean
        .describe('Reset all layer styles to original (default: true)'),
      resetViewState: optionalBoolean
        .describe('Reset camera/view to original position (default: false)'),
      targetSlide: optionalNumber(0)
        .describe('Navigate to specific slide number after reset. Use the slide number as shown in the presentation (e.g., "Slide 1" → targetSlide: 1, "Slide 0" → targetSlide: 0). Do NOT convert from 1-indexed.'),
    }),
  },

  // ============================================================================
  // Layer Management Tools
  // ============================================================================

  'add-layer': {
    name: 'add-layer',
    description: 'Add a new layer to the map. Supports GeoJsonLayer, RasterTileLayer, ScatterplotLayer, and other deck.gl layer types.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerType: layerTypeSchema.describe(`Layer type. Supported: ${supportedLayerTypes.join(', ')}`),
      id: z.string().describe('Unique identifier for the new layer'),
      data: z.union([
        z.string().describe('URL to data or function reference'),
        z.record(z.string(), z.unknown()).describe('Inline data object'),
      ]).nullable().optional().describe('Data source for the layer'),
      visible: z.boolean().default(true).describe('Whether the layer should be visible. Default is true.'),
      opacity: z.number().min(0).max(1).default(1).describe('Layer opacity (0-1). Default is 1.'),
      props: z.record(z.string(), z.unknown()).nullable().optional().describe('Additional layer-specific properties'),
    }),
  },

  'add-raster-layer': {
    name: 'add-raster-layer',
    description: 'Add a CARTO RasterTileLayer to visualize raster data from BigQuery or Snowflake.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      id: z.string().describe('Unique identifier for the new layer'),
      connectionName: z.string().default('carto_dw').describe('CARTO connection name. Default is "carto_dw".'),
      tableName: z.string().describe('Fully qualified table name (e.g., "cartobq.public_account.temperature_raster_int8_new")'),
      visible: z.boolean().default(true).describe('Whether the layer should be visible. Default is true.'),
    }),
  },

  'add-vector-layer': {
    name: 'add-vector-layer',
    description: 'Add a CARTO VectorTileLayer to visualize vector data from BigQuery or Snowflake. Use this to add point, line, or polygon data from CARTO data warehouse. When using data from MCP workflow results, extract connectionName, tableName, accessToken, and apiBaseUrl from the response.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      id: z.string().describe('Unique identifier for the new layer'),
      connectionName: z.string().default('carto_dw').describe('CARTO connection name. When using MCP workflow results, extract this from response.data.connectionName. Default is "carto_dw" for direct table access.'),
      tableName: z.string().describe('Fully qualified table name (e.g., "cartobq.public_account.airports"). When using MCP workflow results, extract this from response.data.jobMetadata.workflowOutputTableName.'),
      accessToken: z.string().nullable().optional().describe('CARTO API access token. When using MCP workflow results, extract this from response.data.accessToken. If not provided, uses default credentials.'),
      apiBaseUrl: z.string().nullable().optional().describe('CARTO API base URL. When using MCP workflow results, extract this from response.data.apiBaseUrl. If not provided, uses default URL.'),
      columns: z.array(z.string()).nullable().optional().describe('Array of column names to fetch from the table. If not specified, fetches all columns.'),
      spatialDataColumn: z.string().nullable().optional().describe('Name of the spatial data column. Defaults to "geom" or auto-detected.'),
      visible: z.boolean().default(true).describe('Whether the layer should be visible. Default is true.'),
      opacity: z.number().min(0).max(1).default(1).describe('Layer opacity (0-1). Default is 1.'),
      fillColor: z.union([
        z.string().min(1),
        z.array(z.number()).min(3).max(4),
      ]).nullable().optional().describe('Fill color for polygons/points - name or RGBA array. Default is blue.'),
      lineColor: z.union([
        z.string().min(1),
        z.array(z.number()).min(3).max(4),
      ]).nullable().optional().describe('Line color for lines/polygon outlines - name or RGBA array. Default is white.'),
      pointRadiusMinPixels: z.number().min(0).nullable().optional().describe('Minimum point radius in pixels for point data.'),
      pickable: z.boolean().default(true).describe('Whether features are pickable/clickable. Default is true.'),
    }),
  },

  'remove-layer': {
    name: 'remove-layer',
    description: 'Remove a layer from the map by its ID.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().describe('The ID of the layer to remove'),
    }),
  },

  'update-layer-props': {
    name: 'update-layer-props',
    description: 'Update properties of an existing layer. Use this to modify layer configuration.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().describe('The ID of the layer to update'),
      props: z.record(z.string(), z.unknown()).describe('Properties to update on the layer'),
    }),
  },

  // ============================================================================
  // Query Tools (return data, not specs)
  // ============================================================================

  'query-features': {
    name: 'query-features',
    description: 'Query and count features based on property values. Use this to get statistics about features on the map.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to query. Default is "points-layer".'),
      property: z.string().describe('The feature property to filter by (e.g., "name", "type", "region")'),
      operator: z.enum(['equals', 'startsWith', 'contains', 'regex', 'all']).default('equals').describe('The comparison operator. Use "all" to count all features. Default is "equals".'),
      value: z.string().nullable().optional().describe('The value to compare against (not required when operator is "all")'),
      includeNames: z.boolean().default(false).describe('Whether to include sample feature names in the response. Default is false.'),
    }),
  },

  'aggregate-features': {
    name: 'aggregate-features',
    description: 'Group and count features by a property value. Returns a breakdown of how many features have each distinct value for the specified property.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to aggregate. Default is "points-layer".'),
      groupBy: z.string().describe('The property to group by (e.g., "region", "type", "category")'),
    }),
  },

  'get-layer-config': {
    name: 'get-layer-config',
    description: 'Get the current configuration of a layer. Use this to understand the layer state before making changes.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      layerId: z.string().describe('The ID of the layer to query'),
    }),
  },

  // ============================================================================
  // Presentation/Slide Tools
  // ============================================================================

  'navigate-slide': {
    name: 'navigate-slide',
    description: 'Navigate to a specific slide in the presentation by number or name. Use this when the user wants to go to a specific section of the story.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      target: z.union([
        z.number().min(0).describe('Slide number (0-based index)'),
        z.string().describe('Slide name or keyword (e.g., "cover", "intro", "temperature")'),
      ]).nullable().optional().describe('Target slide - either a number or name/keyword'),
      direction: z.enum(['next', 'previous', 'first', 'last']).nullable().optional()
        .describe('Alternative: navigate relative to current slide'),
    }),
  },

  'get-slide-info': {
    name: 'get-slide-info',
    description: 'Get information about the current slide including its index, title, available layers, and any filter controls.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      includeAllSlides: z.boolean().default(false)
        .describe('If true, returns info about all slides, not just current'),
    }),
  },

  'set-filter-value': {
    name: 'set-filter-value',
    description: 'Set the filter slider value for data filtering (e.g., temperature range, distance threshold, priority level). The value meaning depends on the current slide context.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      value: z.number().describe('Filter value - meaning depends on slide context'),
      normalized: z.boolean().default(true)
        .describe('If true, value is 0-1 normalized; if false, uses actual data units'),
    }),
  },

  'reset-view': {
    name: 'reset-view',
    description: 'Reset the map view to the default position for the current slide or to the initial app view.',
    outputType: 'data' as ToolOutputType,
    schema: z.object({
      toSlideDefault: z.boolean().default(true)
        .describe('Reset to slide\'s default view. If false, resets to initial app view.'),
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
