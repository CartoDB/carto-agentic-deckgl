import { DEFAULT_POINT_SIZE } from '../../config/constants';
import {
  scheduleRedraws,
  REDRAW_PRESETS,
  updateLayer,
  findLayerById,
} from '../deckUtils';

/**
 * Size-related tool executors: SIZE_FEATURES_BY_PROPERTY
 */

/**
 * Create SIZE_FEATURES_BY_PROPERTY executor
 * Sizes features based on property value mapping
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createSizeFeaturesExecutor({ deck, mapTools }) {
  return (params) => {
    const {
      layerId = 'points-layer',
      property,
      sizeRules = [],
      defaultSize = DEFAULT_POINT_SIZE,
      reset = false,
    } = params;

    const currentLayers = deck.props.layers || [];
    const layer = findLayerById(currentLayers, layerId);

    if (!layer) {
      return { success: false, message: `Layer "${layerId}" not found` };
    }

    // Handle reset case
    if (reset) {
      mapTools.clearSizeRules(layerId);

      const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
        l.clone({
          getPointRadius: defaultSize,
          pointRadiusUnits: 'pixels',
          pointRadiusMinPixels: 1,
          pointRadiusMaxPixels: 200,
          updateTriggers: { getPointRadius: 'reset' },
        })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.instant);

      return {
        success: true,
        message: `Size reset to uniform ${defaultSize}px`,
      };
    }

    // Validate required params
    if (!property || sizeRules.length === 0) {
      return {
        success: false,
        message: 'Property and sizeRules are required. Use reset=true to clear size rules.',
      };
    }

    // Merge new size rules with existing using context
    mapTools.mergeSizeRules(layerId, property, sizeRules, defaultSize);

    // Create size accessor using context
    const sizeAccessor = mapTools.createSizeAccessor(layerId, property);

    // Get all rules for update trigger and message
    const allRules = mapTools.getSizeRulesArray(layerId);

    // Update layer with dynamic size in PIXELS
    const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
      l.clone({
        getPointRadius: sizeAccessor,
        pointRadiusUnits: 'pixels',
        pointRadiusMinPixels: 1,
        pointRadiusMaxPixels: 200,
        updateTriggers: { getPointRadius: JSON.stringify(allRules) },
      })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

    const rulesDescription = allRules
      .map((r) => `${r.value}=${r.size}px`)
      .join(', ');

    return {
      success: true,
      message: `Size rules merged: ${rulesDescription} (default: ${defaultSize}px)`,
    };
  };
}
