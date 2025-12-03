import { ToolDefinition } from '../core/types';

// Export dictionary and types
export {
  TOOL_NAMES,
  toolsDictionary,
  toolSchemas,
  getToolNames,
  getToolSchema,
  getAllToolSchemas,
  getToolSchemasByNames,
} from './dictionary';

export type { ToolName } from './dictionary';

// Re-export individual tool definitions for backwards compatibility
export { default as flyToSchema } from './schemas/fly-to.schema.json';
export { default as zoomMapSchema } from './schemas/zoom-map.schema.json';
export { default as toggleLayerSchema } from './schemas/toggle-layer.schema.json';
export { default as setPointColorSchema } from './schemas/set-point-color.schema.json';
export { default as colorFeaturesByPropertySchema } from './schemas/color-features-by-property.schema.json';
export { default as queryFeaturesSchema } from './schemas/query-features.schema.json';
export { default as filterFeaturesByPropertySchema } from './schemas/filter-features-by-property.schema.json';
export { default as sizeFeaturesByPropertySchema } from './schemas/size-features-by-property.schema.json';
export { default as aggregateFeaturesSchema } from './schemas/aggregate-features.schema.json';

// Import schemas for BUILTIN_TOOLS
import { toolSchemas, TOOL_NAMES } from './dictionary';

/**
 * Registry of all built-in tools (kebab-case keys)
 */
export const BUILTIN_TOOLS: Record<string, ToolDefinition> = toolSchemas;

/**
 * Get tool definitions by name
 * @param toolNames - Array of tool names to include (default: all)
 */
export function getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
  const names = toolNames || Object.values(TOOL_NAMES);
  return names
    .filter(name => BUILTIN_TOOLS[name])
    .map(name => BUILTIN_TOOLS[name]);
}

/**
 * Get a single tool definition by name
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return BUILTIN_TOOLS[name];
}

/**
 * Get all tool definitions
 */
export function getAllToolDefinitions(): ToolDefinition[] {
  return Object.values(BUILTIN_TOOLS);
}
