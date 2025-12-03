/**
 * Tool names dictionary with kebab-case naming convention
 * Use these constants to reference tools by name in a type-safe way
 */
export const TOOL_NAMES = {
  FLY_TO: 'fly-to',
  ZOOM_MAP: 'zoom-map',
  TOGGLE_LAYER: 'toggle-layer',
  SET_POINT_COLOR: 'set-point-color',
  COLOR_FEATURES_BY_PROPERTY: 'color-features-by-property',
  QUERY_FEATURES: 'query-features',
  FILTER_FEATURES_BY_PROPERTY: 'filter-features-by-property',
  SIZE_FEATURES_BY_PROPERTY: 'size-features-by-property',
  AGGREGATE_FEATURES: 'aggregate-features',
} as const;

// Re-export everything from tools.ts
export {
  tools,
  type ToolName,
  getToolNames,
  getTool,
  getToolDefinition,
  getAllToolDefinitions,
  getToolDefinitionsByNames,
  validateToolParams,
} from './tools';

import type { ToolDefinition } from '../core/types';
import { tools, getAllToolDefinitions, getToolDefinition, type ToolName } from './tools';

/**
 * Get schema for a specific tool (OpenAI function calling format)
 * @deprecated Use getToolDefinition() instead
 */
export function getToolSchema(name: ToolName): ToolDefinition {
  return getToolDefinition(name) as ToolDefinition;
}

/**
 * Get all tool schemas (OpenAI function calling format)
 * @deprecated Use getAllToolDefinitions() instead
 */
export function getAllToolSchemas(): ToolDefinition[] {
  return getAllToolDefinitions() as ToolDefinition[];
}

/**
 * Get tool schemas by names (OpenAI function calling format)
 * @deprecated Use getToolDefinitionsByNames() instead
 */
export function getToolSchemasByNames(names: ToolName[]): ToolDefinition[] {
  return names.map(name => getToolDefinition(name) as ToolDefinition);
}

/**
 * Map of tool names to their schema definitions
 * @deprecated Use tools object from './tools' directly
 */
export const toolSchemas: Record<ToolName, ToolDefinition> = Object.fromEntries(
  (Object.keys(tools) as ToolName[]).map(name => [name, getToolDefinition(name)])
) as Record<ToolName, ToolDefinition>;

/**
 * @deprecated Use TOOL_NAMES instead. This is kept for backward compatibility.
 */
export const toolsDictionary = {
  zoomMap: TOOL_NAMES.ZOOM_MAP,
  flyTo: TOOL_NAMES.FLY_TO,
  toggleLayer: TOOL_NAMES.TOGGLE_LAYER,
  setPointColor: TOOL_NAMES.SET_POINT_COLOR,
  colorFeaturesByProperty: TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY,
  queryFeatures: TOOL_NAMES.QUERY_FEATURES,
  filterFeaturesByProperty: TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY,
  sizeFeaturesByProperty: TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY,
  aggregateFeatures: TOOL_NAMES.AGGREGATE_FEATURES,
} as const;
