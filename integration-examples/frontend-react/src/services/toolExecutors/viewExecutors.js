import { ZOOM_LIMITS, TRANSITION_DURATIONS } from '../../config/constants';
import { scheduleRedraws, REDRAW_PRESETS, syncMapLibreView } from '../deckUtils';

/**
 * View-related tool executors: FLY_TO, ZOOM_MAP
 */

/**
 * Create FLY_TO executor
 * Flies the map to a specific location
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.map - MapLibre GL instance
 * @returns {Function} Executor function
 */
export function createFlyToExecutor({ deck, map }) {
  return (params) => {
    const { lat, lng, zoom = 12 } = params;

    const currentView = deck.props.initialViewState || {};

    // Update deck.gl view state with transition
    deck.setProps({
      initialViewState: {
        ...currentView,
        longitude: lng,
        latitude: lat,
        zoom,
        transitionDuration: TRANSITION_DURATIONS.flyTo,
        transitionInterruption: 1,
      },
    });

    // Sync MapLibre with animation
    syncMapLibreView(map, { longitude: lng, latitude: lat, zoom }, {
      animate: true,
      duration: TRANSITION_DURATIONS.flyTo,
    });

    // Schedule redraws for transition
    scheduleRedraws(deck, REDRAW_PRESETS.flyTo);

    return {
      success: true,
      message: `Flying to ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    };
  };
}

/**
 * Create ZOOM_MAP executor
 * Zooms the map in or out by specified levels
 *
 * @param {Object} context - Execution context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.map - MapLibre GL instance
 * @returns {Function} Executor function
 */
export function createZoomMapExecutor({ deck, map }) {
  return (params) => {
    const { direction, levels = 1 } = params;

    const currentView = deck.props.initialViewState || { zoom: 10 };
    const currentZoom = currentView.zoom || 10;

    // Calculate new zoom level with bounds
    const newZoom = direction === 'in'
      ? Math.min(ZOOM_LIMITS.max, currentZoom + levels)
      : Math.max(ZOOM_LIMITS.min, currentZoom - levels);

    // Update deck.gl view state
    deck.setProps({
      initialViewState: {
        ...currentView,
        zoom: newZoom,
        transitionDuration: TRANSITION_DURATIONS.zoom,
        transitionInterruption: 1,
      },
    });

    // Sync MapLibre without animation (jump)
    syncMapLibreView(map, {
      longitude: currentView.longitude,
      latitude: currentView.latitude,
      zoom: newZoom,
      bearing: currentView.bearing,
      pitch: currentView.pitch,
    });

    // Schedule redraws for transition
    scheduleRedraws(deck, REDRAW_PRESETS.short);

    return {
      success: true,
      message: `Zoomed ${direction} to level ${newZoom.toFixed(1)}`,
    };
  };
}
