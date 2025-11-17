import { ToolExecutor } from '../core/types';
import { executeZoom } from './zoom-executor';
import { executeFlyTo } from './fly-executor';
import { executeToggleLayer } from './toggle-executor';

export * from './zoom-executor';
export * from './fly-executor';
export * from './toggle-executor';

/**
 * Registry of all built-in executors
 */
export const BUILTIN_EXECUTORS: Record<string, ToolExecutor> = {
  zoom_map: executeZoom,
  fly_to_location: executeFlyTo,
  toggle_layer: executeToggleLayer
};
