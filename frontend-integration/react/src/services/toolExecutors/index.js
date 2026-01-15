import {
  TOOL_NAMES,
  generateFlyToSpec,
  generateZoomSpec,
  generateViewStateSpec,
  generateToggleLayerSpec,
  generateSetPointColorSpec,
  generateAddLayerSpec,
  generateAddRasterLayerSpec,
  generateRemoveLayerSpec,
  generateUpdateLayerPropsSpec,
} from '@carto/maps-ai-tools';
import { createJsonSpecExecutor } from '../jsonSpecExecutor';
import {
  scheduleRedraws,
  REDRAW_PRESETS,
  updateLayer,
  resolveLayerId,
  layerExists,
  findLayerById,
  getLayerData,
  createPropertyMatcher,
  countMatchingFeatures,
} from '../deckUtils';
import {
  resolveInterpolator,
  createLinearInterpolator,
  resolveValue,
  resolveColor,
} from '../../config/deckJsonConfig';
import { colorBins } from '@deck.gl/carto';


/**
 * Create all tool executors
 *
 * This implementation uses @deck.gl/json specs for spec-returning tools
 * and direct manipulation for data-returning tools (queries).
 *
 * @param {Object} context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.map - MapLibre GL instance
 * @param {Object} context.mapTools - MapTools context for state persistence
 * @returns {Object} Map of tool name to executor function
 */
export function createExecutors({ deck, map, mapTools }) {
  // Create the JSON spec executor for spec-based tools
  const specExecutor = createJsonSpecExecutor({ deck, map, mapTools });

  const executors = {
    // =========================================
    // View Executors (spec-based)
    // =========================================

    [TOOL_NAMES.FLY_TO]: (params) => {
      const { lat, lng, zoom = 12, pitch = 0, bearing = 0, transitionDuration = 1000 } = params;

      const spec = generateFlyToSpec({
        lat,
        lng,
        zoom,
        pitch,
        bearing,
        transitionDuration,
      });

      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? `Flying to ${lat.toFixed(2)}, ${lng.toFixed(2)} at zoom ${zoom}`
          : result.message,
      };
    },

    [TOOL_NAMES.ZOOM_MAP]: (params) => {
      const { direction, levels = 1 } = params;
      const currentView = deck.props.initialViewState || { zoom: 10 };
      const currentZoom = currentView.zoom || 10;

      const spec = generateZoomSpec({
        direction,
        levels,
        currentZoom,
      });

      const result = specExecutor.applySpec(spec);
      const newZoom = spec.initialViewState?.zoom ?? currentZoom;

      return {
        success: result.success,
        message: result.success
          ? `Zoomed ${direction} to level ${newZoom.toFixed(1)}`
          : result.message,
      };
    },

    [TOOL_NAMES.SET_VIEW_STATE]: (params) => {
      const spec = generateViewStateSpec(params);
      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? 'View state updated'
          : result.message,
      };
    },

    'rotate-map': (params) => {
      const { bearing, relative = false, transitionDuration = 1000, transitionInterpolator } = params;

      const currentView = deck.props.initialViewState || deck.viewState || {};
      const currentBearing = currentView.bearing || 0;
      const newBearing = relative ? currentBearing + bearing : bearing;
      const normalizedBearing = ((newBearing + 180) % 360) - 180;

      // Use provided interpolator or default to LinearInterpolator for bearing
      const interpolator = transitionInterpolator
        ? resolveInterpolator(transitionInterpolator)
        : createLinearInterpolator(['bearing']);

      const newViewState = {
        ...currentView,
        bearing: normalizedBearing,
        transitionDuration,
        transitionInterpolator: interpolator,
      };

      deck.setProps({ initialViewState: newViewState });

      // Sync with MapLibre if available
      if (map) {
        map.jumpTo({
          center: [newViewState.longitude, newViewState.latitude],
          zoom: newViewState.zoom,
          bearing: normalizedBearing,
          pitch: newViewState.pitch,
        });
      }

      scheduleRedraws(deck, REDRAW_PRESETS.flyTo);

      return {
        success: true,
        message: `Rotated map to ${normalizedBearing.toFixed(1)}°`,
      };
    },

    'set-pitch': (params) => {
      const { pitch, transitionDuration = 1000, transitionInterpolator } = params;

      const currentView = deck.props.initialViewState || deck.viewState || {};

      // Use provided interpolator or default to LinearInterpolator for pitch
      const interpolator = transitionInterpolator
        ? resolveInterpolator(transitionInterpolator)
        : createLinearInterpolator(['pitch']);

      const newViewState = {
        ...currentView,
        pitch,
        transitionDuration,
        transitionInterpolator: interpolator,
      };

      deck.setProps({ initialViewState: newViewState });

      // Sync with MapLibre if available
      if (map) {
        map.jumpTo({
          center: [newViewState.longitude, newViewState.latitude],
          zoom: newViewState.zoom,
          bearing: newViewState.bearing,
          pitch,
        });
      }

      scheduleRedraws(deck, REDRAW_PRESETS.flyTo);

      return {
        success: true,
        message: `Set map tilt to ${pitch}°`,
      };
    },

    // =========================================
    // Layer Visibility & Styling (spec-based)
    // =========================================

    [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
      const { layerName, visible } = params;
      const currentLayers = deck.props.layers || [];
      const layerId = resolveLayerId(layerName);

      if (!layerExists(currentLayers, layerId)) {
        return { success: false, message: `Layer "${layerName}" not found` };
      }

      const spec = generateToggleLayerSpec({ layerId, visible });
      const result = specExecutor.applySpec(spec);

      if (result.success) {
        mapTools.setLayerVisibility(layerId, visible);
      }

      return {
        success: result.success,
        message: result.success
          ? `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}`
          : result.message,
      };
    },

    [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
      const { layerId = 'points-layer', r, g, b, a = 200 } = params;

      const spec = generateSetPointColorSpec({ layerId, r, g, b, a });
      const result = specExecutor.applySpec(spec);

      if (result.success) {
        mapTools.setLayerBaseColor(layerId, [r, g, b, a]);
      }

      return {
        success: result.success,
        message: result.success
          ? `Point color changed to rgb(${r}, ${g}, ${b})`
          : result.message,
      };
    },

    /**
     * Update Layer Style Tool - uses JSONConverter for @@ reference resolution
     *
     * Supports:
     * - Color names or RGBA arrays
     * - @@# references: "@@#Red", "@@#Warning"
     * - Numeric properties: opacity, lineWidth, pointRadius
     * - colorScheme: CARTO palette names for data-driven layers (Teal, Purp, BluYl, etc.)
     *
     * @example
     * { layerId: 'my-layer', fillColor: [255, 0, 0, 200], opacity: 0.8 }
     * { layerId: 'quadbin-layer', colorScheme: 'Teal' }
     */
    'update-layer-style': (params) => {
      const { layerId, colorScheme, ...styleProps } = params;

      if (!layerId) {
        return { success: false, message: 'No layer ID specified' };
      }

      const currentLayers = deck.props.layers || [];
      const layer = findLayerById(currentLayers, layerId);

      if (!layer) {
        return { success: false, message: `Layer "${layerId}" not found` };
      }

      // Resolve any @@ references in the style props
      const resolvedProps = {};

      // Handle colorScheme for CARTO data-driven layers (QuadbinTileLayer, H3TileLayer, etc.)
      if (colorScheme) {
        // Default domain for population-style data
        const defaultDomain = [0, 100, 1000, 10000, 100000, 1000000];

        // Check if existing getFillColor has colorBins-like structure
        // colorBins returns an accessor function, so we need to create a new one
        resolvedProps.getFillColor = colorBins({
          attr: 'value',
          domain: defaultDomain,
          colors: colorScheme,
        });

        // Track for updateTriggers
        resolvedProps._colorScheme = colorScheme;
      }

      // Process other style properties
      for (const [key, value] of Object.entries(styleProps)) {
        if (key === 'fillColor' || key === 'getFillColor') {
          // Only set if colorScheme wasn't specified
          if (!colorScheme) {
            resolvedProps.getFillColor = resolveColor(value);
          }
        } else if (key === 'lineColor' || key === 'getLineColor') {
          resolvedProps.getLineColor = resolveColor(value);
        } else if (key === 'pointColor' || key === 'getColor') {
          resolvedProps.getColor = resolveColor(value);
        } else {
          resolvedProps[key] = resolveValue(value);
        }
      }

      // Remove internal tracking property before applying
      const colorSchemeValue = resolvedProps._colorScheme;
      delete resolvedProps._colorScheme;

      if (Object.keys(resolvedProps).length === 0) {
        return { success: false, message: 'No style properties specified' };
      }

      // Add updateTriggers for any color properties
      const updateTriggers = {};
      if (resolvedProps.getFillColor) {
        updateTriggers.getFillColor = colorSchemeValue || JSON.stringify(resolvedProps.getFillColor);
      }
      if (resolvedProps.getLineColor) updateTriggers.getLineColor = JSON.stringify(resolvedProps.getLineColor);
      if (resolvedProps.getColor) updateTriggers.getColor = JSON.stringify(resolvedProps.getColor);

      const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
        l.clone({
          ...resolvedProps,
          updateTriggers: Object.keys(updateTriggers).length > 0 ? updateTriggers : undefined,
        })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);

      const updates = colorSchemeValue
        ? `colorScheme: ${colorSchemeValue}`
        : Object.keys(resolvedProps).join(', ');
      return {
        success: true,
        message: `Updated "${layerId}" styling: ${updates}`,
      };
    },

    // =========================================
    // Layer Management (spec-based)
    // =========================================

    [TOOL_NAMES.ADD_LAYER]: (params) => {
      const spec = generateAddLayerSpec(params);
      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? `Layer "${params.id}" added`
          : result.message,
      };
    },

    [TOOL_NAMES.ADD_RASTER_LAYER]: (params) => {
      const spec = generateAddRasterLayerSpec(params);
      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? `Raster layer "${params.id}" added from ${params.tableName}`
          : result.message,
      };
    },

    [TOOL_NAMES.REMOVE_LAYER]: (params) => {
      const spec = generateRemoveLayerSpec(params);
      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? `Layer "${params.layerId}" removed`
          : result.message,
      };
    },

    [TOOL_NAMES.UPDATE_LAYER_PROPS]: (params) => {
      const spec = generateUpdateLayerPropsSpec(params);
      const result = specExecutor.applySpec(spec);

      return {
        success: result.success,
        message: result.success
          ? `Layer "${params.layerId}" updated`
          : result.message,
      };
    },

    // =========================================
    // Query & Data Tools (direct implementation)
    // =========================================

    [TOOL_NAMES.QUERY_FEATURES]: (params) => {
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

      const matcher = createPropertyMatcher(property, operator, value);
      const { count, total, matchingFeatures } = countMatchingFeatures(data, matcher);

      let message =
        operator === 'all'
          ? `Total features: ${count}`
          : `Found ${count} features where ${property} ${operator} "${value}" (out of ${total} total)`;

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
    },

    [TOOL_NAMES.AGGREGATE_FEATURES]: (params) => {
      const { layerId = 'points-layer', groupBy } = params;

      const currentLayers = deck.props.layers || [];
      const layer = findLayerById(currentLayers, layerId);

      if (!layer) {
        return { success: false, message: `Layer "${layerId}" not found` };
      }

      const data = mapTools.getOriginalData(layerId) || getLayerData(layer);

      if (!data || !data.features) {
        return { success: false, message: 'No feature data available' };
      }

      if (!groupBy) {
        return { success: false, message: 'groupBy property is required' };
      }

      const counts = new Map();
      data.features.forEach((feature) => {
        const value = String(feature.properties[groupBy] || 'unknown');
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      const results = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      const tableRows = results.map((r) => `${r.value}: ${r.count}`).join('\n');
      const total = data.features.length;

      return {
        success: true,
        message: `Aggregation by "${groupBy}" (${total} total features):\n${tableRows}`,
        data: { groupBy, total, groups: results },
      };
    },

    [TOOL_NAMES.GET_LAYER_CONFIG]: (params) => {
      const { layerId } = params;
      const currentLayers = deck.props.layers || [];
      const layer = findLayerById(currentLayers, layerId);

      if (!layer) {
        return { success: false, message: `Layer "${layerId}" not found` };
      }

      const config = {
        layerId: layer.id,
        layerType: layer.constructor.name,
        visible: layer.props.visible !== false,
        opacity: layer.props.opacity ?? 1,
        props: {
          pickable: layer.props.pickable,
          autoHighlight: layer.props.autoHighlight,
        },
      };

      return {
        success: true,
        message: `Layer "${layerId}" configuration retrieved`,
        data: config,
      };
    },
  };

  return executors;
}
