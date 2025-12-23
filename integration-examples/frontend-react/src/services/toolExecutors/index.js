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
  filterFeatures,
} from '../deckUtils';
import {
  DEFAULT_LAYER_COLOR,
  DEFAULT_POINT_SIZE,
} from '../../config/constants';


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

  return {
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

      // For color-by-property, we need to track filters in mapTools
      const filterColor = [r, g, b, a];
      const filterKey = `${property}:${operator}:${value}`;
      const newFilter = {
        key: filterKey,
        property,
        operator,
        value,
        color: filterColor,
      };

      // Add filter to context
      const filters = mapTools.addColorFilter(layerId, newFilter);

      // Create color accessor using mapTools
      const colorAccessor = mapTools.createColorAccessor(layerId, DEFAULT_LAYER_COLOR);

      // Apply directly since we need custom accessor from mapTools
      const currentLayers = deck.props.layers || [];
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

      // Store/retrieve original data through mapTools
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
}
