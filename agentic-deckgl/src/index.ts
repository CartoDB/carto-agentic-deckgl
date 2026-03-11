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
  // Consolidated tool pattern (1 tool)
  consolidatedToolNames,
  getConsolidatedToolDefinitions,
} from './definitions';

// Re-export backwards compatibility exports
export {
  BUILTIN_TOOLS,
  TOOL_NAMES,
  getToolDefinitions,
  type ToolNameValue,
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

// Re-export prompts module
export {
  // Types
  type ToolPromptConfig,
  type MapViewState,
  type LayerState,
  type MapState,
  type ProximityWeight,
  type UserContext,
  type BuildSystemPromptOptions,
  // Tool prompts
  toolPrompts,
  getToolPrompt,
  getToolPrompts,
  // Shared sections
  sharedSections,
  getSharedSection,
  // Builder functions
  buildSystemPrompt,
  buildMapStateSection,
  buildUserContextSection,
} from './prompts';

// Re-export executors utilities (response formatting and error codes)
export {
  ErrorCodes,
  createError,
  successResponse,
  errorResponse,
  formatToolResponse,
  type ErrorCode,
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
  // Utilities
  mergeSpecs,
  hasViewStateChanges,
  hasLayerChanges,
  getAffectedLayerIds,
  // Agentic SDK converters
  getToolsForOpenAIAgents,
  getToolsForGoogleADK,
  getToolsForVercelAI,
  getToolsRecordForVercelAI,
  isFrontendToolResult,
  parseFrontendToolResult,
  type OpenAIAgentToolDef,
  type GoogleADKToolDef,
  type VercelAIToolDef,
  type FrontendToolResult,
} from './converters';
