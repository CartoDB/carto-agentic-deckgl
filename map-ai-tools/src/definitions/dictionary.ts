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

