import { REDRAW_DELAYS } from '../../config/constants';

/**
 * Schedule deck.gl redraws with configurable timing
 * Centralizes the repeated redraw pattern used throughout the app
 *
 * @param {Object} deck - deck.gl instance
 * @param {Object} options - Redraw options
 * @param {boolean} options.immediate - Whether to trigger immediate redraw via requestAnimationFrame
 * @param {number[]} options.delays - Array of delays (ms) for scheduled redraws
 * @param {number} options.transitionDelay - Additional delay for transition completion
 */
export function scheduleRedraws(deck, options = {}) {
  const {
    immediate = true,
    delays = [REDRAW_DELAYS.short],
    transitionDelay = null,
  } = options;

  if (!deck) return;

  // Immediate redraw using requestAnimationFrame
  if (immediate) {
    requestAnimationFrame(() => deck.redraw(true));
  }

  // Scheduled redraws at specified delays
  delays.forEach((delay) => {
    setTimeout(() => deck.redraw(true), delay);
  });

  // Additional redraw after transition completes
  if (transitionDelay !== null) {
    setTimeout(() => deck.redraw(true), transitionDelay);
  }
}

/**
 * Preset redraw configurations for common operations
 */
export const REDRAW_PRESETS = {
  // For instant layer updates (toggle, color change)
  instant: { immediate: true, delays: [] },

  // For short transitions (zoom)
  short: { immediate: true, delays: [REDRAW_DELAYS.short], transitionDelay: REDRAW_DELAYS.transition },

  // For longer transitions (fly to)
  flyTo: { immediate: true, delays: [REDRAW_DELAYS.short], transitionDelay: REDRAW_DELAYS.flyTo },

  // For data updates (filter, size)
  dataUpdate: { immediate: true, delays: [REDRAW_DELAYS.short] },
};
