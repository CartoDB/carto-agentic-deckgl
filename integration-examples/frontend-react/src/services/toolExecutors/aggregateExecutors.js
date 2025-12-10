import { findLayerById, getLayerData } from '../deckUtils';

/**
 * Aggregate-related tool executors: AGGREGATE_FEATURES
 */

/**
 * Create AGGREGATE_FEATURES executor
 * Aggregates features by a property and returns counts
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createAggregateFeaturesExecutor({ deck, mapTools }) {
  return (params) => {
    const { layerId = 'points-layer', groupBy } = params;

    const currentLayers = deck.props.layers || [];
    const layer = findLayerById(currentLayers, layerId);

    if (!layer) {
      return { success: false, message: `Layer "${layerId}" not found` };
    }

    // Get GeoJSON data - use original if available, otherwise current
    const data = mapTools.getOriginalData(layerId) || getLayerData(layer);

    if (!data || !data.features) {
      return { success: false, message: 'No feature data available' };
    }

    if (!groupBy) {
      return { success: false, message: 'groupBy property is required' };
    }

    // Aggregate counts by property value
    const counts = new Map();
    data.features.forEach((feature) => {
      const value = String(feature.properties[groupBy] || 'unknown');
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    // Convert to sorted array (by count descending)
    const results = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    // Build table string for display
    const tableRows = results
      .map((r) => `${r.value}: ${r.count}`)
      .join('\n');
    const total = data.features.length;

    return {
      success: true,
      message: `Aggregation by "${groupBy}" (${total} total features):\n${tableRows}`,
      data: {
        groupBy,
        total,
        groups: results,
      },
    };
  };
}
