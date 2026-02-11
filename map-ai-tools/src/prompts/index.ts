/**
 * Prompts module - System prompt generation for map AI agents
 */

// Re-export types
export type {
  ToolPromptConfig,
  MapViewState,
  LayerState,
  MapState,
  ProximityWeight,
  UserContext,
  BuildSystemPromptOptions,
} from './types.js';

// Re-export tool prompts
export { toolPrompts, getToolPrompt, getToolPrompts } from './tool-prompts.js';

// Re-export shared sections
export { sharedSections, getSharedSection } from './shared-sections.js';

// Re-export builder functions
export {
  buildSystemPrompt,
  buildMapStateSection,
  buildUserContextSection,
} from './builder.js';
