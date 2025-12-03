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

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];

/**
 * Get all available tool names
 */
export function getToolNames(): ToolName[] {
  return Object.values(TOOL_NAMES);
}

// Import schemas
import flyToSchema from './schemas/fly-to.schema.json';
import zoomMapSchema from './schemas/zoom-map.schema.json';
import toggleLayerSchema from './schemas/toggle-layer.schema.json';
import setPointColorSchema from './schemas/set-point-color.schema.json';
import colorFeaturesByPropertySchema from './schemas/color-features-by-property.schema.json';
import queryFeaturesSchema from './schemas/query-features.schema.json';
import filterFeaturesByPropertySchema from './schemas/filter-features-by-property.schema.json';
import sizeFeaturesByPropertySchema from './schemas/size-features-by-property.schema.json';
import aggregateFeaturesSchema from './schemas/aggregate-features.schema.json';

import type { ToolDefinition } from '../core/types';

/**
 * Map of tool names to their schema definitions
 */
export const toolSchemas: Record<ToolName, ToolDefinition> = {
  [TOOL_NAMES.FLY_TO]: flyToSchema as ToolDefinition,
  [TOOL_NAMES.ZOOM_MAP]: zoomMapSchema as ToolDefinition,
  [TOOL_NAMES.TOGGLE_LAYER]: toggleLayerSchema as ToolDefinition,
  [TOOL_NAMES.SET_POINT_COLOR]: setPointColorSchema as ToolDefinition,
  [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: colorFeaturesByPropertySchema as ToolDefinition,
  [TOOL_NAMES.QUERY_FEATURES]: queryFeaturesSchema as ToolDefinition,
  [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: filterFeaturesByPropertySchema as ToolDefinition,
  [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: sizeFeaturesByPropertySchema as ToolDefinition,
  [TOOL_NAMES.AGGREGATE_FEATURES]: aggregateFeaturesSchema as ToolDefinition,
};

/**
 * Get schema for a specific tool
 */
export function getToolSchema(name: ToolName): ToolDefinition | undefined {
  return toolSchemas[name];
}

/**
 * Get all tool schemas
 */
export function getAllToolSchemas(): ToolDefinition[] {
  return Object.values(toolSchemas);
}

/**
 * Get tool schemas by names
 */
export function getToolSchemasByNames(names: ToolName[]): ToolDefinition[] {
  return names.map(name => toolSchemas[name]).filter(Boolean);
}

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
