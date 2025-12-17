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
  isSpecTool,
  isDataTool,
  getSpecTools,
  getDataTools,
} from './definitions';

// Re-export backwards compatibility exports
export {
  BUILTIN_TOOLS,
  TOOL_NAMES,
  getToolDefinitions,
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
} from './utils';

// Re-export executors utilities (response formatting and error codes)
export {
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

// Re-export core validation
export { validateWithZod, type ValidationResult } from './core/validation';

// ============================================================================
// @deck.gl/json Schema Exports
// ============================================================================

// Schema types and validators
export {
  // Core schemas
  deckGLJsonSpecSchema,
  viewStateSpecSchema,
  layerSpecSchema,
  layerOperationSchema,
  // Utility functions
  isSpecialPrefix,
  isFunctionRef,
  isConstantRef,
  isExpression,
  createFunctionRef,
  createConstantRef,
  createExpression,
} from './schemas';

// Layer-specific schemas
export {
  supportedLayerTypes,
  layerTypeSchema,
  getLayerSpecSchema,
  anyLayerSpecSchema,
  geoJsonLayerSpecSchema,
  rasterTileLayerSpecSchema,
  scatterplotLayerSpecSchema,
} from './schemas';

// Initial state
export {
  initialStateSchema,
  createSystemPromptWithState,
  parseInitialState,
  validateInitialState,
  createMinimalInitialState,
} from './schemas';

// ============================================================================
// Spec Generator Exports
// ============================================================================

export {
  // View state generators
  generateFlyToSpec,
  generateZoomSpec,
  generateViewStateSpec,
  // Layer operation generators
  generateToggleLayerSpec,
  generateSetPointColorSpec,
  generateColorByPropertySpec,
  generateFilterSpec,
  generateSizeByPropertySpec,
  // Layer management generators
  generateAddLayerSpec,
  generateAddRasterLayerSpec,
  generateRemoveLayerSpec,
  generateUpdateLayerPropsSpec,
  // Utilities
  mergeSpecs,
  hasViewStateChanges,
  hasLayerChanges,
  getAffectedLayerIds,
} from './converters';
