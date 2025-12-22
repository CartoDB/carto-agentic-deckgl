import * as z from 'zod';
import { supportedLayerTypes, layerTypeSchema } from '../schemas/layer-specs';

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
      longitude: z.number().min(-180).max(180).optional().describe('Longitude coordinate'),
      latitude: z.number().min(-90).max(90).optional().describe('Latitude coordinate'),
      zoom: z.number().min(0).max(22).optional().describe('Zoom level (0 to 22)'),
      pitch: z.number().min(0).max(85).optional().describe('Map pitch/tilt in degrees (0 to 85)'),
      bearing: z.number().min(-180).max(180).optional().describe('Map bearing/rotation in degrees'),
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
      property: z.string().optional().describe('The feature property to filter by (e.g., "name", "type", "region"). Not required when reset=true.'),
      operator: z.enum(['equals', 'startsWith', 'contains', 'regex']).default('equals').describe('The comparison operator. Default is "equals".'),
      value: z.string().optional().describe('The value to compare against. Not required when reset=true.'),
      reset: z.boolean().default(false).describe('Set to true to clear all filters and show all features. Default is false.'),
    }),
  },

  'size-features-by-property': {
    name: 'size-features-by-property',
    description: 'Set the size of features dynamically based on a property value. Define rules to map property values to sizes in pixels.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to resize. Default is "points-layer".'),
      property: z.string().optional().describe('The feature property to use for sizing (e.g., "type", "category"). Not required when reset=true.'),
      sizeRules: z.array(sizeRuleSchema).optional().describe('Array of rules mapping property values to sizes'),
      defaultSize: z.number().min(1).max(200).default(8).describe('Default size in pixels for features that don\'t match any rule. Default is 8.'),
      reset: z.boolean().default(false).describe('Set to true to reset to uniform sizing. Default is false.'),
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
      ]).optional().describe('Data source for the layer'),
      visible: z.boolean().default(true).describe('Whether the layer should be visible. Default is true.'),
      opacity: z.number().min(0).max(1).default(1).describe('Layer opacity (0-1). Default is 1.'),
      props: z.record(z.string(), z.unknown()).optional().describe('Additional layer-specific properties'),
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
      value: z.string().optional().describe('The value to compare against (not required when operator is "all")'),
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
      ]).optional().describe('Target slide - either a number or name/keyword'),
      direction: z.enum(['next', 'previous', 'first', 'last']).optional()
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
