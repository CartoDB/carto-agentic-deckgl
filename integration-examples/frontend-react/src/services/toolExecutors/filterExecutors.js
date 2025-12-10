import { DEFAULT_LAYER_COLOR } from '../../config/constants';
import {
  scheduleRedraws,
  REDRAW_PRESETS,
  updateLayer,
  findLayerById,
  getLayerData,
  createPropertyMatcher,
  countMatchingFeatures,
  filterFeatures,
} from '../deckUtils';

/**
 * Filter-related tool executors: QUERY_FEATURES, FILTER_FEATURES_BY_PROPERTY, COLOR_FEATURES_BY_PROPERTY
 */

/**
 * Create QUERY_FEATURES executor
 * Queries features and returns count/sample data
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @returns {Function} Executor function
 */
export function createQueryFeaturesExecutor({ deck }) {
  return (params) => {
    const {
      layerId = 'points-layer',
      property,
      operator = 'equals',
      value = '',
      includeNames = false,
    } = params;

    const currentLayers = deck.props.layers || [];
    const layer = findLayerById(currentLayers, layerId);

    if (!layer) {
      return { success: false, message: `Layer "${layerId}" not found` };
    }

    const data = getLayerData(layer);
    if (!data || !data.features) {
      return { success: false, message: 'No feature data available' };
    }

    // Create matcher and count matching features
    const matcher = createPropertyMatcher(property, operator, value);
    const { count, total, matchingFeatures } = countMatchingFeatures(data, matcher);

    // Build response message
    let message = '';
    if (operator === 'all') {
      message = `Total features: ${count}`;
    } else {
      message = `Found ${count} features where ${property} ${operator} "${value}" (out of ${total} total)`;
    }

    // Include sample names if requested
    let sampleNames = [];
    if (includeNames && matchingFeatures.length > 0) {
      sampleNames = matchingFeatures
        .slice(0, 10)
        .map((f) => f.properties.name || f.properties.abbrev || 'Unknown')
        .filter(Boolean);
    }

    return {
      success: true,
      message,
      data: {
        count,
        total,
        sampleNames: sampleNames.length > 0 ? sampleNames : undefined,
      },
    };
  };
}

/**
 * Create FILTER_FEATURES_BY_PROPERTY executor
 * Filters visible features by property value
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createFilterFeaturesExecutor({ deck, mapTools }) {
  return (params) => {
    const {
      layerId = 'points-layer',
      property,
      operator = 'equals',
      value = '',
      reset = false,
    } = params;

    const currentLayers = deck.props.layers || [];
    const layer = findLayerById(currentLayers, layerId);

    if (!layer) {
      return { success: false, message: `Layer "${layerId}" not found` };
    }

    // Get or store original data using context
    const originalData = mapTools.getOrSetOriginalData(layerId, getLayerData(layer));

    if (!originalData || !originalData.features) {
      return { success: false, message: 'No feature data available' };
    }

    // Handle reset case
    if (reset) {
      const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
        l.clone({
          data: originalData,
          updateTriggers: { data: 'reset' },
        })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.instant);
      mapTools.clearActiveFilter(layerId);

      return {
        success: true,
        message: `Filter cleared - showing all ${originalData.features.length} features`,
      };
    }

    // Validate required params for filtering
    if (!property) {
      return {
        success: false,
        message: 'Property is required for filtering. Use reset=true to clear filters.',
      };
    }

    // Create matcher and filter features
    const matcher = createPropertyMatcher(property, operator, value);
    const filteredData = filterFeatures(originalData, matcher);

    // Update layer with filtered data
    const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
      l.clone({
        data: filteredData,
        updateTriggers: { data: `${property}:${operator}:${value}` },
      })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

    // Persist active filter to context
    mapTools.setActiveFilter(layerId, { property, operator, value });

    return {
      success: true,
      message: `Filtered to ${filteredData.features.length} features where ${property} ${operator} "${value}"`,
    };
  };
}

/**
 * Create COLOR_FEATURES_BY_PROPERTY executor
 * Colors features based on property matching
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createColorFeaturesExecutor({ deck, mapTools }) {
  return (params) => {
    const {
      layerId = 'points-layer',
      property,
      operator = 'equals',
      value,
      r,
      g,
      b,
      a = 180,
    } = params;

    const filterColor = [r, g, b, a];
    const currentLayers = deck.props.layers || [];

    // Create filter key and object
    const filterKey = `${property}:${operator}:${value}`;
    const newFilter = {
      key: filterKey,
      property,
      operator,
      value,
      color: filterColor,
    };

    // Add filter using context (merges with existing filters)
    const filters = mapTools.addColorFilter(layerId, newFilter);

    // Create color accessor using context
    const colorAccessor = mapTools.createColorAccessor(layerId, DEFAULT_LAYER_COLOR);

    // Update layer with new color accessor
    const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
      layer.clone({
        getFillColor: colorAccessor,
        updateTriggers: { getFillColor: JSON.stringify(filters) },
      })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

    return {
      success: true,
      message: `Colored features where ${property} ${operator} "${value}"`,
    };
  };
}
