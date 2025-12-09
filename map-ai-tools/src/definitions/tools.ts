import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Size rule for dynamic feature sizing
 */
const sizeRuleSchema = z.object({
  value: z.string().describe('The property value to match'),
  size: z.number().min(1).max(200).describe('The size in pixels for matching features'),
});

/**
 * Complete tool definitions - name, description, and schema in one object
 * This is the single source of truth for all tool metadata
 */
export const tools = {
  'fly-to': {
    name: 'fly-to',
    description: 'Fly the map to a specific location with smooth animation. Use this to navigate to coordinates.',
    schema: z.object({
      lat: z.number().min(-90).max(90).describe('Latitude coordinate (-90 to 90)'),
      lng: z.number().min(-180).max(180).describe('Longitude coordinate (-180 to 180)'),
      zoom: z.number().min(0).max(22).default(12).describe('Zoom level (0 to 22). Default is 12.'),
    }),
  },

  'zoom-map': {
    name: 'zoom-map',
    description: 'Control the map zoom level. Use this when the user wants to zoom in or out.',
    schema: z.object({
      direction: z.enum(['in', 'out']).describe('Zoom direction: "in" to zoom in, "out" to zoom out'),
      levels: z.number().min(1).max(10).default(1).describe('Number of zoom levels to change (default: 1)'),
    }),
  },

  'toggle-layer': {
    name: 'toggle-layer',
    description: 'Show or hide a map layer by its name. Available layers: Airports.',
    schema: z.object({
      layerName: z.string().describe('The name of the layer to toggle (e.g., "Airports")'),
      visible: z.boolean().describe('Whether the layer should be visible (true) or hidden (false)'),
    }),
  },

  'set-point-color': {
    name: 'set-point-color',
    description: 'Set a uniform color for all points on a layer. Use this to change the color of all points at once.',
    schema: z.object({
      r: z.number().int().min(0).max(255).describe('Red color component (0-255)'),
      g: z.number().int().min(0).max(255).describe('Green color component (0-255)'),
      b: z.number().int().min(0).max(255).describe('Blue color component (0-255)'),
      a: z.number().int().min(0).max(255).default(200).describe('Alpha (opacity) component (0-255). Default is 200.'),
    }),
  },

  'color-features-by-property': {
    name: 'color-features-by-property',
    description: 'Color features conditionally based on a property value. Filters can be stacked - features matching multiple filters will use the first matching color.',
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

  'query-features': {
    name: 'query-features',
    description: 'Query and count features based on property values. Use this to get statistics about features on the map.',
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to query. Default is "points-layer".'),
      property: z.string().describe('The feature property to filter by (e.g., "name", "type", "region")'),
      operator: z.enum(['equals', 'startsWith', 'contains', 'regex', 'all']).default('equals').describe('The comparison operator. Use "all" to count all features. Default is "equals".'),
      value: z.string().optional().describe('The value to compare against (not required when operator is "all")'),
      includeNames: z.boolean().default(false).describe('Whether to include sample feature names in the response. Default is false.'),
    }),
  },

  'filter-features-by-property': {
    name: 'filter-features-by-property',
    description: 'Filter the visible features on a layer based on property values. Only matching features will be displayed. Use reset=true to show all features again.',
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
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to resize. Default is "points-layer".'),
      property: z.string().optional().describe('The feature property to use for sizing (e.g., "type", "category"). Not required when reset=true.'),
      sizeRules: z.array(sizeRuleSchema).optional().describe('Array of rules mapping property values to sizes'),
      defaultSize: z.number().min(1).max(200).default(8).describe('Default size in pixels for features that don\'t match any rule. Default is 8.'),
      reset: z.boolean().default(false).describe('Set to true to reset to uniform sizing. Default is false.'),
    }),
  },

  'aggregate-features': {
    name: 'aggregate-features',
    description: 'Group and count features by a property value. Returns a breakdown of how many features have each distinct value for the specified property.',
    schema: z.object({
      layerId: z.string().default('points-layer').describe('The ID of the layer to aggregate. Default is "points-layer".'),
      groupBy: z.string().describe('The property to group by (e.g., "region", "type", "category")'),
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
      parameters: zodToJsonSchema(tool.schema, { target: 'openApi3' }),
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
