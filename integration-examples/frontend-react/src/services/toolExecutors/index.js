import { TOOL_NAMES } from '@carto/maps-ai-tools';
import {
  scheduleRedraws,
  REDRAW_PRESETS,
  syncMapLibreView,
  updateLayer,
  resolveLayerId,
  layerExists,
  findLayerById,
  getLayerData,
  createPropertyMatcher,
  countMatchingFeatures,
  filterFeatures,
} from '../deckUtils';
import {
  ZOOM_LIMITS,
  TRANSITION_DURATIONS,
  DEFAULT_LAYER_COLOR,
  DEFAULT_POINT_SIZE,
} from '../../config/constants';

/**
 * Create all tool executors
 *
 * Each executor is a function that takes params and returns { success, message, data? }
 *
 * @param {Object} context
 * @param {Object} context.deck - deck.gl instance
 * @param {Object} context.map - MapLibre GL instance
 * @param {Object} context.mapTools - MapTools context for state persistence
 * @returns {Object} Map of tool name to executor function
 *
 * @example
 * const executors = createExecutors({ deck, map, mapTools });
 * const result = executors['fly-to']({ lat: 40.7, lng: -74.0, zoom: 12 });
 */
export function createExecutors({ deck, map, mapTools }) {
  return {
    // =========================================
    // View Executors
    // =========================================

    [TOOL_NAMES.FLY_TO]: (params) => {
      const { lat, lng, zoom = 12 } = params;
      const currentView = deck.props.initialViewState || {};

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

      syncMapLibreView(
        map,
        { longitude: lng, latitude: lat, zoom },
        { animate: true, duration: TRANSITION_DURATIONS.flyTo }
      );

      scheduleRedraws(deck, REDRAW_PRESETS.flyTo);

      return {
        success: true,
        message: `Flying to ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
      };
    },

    [TOOL_NAMES.ZOOM_MAP]: (params) => {
      const { direction, levels = 1 } = params;
      const currentView = deck.props.initialViewState || { zoom: 10 };
      const currentZoom = currentView.zoom || 10;

      const newZoom =
        direction === 'in'
          ? Math.min(ZOOM_LIMITS.max, currentZoom + levels)
          : Math.max(ZOOM_LIMITS.min, currentZoom - levels);

      deck.setProps({
        initialViewState: {
          ...currentView,
          zoom: newZoom,
          transitionDuration: TRANSITION_DURATIONS.zoom,
          transitionInterruption: 1,
        },
      });

      syncMapLibreView(map, {
        longitude: currentView.longitude,
        latitude: currentView.latitude,
        zoom: newZoom,
        bearing: currentView.bearing,
        pitch: currentView.pitch,
      });

      scheduleRedraws(deck, REDRAW_PRESETS.short);

      return {
        success: true,
        message: `Zoomed ${direction} to level ${newZoom.toFixed(1)}`,
      };
    },

    // =========================================
    // Layer Executors
    // =========================================

    [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
      const { layerName, visible } = params;
      const currentLayers = deck.props.layers || [];
      const layerId = resolveLayerId(layerName);

      if (!layerExists(currentLayers, layerId)) {
        return { success: false, message: `Layer "${layerName}" not found` };
      }

      const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
        layer.clone({ visible })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.instant);
      mapTools.setLayerVisibility(layerId, visible);

      return {
        success: true,
        message: `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}`,
      };
    },

    [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
      const { r, g, b, a = 200 } = params;
      const rgba = [r, g, b, a];
      const layerId = 'points-layer';
      const currentLayers = deck.props.layers || [];

      const updatedLayers = updateLayer(currentLayers, layerId, (layer) =>
        layer.clone({ getFillColor: rgba })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);
      mapTools.setLayerBaseColor(layerId, rgba);

      return {
        success: true,
        message: `Point color changed to rgb(${r}, ${g}, ${b})`,
      };
    },

    // =========================================
    // Query & Filter Executors
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

    [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params) => {
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

      const originalData = mapTools.getOrSetOriginalData(layerId, getLayerData(layer));

      if (!originalData || !originalData.features) {
        return { success: false, message: 'No feature data available' };
      }

      if (reset) {
        const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
          l.clone({ data: originalData, updateTriggers: { data: 'reset' } })
        );
        deck.setProps({ layers: updatedLayers });
        scheduleRedraws(deck, REDRAW_PRESETS.instant);
        mapTools.clearActiveFilter(layerId);

        return {
          success: true,
          message: `Filter cleared - showing all ${originalData.features.length} features`,
        };
      }

      if (!property) {
        return {
          success: false,
          message: 'Property is required for filtering. Use reset=true to clear filters.',
        };
      }

      const matcher = createPropertyMatcher(property, operator, value);
      const filteredData = filterFeatures(originalData, matcher);

      const updatedLayers = updateLayer(currentLayers, layerId, (l) =>
        l.clone({
          data: filteredData,
          updateTriggers: { data: `${property}:${operator}:${value}` },
        })
      );

      deck.setProps({ layers: updatedLayers });
      scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);
      mapTools.setActiveFilter(layerId, { property, operator, value });

      return {
        success: true,
        message: `Filtered to ${filteredData.features.length} features where ${property} ${operator} "${value}"`,
      };
    },

    [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
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

      const filterKey = `${property}:${operator}:${value}`;
      const newFilter = {
        key: filterKey,
        property,
        operator,
        value,
        color: filterColor,
      };

      const filters = mapTools.addColorFilter(layerId, newFilter);
      const colorAccessor = mapTools.createColorAccessor(layerId, DEFAULT_LAYER_COLOR);

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
    },

    // =========================================
    // Size Executor
    // =========================================

    [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params) => {
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

        return { success: true, message: `Size reset to uniform ${defaultSize}px` };
      }

      if (!property || sizeRules.length === 0) {
        return {
          success: false,
          message: 'Property and sizeRules are required. Use reset=true to clear size rules.',
        };
      }

      mapTools.mergeSizeRules(layerId, property, sizeRules, defaultSize);
      const sizeAccessor = mapTools.createSizeAccessor(layerId, property);
      const allRules = mapTools.getSizeRulesArray(layerId);

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

      const rulesDescription = allRules.map((r) => `${r.value}=${r.size}px`).join(', ');

      return {
        success: true,
        message: `Size rules merged: ${rulesDescription} (default: ${defaultSize}px)`,
      };
    },

    // =========================================
    // Aggregate Executor
    // =========================================

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
  };
}
