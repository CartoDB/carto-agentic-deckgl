// Re-export types
export * from './core/types';

// Re-export definitions
export {
  BUILTIN_TOOLS,
  getToolDefinitions,
  ZOOM_MAP_TOOL,
  FLY_TO_LOCATION_TOOL,
  TOGGLE_LAYER_TOOL
} from './definitions';

// Re-export executors
export {
  BUILTIN_EXECUTORS,
  executeZoom,
  executeFlyTo,
  executeToggleLayer
} from './executors';

// Re-export prompts
export {
  BASE_SYSTEM_PROMPT,
  getSystemPrompt,
  generateToolDescriptions
} from './prompts';

// Re-export core classes
export { ToolRegistry } from './core/tool-registry';
export { MapToolsExecutor } from './core/executor-factory';
export { validateParameters } from './core/validation';

// Main factory function
import { MapToolsConfig } from './core/types';
import { MapToolsExecutor } from './core/executor-factory';

/**
 * Create a map tools executor instance
 *
 * @example
 * ```typescript
 * const mapTools = createMapTools({
 *   deck: deckInstance,
 *   tools: ['zoom_map', 'fly_to_location', 'toggle_layer']
 * });
 *
 * await mapTools.execute('zoom_map', { direction: 'in', levels: 2 });
 * await mapTools.execute('fly_to_location', { coordinates: [-74.006, 40.7128], zoom: 12 });
 * ```
 */
export function createMapTools(config: MapToolsConfig): MapToolsExecutor {
  return new MapToolsExecutor(config);
}
