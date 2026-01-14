/**
 * Spec Converters
 *
 * Export utility functions for @deck.gl/json output
 */

export {
  // Utilities
  mergeSpecs,
  hasViewStateChanges,
  hasLayerChanges,
  getAffectedLayerIds,
} from './spec-generator';

/**
 * Agentic SDK Converters
 *
 * Export converters for various AI agent frameworks
 */
export {
  // OpenAI Agents SDK
  getToolsForOpenAIAgents,
  type OpenAIAgentToolDef,
  // Google ADK
  getToolsForGoogleADK,
  type GoogleADKToolDef,
  // Vercel AI SDK
  getToolsForVercelAI,
  getToolsRecordForVercelAI,
  type VercelAIToolDef,
  // Utilities
  isFrontendToolResult,
  parseFrontendToolResult,
  type FrontendToolResult,
} from './agentic-sdks';
