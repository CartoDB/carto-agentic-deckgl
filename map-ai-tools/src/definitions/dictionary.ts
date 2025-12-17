/**
 * Tool names dictionary with kebab-case naming convention
 * Use these constants to reference tools by name in a type-safe way
 */
export const TOOL_NAMES = {
  // View state tools
  FLY_TO: 'fly-to',
  ZOOM_MAP: 'zoom-map',
  SET_VIEW_STATE: 'set-view-state',
  // Layer visibility & styling tools
  TOGGLE_LAYER: 'toggle-layer',
  SET_POINT_COLOR: 'set-point-color',
  COLOR_FEATURES_BY_PROPERTY: 'color-features-by-property',
  FILTER_FEATURES_BY_PROPERTY: 'filter-features-by-property',
  SIZE_FEATURES_BY_PROPERTY: 'size-features-by-property',
  // Layer management tools
  ADD_LAYER: 'add-layer',
  ADD_RASTER_LAYER: 'add-raster-layer',
  REMOVE_LAYER: 'remove-layer',
  UPDATE_LAYER_PROPS: 'update-layer-props',
  // Query tools
  QUERY_FEATURES: 'query-features',
  AGGREGATE_FEATURES: 'aggregate-features',
  GET_LAYER_CONFIG: 'get-layer-config',
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
  isSpecTool,
  isDataTool,
  getSpecTools,
  getDataTools,
} from './tools';

