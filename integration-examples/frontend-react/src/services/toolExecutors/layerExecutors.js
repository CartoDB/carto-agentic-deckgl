import {
  scheduleRedraws,
  REDRAW_PRESETS,
  updateLayer,
  resolveLayerId,
  layerExists,
} from '../deckUtils';

/**
 * Layer-related tool executors: TOGGLE_LAYER, SET_POINT_COLOR
 */

/**
 * Create TOGGLE_LAYER executor
 * Shows or hides a layer by name
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createToggleLayerExecutor({ deck, mapTools }) {
  return (params) => {
    const { layerName, visible } = params;

    const currentLayers = deck.props.layers || [];
    const layerId = resolveLayerId(layerName);

    // Check if layer exists
    if (!layerExists(currentLayers, layerId)) {
      return {
        success: false,
        message: `Layer "${layerName}" not found`,
      };
    }

    // Update layer visibility
    const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
      layer.clone({ visible })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.instant);

    // Persist visibility state to context
    mapTools.setLayerVisibility(layerId, visible);

    return {
      success: true,
      message: `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}`,
    };
  };
}

/**
 * Create SET_POINT_COLOR executor
 * Changes the fill color of points layer
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.mapTools - MapTools context
 * @returns {Function} Executor function
 */
export function createSetPointColorExecutor({ deck, mapTools }) {
  return (params) => {
    const { r, g, b, a = 200 } = params;
    const rgba = [r, g, b, a];
    const layerId = 'points-layer';

    const currentLayers = deck.props.layers || [];

    // Update layer color
    const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
      layer.clone({ getFillColor: rgba })
    );

    deck.setProps({ layers: updatedLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

    // Persist base color to context
    mapTools.setLayerBaseColor(layerId, rgba);

    return {
      success: true,
      message: `Point color changed to rgb(${r}, ${g}, ${b})`,
    };
  };
}
