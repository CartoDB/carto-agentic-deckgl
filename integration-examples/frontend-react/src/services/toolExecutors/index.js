import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { createFlyToExecutor, createZoomMapExecutor } from './viewExecutors';
import { createToggleLayerExecutor, createSetPointColorExecutor } from './layerExecutors';
import {
  createQueryFeaturesExecutor,
  createFilterFeaturesExecutor,
  createColorFeaturesExecutor,
} from './filterExecutors';
import { createSizeFeaturesExecutor } from './sizeExecutors';
import { createAggregateFeaturesExecutor } from './aggregateExecutors';

/**
 * Executor Registry Pattern (Open/Closed Principle)
 * Allows adding new tools without modifying existing code
 */

/**
 * Create an executor registry
 * @returns {Object} Registry with register and createExecutors methods
 */
export function createExecutorRegistry() {
  const executors = new Map();

  return {
    /**
     * Register an executor factory
     * @param {string} toolName - The tool name from TOOL_NAMES
     * @param {Function} executorFactory - Factory function that creates the executor
     * @returns {Object} The registry (for chaining)
     */
    register(toolName, executorFactory) {
      executors.set(toolName, executorFactory);
      return this;
    },

    /**
     * Create all executors with the given context
     * @param {Object} context - Context passed to each executor factory
     * @returns {Object} Map of tool name to executor function
     */
    createExecutors(context) {
      const result = {};
      executors.forEach((factory, name) => {
        result[name] = factory(context);
      });
      return result;
    },

    /**
     * Get registered tool names
     * @returns {string[]} Array of tool names
     */
    getToolNames() {
      return Array.from(executors.keys());
    },
  };
}

/**
 * Create the default registry with all built-in executors
 * @returns {Object} Configured registry
 */
export function createDefaultRegistry() {
  return createExecutorRegistry()
    // View executors
    .register(TOOL_NAMES.FLY_TO, createFlyToExecutor)
    .register(TOOL_NAMES.ZOOM_MAP, createZoomMapExecutor)
    // Layer executors
    .register(TOOL_NAMES.TOGGLE_LAYER, createToggleLayerExecutor)
    .register(TOOL_NAMES.SET_POINT_COLOR, createSetPointColorExecutor)
    // Filter executors
    .register(TOOL_NAMES.QUERY_FEATURES, createQueryFeaturesExecutor)
    .register(TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY, createFilterFeaturesExecutor)
    .register(TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY, createColorFeaturesExecutor)
    // Size executors
    .register(TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY, createSizeFeaturesExecutor)
    // Aggregate executors
    .register(TOOL_NAMES.AGGREGATE_FEATURES, createAggregateFeaturesExecutor);
}

/**
 * Create all executors with the given context
 * Convenience function that creates and uses the default registry
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.map - MapLibre GL instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Object} Map of tool name to executor function
 */
export function createAllExecutors(context) {
  return createDefaultRegistry().createExecutors(context);
}

// Re-export individual executor factories for custom registries
export { createFlyToExecutor, createZoomMapExecutor } from './viewExecutors';
export { createToggleLayerExecutor, createSetPointColorExecutor } from './layerExecutors';
export {
  createQueryFeaturesExecutor,
  createFilterFeaturesExecutor,
  createColorFeaturesExecutor,
} from './filterExecutors';
export { createSizeFeaturesExecutor } from './sizeExecutors';
export { createAggregateFeaturesExecutor } from './aggregateExecutors';
