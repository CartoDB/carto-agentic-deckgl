/**
 * Slide-aware Tool Executors for sdsc-2025-congestion
 *
 * Uses @deck.gl/json JSONConverter for resolving:
 * - @@# constant references (colors, interpolators)
 * - @@= accessor expressions
 * - @@function custom function calls
 * - @@type class instantiation
 *
 * @see https://deck.gl/docs/api-reference/json/conversion-reference
 */

import {
  resolveInterpolator,
  createLinearInterpolator,
  resolveValue,
  resolveColor,
} from '../config/deckJsonConfig';
import { executeLayerStyleSpec } from './jsonSpecExecutor';

// Local tool names - matches @carto/maps-ai-tools definitions
const TOOL_NAMES = {
  ROTATE_MAP: 'rotate-map',
  SET_PITCH: 'set-pitch',
  ZOOM_MAP: 'zoom-map',
  NAVIGATE_SLIDE: 'navigate-slide',
  GET_SLIDE_INFO: 'get-slide-info',
  SET_FILTER_VALUE: 'set-filter-value',
  RESET_VIEW: 'reset-view',
  RESET_VISUALIZATION: 'reset-visualization',
  TOGGLE_LAYER: 'toggle-layer',
  UPDATE_LAYER_STYLE: 'update-layer-style',
  GET_LAYER_CONFIG: 'get-layer-config',
  FLY_TO: 'fly-to',
  QUERY_FEATURES: 'query-features',
};

/**
 * Find slide index by name or keyword
 */
function findSlideByName(slidesConfig, target) {
  const lowerTarget = target.toLowerCase();

  // First try exact name match
  const exactMatch = slidesConfig.findIndex(
    (s) => s.name?.toLowerCase() === lowerTarget
  );
  if (exactMatch >= 0) return exactMatch;

  // Try partial match in name or title
  const partialMatch = slidesConfig.findIndex(
    (s) =>
      s.name?.toLowerCase().includes(lowerTarget) ||
      s.title?.toLowerCase().includes(lowerTarget)
  );
  if (partialMatch >= 0) return partialMatch;

  // Try keyword mapping
  const keywordMap = {
    cover: 0,
    home: 0,
    start: 0,
    intro: 1,
    introduction: 1,
    first: 1,
    end: slidesConfig.length - 1,
    last: slidesConfig.length - 1,
    final: slidesConfig.length - 1,
  };

  return keywordMap[lowerTarget] ?? -1;
}

/**
 * Create slide-aware tool executors
 */
export function createSlideToolExecutors({ appState, slidesConfig }) {
  return {
    // View Control Tools
    [TOOL_NAMES.ROTATE_MAP]: (params) => {
      const { bearing, relative = false, transitionDuration = 1000, transitionInterpolator } = params;

      if (!appState.viewState) {
        return { success: false, message: 'View state not available' };
      }

      const currentBearing = appState.viewState.bearing || 0;
      const newBearing = relative ? currentBearing + bearing : bearing;
      const normalizedBearing = ((newBearing + 180) % 360) - 180;

      // Use provided interpolator or default to LinearInterpolator for bearing
      const interpolator = transitionInterpolator
        ? resolveInterpolator(transitionInterpolator)
        : createLinearInterpolator(['bearing']);

      if (appState.updateViewState) {
        appState.updateViewState({
          ...appState.viewState,
          bearing: normalizedBearing,
          transitionDuration,
          transitionInterpolator: interpolator,
        });
      }

      return {
        success: true,
        message: `Rotated map to ${normalizedBearing.toFixed(1)}°`,
      };
    },

    [TOOL_NAMES.SET_PITCH]: (params) => {
      const { pitch, transitionDuration = 1000, transitionInterpolator } = params;

      if (!appState.viewState) {
        return { success: false, message: 'View state not available' };
      }

      // Use provided interpolator or default to LinearInterpolator for pitch
      const interpolator = transitionInterpolator
        ? resolveInterpolator(transitionInterpolator)
        : createLinearInterpolator(['pitch']);

      if (appState.updateViewState) {
        appState.updateViewState({
          ...appState.viewState,
          pitch,
          transitionDuration,
          transitionInterpolator: interpolator,
        });
      }

      return {
        success: true,
        message: `Set map tilt to ${pitch}°`,
      };
    },

    [TOOL_NAMES.ZOOM_MAP]: (params) => {
      const { direction, levels = 1, transitionDuration = 1000 } = params;

      if (!appState.viewState) {
        return { success: false, message: 'View state not available' };
      }

      const currentZoom = appState.viewState.zoom || 12;
      const zoomChange = direction === 'in' ? levels : -levels;
      const newZoom = Math.max(0, Math.min(22, currentZoom + zoomChange));

      if (appState.updateViewState) {
        appState.updateViewState({
          ...appState.viewState,
          zoom: newZoom,
          transitionDuration,
        });
      }

      return {
        success: true,
        message: `Zoomed ${direction} ${levels} level(s) to zoom ${newZoom.toFixed(1)}`,
      };
    },

    [TOOL_NAMES.RESET_VIEW]: (params) => {
      const { toSlideDefault = true, transitionDuration = 1500, transitionInterpolator } = params;

      // Use provided interpolator or default to FlyToInterpolator for reset
      const interpolator = transitionInterpolator
        ? resolveInterpolator(transitionInterpolator)
        : resolveInterpolator('FlyToInterpolator');

      if (toSlideDefault) {
        const currentSlide = appState.currentSlide ?? 0;
        const slideConfig = slidesConfig[currentSlide];

        if (slideConfig?.view) {
          if (appState.updateViewState) {
            appState.updateViewState({
              ...slideConfig.view,
              transitionDuration,
              transitionInterpolator: interpolator,
            });
          }
          return {
            success: true,
            message: `Reset to slide ${currentSlide} default view`,
          };
        }
      }

      const firstSlide = slidesConfig[0];
      if (firstSlide?.view && appState.updateViewState) {
        appState.updateViewState({
          ...firstSlide.view,
          transitionDuration,
          transitionInterpolator: interpolator,
        });
      }

      return {
        success: true,
        message: 'Reset to initial view',
      };
    },

    // Reset Visualization Tool - resets layers and optionally view state
    [TOOL_NAMES.RESET_VISUALIZATION]: (params) => {
      const { resetLayers = true, resetViewState = false, targetSlide } = params;
      const messages = [];

      // Reset layer styles to original
      if (resetLayers && appState.resetLayerStyles) {
        appState.resetLayerStyles();
        messages.push('Layer styles reset to original');
      }

      // Reset view state if requested
      if (resetViewState) {
        const slideIndex = targetSlide ?? appState.currentSlide ?? 0;
        const slideConfig = slidesConfig[slideIndex];

        if (slideConfig?.view && appState.updateViewState) {
          const interpolator = resolveInterpolator('FlyToInterpolator');
          appState.updateViewState({
            ...slideConfig.view,
            transitionDuration: 1500,
            transitionInterpolator: interpolator,
          });
          messages.push(`View reset to slide ${slideIndex} defaults`);
        }
      }

      // Navigate to target slide if specified
      if (targetSlide !== undefined && appState.goToSlide) {
        appState.goToSlide(targetSlide);
        messages.push(`Navigated to slide ${targetSlide}`);
      }

      if (messages.length === 0) {
        return {
          success: false,
          message: 'No reset actions performed. Make sure resetLayerStyles is available in appState.',
        };
      }

      return {
        success: true,
        message: messages.join('. '),
      };
    },

    /**
     * Toggle Layer Visibility Tool - uses JSONConverter pattern
     * Simple show/hide for layers without changing other styles
     *
     * @example
     * { layerId: 'subway', visible: false }  // Hide subway
     * { layerId: 'traffic-before', visible: true }  // Show traffic
     */
    [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
      const { layerId, visible } = params;

      if (!appState.updateLayerStyle) {
        return { success: false, message: 'Layer style update not available' };
      }

      if (!layerId) {
        return { success: false, message: 'No layer ID specified' };
      }

      // Use the same updateLayerStyle mechanism but only for visibility
      // This follows the JSONConverter pattern - resolveValue handles any @@ refs
      const resolvedVisible = resolveValue(visible);

      appState.updateLayerStyle(layerId, { visible: resolvedVisible });

      const action = resolvedVisible ? 'shown' : 'hidden';
      return {
        success: true,
        message: `Layer "${layerId}" ${action}`,
      };
    },

    // Slide Navigation Tools
    [TOOL_NAMES.NAVIGATE_SLIDE]: (params) => {
      const { target, direction } = params;

      if (direction) {
        switch (direction) {
          case 'next':
            if (appState.next) {
              appState.next();
              return { success: true, message: 'Navigated to next slide' };
            }
            break;
          case 'previous':
            if (appState.prev) {
              appState.prev();
              return { success: true, message: 'Navigated to previous slide' };
            }
            break;
          case 'first':
            if (appState.reset) {
              appState.reset();
              return { success: true, message: 'Navigated to first slide' };
            }
            break;
          case 'last':
            if (appState.goToSlide) {
              appState.goToSlide(slidesConfig.length - 1);
              return { success: true, message: 'Navigated to last slide' };
            }
            break;
        }
      }

      if (typeof target === 'number') {
        if (target < 0 || target >= slidesConfig.length) {
          return {
            success: false,
            message: `Invalid slide number. Must be 0-${slidesConfig.length - 1}`,
          };
        }
        if (appState.goToSlide) {
          appState.goToSlide(target);
          return { success: true, message: `Navigated to slide ${target}` };
        }
      }

      if (typeof target === 'string') {
        const slideIndex = findSlideByName(slidesConfig, target);
        if (slideIndex >= 0 && appState.goToSlide) {
          appState.goToSlide(slideIndex);
          return {
            success: true,
            message: `Navigated to "${target}" (slide ${slideIndex})`,
          };
        }
        return { success: false, message: `Slide "${target}" not found` };
      }

      return { success: false, message: 'No navigation target specified' };
    },

    [TOOL_NAMES.GET_SLIDE_INFO]: (params) => {
      const { includeAllSlides = false } = params;
      const currentSlide = appState.currentSlide ?? 0;
      const currentConfig = slidesConfig[currentSlide];

      const currentSlideInfo = {
        index: currentSlide,
        name: currentConfig?.name,
        layers: currentConfig?.layers,
        hasFilter: Boolean(currentConfig?.slider),
        filterConfig: currentConfig?.legend
          ? {
              min: currentConfig.legend.values?.[0],
              max: currentConfig.legend.values?.[currentConfig.legend.values?.length - 1],
              unit: currentConfig.legend.title,
            }
          : null,
        currentFilterValue: appState.filterValue,
      };

      if (includeAllSlides) {
        return {
          success: true,
          message: `Slide ${currentSlide + 1} of ${slidesConfig.length}`,
          data: {
            current: currentSlideInfo,
            all: slidesConfig.map((s, i) => ({
              index: i,
              name: s.name,
              hasFilter: Boolean(s.slider),
            })),
          },
        };
      }

      return {
        success: true,
        message: `Current slide: ${currentSlide + 1} of ${slidesConfig.length}`,
        data: currentSlideInfo,
      };
    },

    [TOOL_NAMES.SET_FILTER_VALUE]: (params) => {
      const { value, normalized = true } = params;
      const currentSlide = appState.currentSlide ?? 0;
      const slideConfig = slidesConfig[currentSlide];

      if (!slideConfig?.slider) {
        return {
          success: false,
          message: 'Current slide does not have a filter control',
        };
      }

      if (!appState.setFilterValue) {
        return { success: false, message: 'Filter control not available' };
      }

      let actualValue = value;
      if (normalized && slideConfig.legend?.values) {
        const values = slideConfig.legend.values;
        const min = values[0];
        const max = values[values.length - 1];
        actualValue = min + value * (max - min);
      }

      appState.setFilterValue(actualValue);

      const unit = slideConfig.legend?.title || '';
      return {
        success: true,
        message: `Filter set to ${actualValue.toFixed(2)} ${unit}`,
      };
    },

    /**
     * Layer Style Tool - uses JSONConverter for full @@ reference resolution
     *
     * Supports:
     * - Color names: "Red", "Blue", "Green"
     * - @@# references: "@@#Red", "@@#Warning"
     * - @@function: { "@@function": "colorWithAlpha", color: "Red", alpha: 128 }
     * - RGBA arrays: [255, 0, 0, 200]
     *
     * @example
     * // Simple color update
     * { layerId: 'congestion-zone', fillColor: 'Red' }
     *
     * @example
     * // Using @@function for custom alpha
     * { layerId: 'traffic', lineColor: { '@@function': 'colorWithAlpha', color: 'Blue', alpha: 180 } }
     */
    [TOOL_NAMES.UPDATE_LAYER_STYLE]: (params) => {
      if (!appState.updateLayerStyle) {
        return { success: false, message: 'Layer style update not available' };
      }

      // Execute spec through JSONConverter - resolves all @@ references
      const { layerId, props } = executeLayerStyleSpec(params);

      if (!layerId) {
        return { success: false, message: 'No layer ID specified' };
      }

      if (Object.keys(props).length === 0) {
        return { success: false, message: 'No style properties specified' };
      }

      // Apply the JSONConverter-resolved props to the layer
      appState.updateLayerStyle(layerId, props);

      const updates = Object.keys(props).join(', ');
      return {
        success: true,
        message: `Updated "${layerId}" styling: ${updates}`,
      };
    },

    // Get Layer Config Tool - returns current layer properties
    [TOOL_NAMES.GET_LAYER_CONFIG]: (params) => {
      const { layerId } = params;

      if (!appState.layers) {
        return { success: false, message: 'Layers not available' };
      }

      // Find the layer by ID
      const layer = appState.layers.find((l) => l && l.id === layerId);

      if (!layer) {
        return {
          success: false,
          message: `Layer "${layerId}" not found. Available layers: ${appState.layers
            .filter(Boolean)
            .map((l) => l.id)
            .join(', ')}`,
        };
      }

      // Extract relevant properties from the layer
      const config = {
        id: layer.id,
        visible: layer.props.visible,
        opacity: layer.props.opacity,
        // Color properties (different layers use different names)
        getColor: layer.props.getColor,
        getFillColor: layer.props.getFillColor,
        getLineColor: layer.props.getLineColor,
        // Width properties
        lineWidthMinPixels: layer.props.lineWidthMinPixels,
        widthMinPixels: layer.props.widthMinPixels,
        // Other common properties
        pickable: layer.props.pickable,
        stroked: layer.props.stroked,
        filled: layer.props.filled,
      };

      // Remove undefined values for cleaner output
      const cleanConfig = Object.fromEntries(
        Object.entries(config).filter(([, v]) => v !== undefined)
      );

      return {
        success: true,
        message: `Layer "${layerId}" configuration`,
        data: cleanConfig,
      };
    },

    // Fly To Tool - navigate to coordinates
    [TOOL_NAMES.FLY_TO]: (params) => {
      const { lat, lng, zoom = 12, pitch = 0, bearing = 0, transitionDuration = 1500 } = params;

      if (!appState.updateViewState) {
        return { success: false, message: 'View state update not available' };
      }

      // Use FlyToInterpolator for smooth animation
      const interpolator = resolveInterpolator('FlyToInterpolator');

      appState.updateViewState({
        longitude: lng,
        latitude: lat,
        zoom,
        pitch,
        bearing,
        transitionDuration,
        transitionInterpolator: interpolator,
      });

      return {
        success: true,
        message: `Flying to coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) at zoom ${zoom}`,
      };
    },

    // Query Features Tool - count/query features on a layer
    [TOOL_NAMES.QUERY_FEATURES]: (params) => {
      const { layerId, property, operator = 'equals', value, includeNames = false } = params;

      if (!appState.layers) {
        return { success: false, message: 'Layers not available' };
      }

      // Find the layer
      const layer = appState.layers.find((l) => l && l.id === layerId);
      if (!layer) {
        return {
          success: false,
          message: `Layer "${layerId}" not found. Available layers: ${appState.layers
            .filter(Boolean)
            .map((l) => l.id)
            .join(', ')}`,
        };
      }

      // Get features from layer data
      const data = layer.props?.data;
      if (!data) {
        return {
          success: false,
          message: `Layer "${layerId}" has no data to query`,
        };
      }

      // Handle different data formats (array, GeoJSON FeatureCollection)
      let features = [];
      if (Array.isArray(data)) {
        features = data;
      } else if (data.features && Array.isArray(data.features)) {
        features = data.features;
      }

      // Filter features based on operator
      const matchingFeatures = features.filter((f) => {
        const props = f.properties || f;
        const propValue = props[property];

        if (operator === 'all') return true;
        if (propValue === undefined) return false;

        const strValue = String(propValue);
        switch (operator) {
          case 'equals':
            return strValue === value;
          case 'startsWith':
            return strValue.startsWith(value);
          case 'contains':
            return strValue.includes(value);
          case 'regex':
            try {
              return new RegExp(value).test(strValue);
            } catch {
              return false;
            }
          default:
            return false;
        }
      });

      const result = {
        total: features.length,
        matching: matchingFeatures.length,
        query: operator === 'all' ? 'all features' : `${property} ${operator} "${value}"`,
      };

      if (includeNames && matchingFeatures.length > 0) {
        result.sampleNames = matchingFeatures
          .slice(0, 5)
          .map((f) => (f.properties || f).name || (f.properties || f).id || 'unnamed');
      }

      return {
        success: true,
        message: `Found ${matchingFeatures.length} of ${features.length} features matching "${result.query}"`,
        data: result,
      };
    },
  };
}

/**
 * Create a viewState update spec with JSONConverter support.
 * Resolves @@# interpolator references to actual interpolator instances.
 *
 * @param {Object} viewStateSpec - ViewState spec that may contain @@ references
 * @returns {Object} Resolved viewState ready for updateViewState
 *
 * @example
 * // Using @@# interpolator reference
 * const viewState = createViewStateSpec({
 *   longitude: -73.98,
 *   latitude: 40.75,
 *   zoom: 14,
 *   transitionDuration: 2000,
 *   transitionInterpolator: '@@#FlyToInterpolator'
 * });
 *
 * @example
 * // Using @@type for custom interpolator config
 * const viewState = createViewStateSpec({
 *   bearing: 90,
 *   transitionDuration: 1000,
 *   transitionInterpolator: { '@@type': 'LinearInterpolator', transitionProps: ['bearing'] }
 * });
 */
export function createViewStateSpec(viewStateSpec) {
  const resolved = { ...viewStateSpec };

  // Resolve transitionInterpolator if it's a string or @@type object
  if (resolved.transitionInterpolator) {
    resolved.transitionInterpolator = resolveInterpolator(resolved.transitionInterpolator);
  }

  // Resolve any other @@ references in the spec
  return resolveValue(resolved);
}

export { TOOL_NAMES };

// Re-export JSONConverter utilities for external use
export { resolveInterpolator, createLinearInterpolator, resolveValue, resolveColor };
