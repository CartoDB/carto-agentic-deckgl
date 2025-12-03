import { ToolExecutor } from '../core/types';
import { executeZoom } from './zoom-executor';
import { executeFlyTo } from './fly-executor';
import { executeToggleLayer } from './toggle-executor';
import { TOOL_NAMES } from '../definitions/dictionary';

export * from './zoom-executor';
export * from './fly-executor';
export * from './toggle-executor';

// Export communication utilities
export * from './interface';
export * from './send';
export * from './errors';

/**
 * Registry of all built-in executors (kebab-case keys)
 */
export const BUILTIN_EXECUTORS: Record<string, ToolExecutor> = {
  [TOOL_NAMES.ZOOM_MAP]: executeZoom,
  [TOOL_NAMES.FLY_TO]: executeFlyTo,
  [TOOL_NAMES.TOGGLE_LAYER]: executeToggleLayer,
};
