import { ToolDefinition } from '../core/types';
import { ZOOM_MAP_TOOL } from './zoom-map';
import { FLY_TO_LOCATION_TOOL } from './fly-to-location';
import { TOGGLE_LAYER_TOOL } from './toggle-layer';

export * from './zoom-map';
export * from './fly-to-location';
export * from './toggle-layer';

/**
 * Registry of all built-in tools
 */
export const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  zoom_map: ZOOM_MAP_TOOL,
  fly_to_location: FLY_TO_LOCATION_TOOL,
  toggle_layer: TOGGLE_LAYER_TOOL
};

/**
 * Get tool definitions by name
 * @param toolNames - Array of tool names to include (default: all)
 */
export function getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
  const names = toolNames || Object.keys(BUILTIN_TOOLS);
  return names
    .filter(name => BUILTIN_TOOLS[name])
    .map(name => BUILTIN_TOOLS[name]);
}
