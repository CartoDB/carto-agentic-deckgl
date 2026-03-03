/**
 * Consolidated Tool Names
 * Use these constants for type-safe tool references across backend and frontend
 */
export const TOOL_NAMES = {
  SET_DECK_STATE: 'set-deck-state',
  SET_MARKER: 'set-marker',
  SET_MASK_LAYER: 'set-mask-layer',
} as const;

/**
 * Type for tool name values
 */
export type ToolNameValue = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

