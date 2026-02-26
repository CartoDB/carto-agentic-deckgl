import * as z from 'zod';
import { TOOL_NAMES } from './dictionary.js';

/**
 * Tool output types:
 * - 'spec': Returns a @deck.gl/json spec to be applied via JSONConverter
 * - 'data': Returns query data (not a spec)
 */
type ToolOutputType = 'spec' | 'data';

/**
 * Consolidated Tool Definitions
 *
 * Single tool provides complete map control using the "Teach the agent Deck.gl" pattern
 * from simpleAgentMap. Instead of 40+ granular tools, we use JSONConverter as the central engine.
 */
export const tools = {
  // ============================================================================
  // Consolidated Tool (simpleAgentMap pattern)
  // This single tool replaces the 40+ granular tools for simpler integration
  // ============================================================================

  [TOOL_NAMES.SET_DECK_STATE]: {
    name: TOOL_NAMES.SET_DECK_STATE,
    description: `Set Deck.gl visualization state including view navigation, basemap style, layers, widgets, and effects.`,
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      initialViewState: z.object({
        latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
        longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
        zoom: z.number().min(0).max(22).describe('Zoom level (0-22)'),
        pitch: z.number().min(0).max(85).optional().describe('Map pitch/tilt in degrees (0-85)'),
        bearing: z.number().min(-180).max(180).optional().describe('Map bearing/rotation in degrees'),
        transitionDuration: z.number().min(0).optional().describe('Animation duration in milliseconds'),
      }).optional().describe('Navigate the map to specific coordinates with optional pitch/bearing'),
      mapStyle: z.enum(['dark-matter', 'positron', 'voyager']).optional().describe(
        'Basemap style: dark-matter (dark theme), positron (light theme), voyager (colorful roads)'
      ),
      layers: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl layer configurations in JSON format. Each layer must have @@type.'
      ),
      widgets: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl widget configurations. Each widget must have @@type.'
      ),
      effects: z.array(z.record(z.string(), z.unknown())).optional().describe(
        'Array of Deck.gl effect configurations like LightingEffect.'
      ),
      layerOrder: z.array(z.string()).optional().describe(
        'Array of layer IDs specifying the desired render order. First ID renders at bottom, last ID renders on top. Use to reorder existing layers.'
      ),
      removeLayerIds: z.array(z.string()).optional().describe(
        'Array of layer IDs to remove from the map. Process removals before any layer updates/additions.'
      ),
    }),
  },

  [TOOL_NAMES.SET_MARKER]: {
    name: TOOL_NAMES.SET_MARKER,
    description: 'Add a location marker pin on the map at the specified coordinates.',
    outputType: 'spec' as ToolOutputType,
    schema: z.object({
      latitude: z.number().min(-90).max(90).describe('Latitude coordinate for marker placement'),
      longitude: z.number().min(-180).max(180).describe('Longitude coordinate for marker placement'),
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
 * This single tool replaces the 40+ granular tools for simpler integration
 */
export const consolidatedToolNames: ToolName[] = [
  TOOL_NAMES.SET_DECK_STATE,
  TOOL_NAMES.SET_MARKER,
];

/**
 * Get consolidated tool definitions
 * Use this for the simplified JSONConverter-based architecture
 */
export function getConsolidatedToolDefinitions() {
  return consolidatedToolNames.map(getToolDefinition);
}
