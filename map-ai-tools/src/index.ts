// Re-export types
export * from './core/types';

// Re-export Zod-based definitions (primary API)
export {
  tools,
  getToolNames,
  getTool,
  getToolDefinition,
  getAllToolDefinitions,
  getToolDefinitionsByNames,
  validateToolParams,
} from './definitions';

// Re-export backwards compatibility exports
export {
  BUILTIN_TOOLS,
  TOOL_NAMES,
  toolsDictionary,
  toolSchemas,
  getToolDefinitions,
  // Deprecated aliases
  getToolSchema,
  getAllToolSchemas,
  getToolSchemasByNames,
} from './definitions';

export type { ToolName } from './definitions';

// Re-export utilities (response parsing)
export {
  parseToolResponse,
  isSuccessResponse,
  isErrorResponse,
  type ToolResponse,
  type ToolError,
  type ParsedToolResponse,
  type LegacyToolResponse,
} from './utils';

// Re-export executors
export {
  BUILTIN_EXECUTORS,
  executeZoom,
  executeFlyTo,
  executeToggleLayer,
} from './executors';

// Re-export communication utilities (NEW_ARCHITECTURE.md)
export {
  send,
  createToolRequest,
  type SendOptions,
  type ToolRequest,
  ErrorCodes,
  createError,
  successResponse,
  errorResponse,
  formatToolResponse,
  type ErrorCode,
  // Response interfaces
  type FlyToResponse,
  type ZoomMapResponse,
  type ToggleLayerResponse,
  type SetPointColorResponse,
  type ColorFeaturesByPropertyResponse,
  type QueryFeaturesResponse,
  type FilterFeaturesResponse,
  type SizeFeaturesResponse,
  type AggregateFeaturesResponse,
} from './executors';

// Re-export prompts
export {
  BASE_SYSTEM_PROMPT,
  getSystemPrompt,
  generateToolDescriptions,
} from './prompts';

// Re-export core classes
export { ToolRegistry } from './core/tool-registry';
export { MapToolsExecutor } from './core/executor-factory';
export { validateParameters, validateWithZod, type ValidationResult } from './core/validation';

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
 *   tools: ['zoom-map', 'fly-to', 'toggle-layer']
 * });
 *
 * await mapTools.execute('zoom-map', { direction: 'in', levels: 2 });
 * await mapTools.execute('fly-to', { lat: 40.7128, lng: -74.006, zoom: 12 });
 * ```
 */
export function createMapTools(config: MapToolsConfig): MapToolsExecutor {
  return new MapToolsExecutor(config);
}
