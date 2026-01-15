import { type Ref } from 'vue';
import { Deck } from '@deck.gl/core';
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { useMapToolsState, type SizeRule } from './useMapToolsState';
import type maplibregl from 'maplibre-gl';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
}

type ToolExecutor = (params: Record<string, unknown>) => ToolResult;

export function useMapTools(
  deckRef: Ref<Deck | null>,
  mapRef: Ref<maplibregl.Map | null>
) {
  const stateService = useMapToolsState();

  function getExecutors(): Record<string, ToolExecutor> {
    const deck = deckRef.value;
    const map = mapRef.value;

    if (!deck) return {};

    return {
      [TOOL_NAMES.FLY_TO]: (params) => {
        const { lat, lng, zoom } = params as { lat: number; lng: number; zoom?: number };
        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
        deck.setProps({
          initialViewState: {
            ...currentView,
            longitude: lng,
            latitude: lat,
            zoom: zoom || 12,
            transitionDuration: 1000,
            transitionInterruption: 1
          }
        });

        if (map) {
          map.flyTo({
            center: [lng, lat],
            zoom: zoom || 12,
            duration: 1000
          });
        }

        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);
        setTimeout(() => deck.redraw(true), 1100);

        return { success: true, message: `Flying to ${lat.toFixed(2)}, ${lng.toFixed(2)}` };
      },

      [TOOL_NAMES.ZOOM_MAP]: (params) => {
        const { direction, levels = 1 } = params as { direction: 'in' | 'out'; levels?: number };
        const currentView = (deck.props.initialViewState as Record<string, number>) || { zoom: 10 };
        const currentZoom = currentView.zoom || 10;
        const newZoom = direction === 'in'
          ? Math.min(22, currentZoom + levels)
          : Math.max(0, currentZoom - levels);

        deck.setProps({
          initialViewState: {
            ...currentView,
            zoom: newZoom,
            transitionDuration: 500,
            transitionInterruption: 1
          }
        });

        if (map) {
          map.jumpTo({
            center: [currentView.longitude, currentView.latitude],
            zoom: newZoom,
            bearing: currentView.bearing || 0,
            pitch: currentView.pitch || 0
          });
        }

        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);
        setTimeout(() => deck.redraw(true), 600);

        return { success: true, message: `Zoomed ${direction} to level ${newZoom.toFixed(1)}` };
      },

      [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
        const { layerName, visible } = params as { layerName: string; visible: boolean };
        const currentLayers = (deck.props.layers || []) as any[];

        const layerNameMap: Record<string, string> = {
          'airports': 'points-layer',
          'points': 'points-layer',
          'points-layer': 'points-layer'
        };

        const normalizedName = layerName.toLowerCase();
        const layerId = layerNameMap[normalizedName] || normalizedName;

        const layerFound = currentLayers.some(layer => layer?.id === layerId);
        if (!layerFound) {
          return { success: false, message: `Layer "${layerName}" not found` };
        }

        const updatedLayers = currentLayers.map(layer => {
          if (layer?.id === layerId) {
            return layer.clone({ visible });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));

        return { success: true, message: `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}` };
      },

      [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
        const { r, g, b, a = 200 } = params as { r: number; g: number; b: number; a?: number };
        const rgba = [r, g, b, a];
        const currentLayers = (deck.props.layers || []) as any[];

        const updatedLayers = currentLayers.map(layer => {
          if (layer?.id === 'points-layer') {
            return layer.clone({ getFillColor: rgba });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return { success: true, message: `Point color changed to rgb(${r}, ${g}, ${b})` };
      },

      [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value, r, g, b, a = 180 } = params as {
          layerId?: string; property: string; operator?: string; value: string; r: number; g: number; b: number; a?: number;
        };
        const filterColor = [r, g, b, a];
        const defaultColor = [200, 0, 80, 180];
        const currentLayers = (deck.props.layers || []) as any[];

        const filterKey = `${property}:${operator}:${value}`;
        const newFilter = { key: filterKey, property, operator: operator as any, value, color: filterColor };
        const filters = stateService.addColorFilter(layerId, newFilter);

        const colorAccessor = stateService.createColorAccessor(layerId, defaultColor);

        const updatedLayers = currentLayers.map(layer => {
          if (layer?.id === layerId) {
            return layer.clone({
              getFillColor: colorAccessor,
              updateTriggers: { getFillColor: JSON.stringify(filters) }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return { success: true, message: `Colored features where ${property} ${operator} "${value}"` };
      },

      [TOOL_NAMES.QUERY_FEATURES]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', includeNames = false } = params as {
          layerId?: string; property: string; operator?: string; value?: string; includeNames?: boolean;
        };
        const currentLayers = (deck.props.layers || []) as any[];

        const layer = currentLayers.find(l => l?.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        const data = layer.props.data as GeoJSON.FeatureCollection;
        if (!data?.features) {
          return { success: false, message: 'No feature data available' };
        }

        const matchesFilter = (feature: GeoJSON.Feature): boolean => {
          if (operator === 'all') return true;
          const propValue = String(feature.properties?.[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        const matchingFeatures = data.features.filter(matchesFilter);
        const count = matchingFeatures.length;
        const total = data.features.length;

        let message = operator === 'all'
          ? `Total features: ${count}`
          : `Found ${count} features where ${property} ${operator} "${value}" (out of ${total} total)`;

        let sampleNames: string[] = [];
        if (includeNames && matchingFeatures.length > 0) {
          sampleNames = matchingFeatures
            .slice(0, 10)
            .map(f => (f.properties?.name || f.properties?.abbrev || 'Unknown') as string)
            .filter(Boolean);
        }

        return {
          success: true,
          message,
          data: { count, total, sampleNames: sampleNames.length > 0 ? sampleNames : undefined }
        };
      },

      [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', reset = false } = params as {
          layerId?: string; property?: string; operator?: string; value?: string; reset?: boolean;
        };
        const currentLayers = (deck.props.layers || []) as any[];

        const layer = currentLayers.find(l => l?.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        const originalData = stateService.getOrSetOriginalData(layerId, layer.props.data);

        if (!originalData?.features) {
          return { success: false, message: 'No feature data available' };
        }

        if (reset) {
          const updatedLayers = currentLayers.map(l => {
            if (l?.id === layerId) {
              return l.clone({ data: originalData, updateTriggers: { data: 'reset' } });
            }
            return l;
          });
          deck.setProps({ layers: updatedLayers });
          requestAnimationFrame(() => deck.redraw(true));
          return { success: true, message: `Filter cleared - showing all ${originalData.features.length} features` };
        }

        if (!property) {
          return { success: false, message: 'Property is required for filtering. Use reset=true to clear filters.' };
        }

        const matchesFilter = (feature: GeoJSON.Feature): boolean => {
          const propValue = String(feature.properties?.[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        const filteredFeatures = originalData.features.filter(matchesFilter);
        const filteredData = { ...originalData, features: filteredFeatures };

        const updatedLayers = currentLayers.map(l => {
          if (l?.id === layerId) {
            return l.clone({ data: filteredData, updateTriggers: { data: `${property}:${operator}:${value}` } });
          }
          return l;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        return { success: true, message: `Filtered to ${filteredFeatures.length} features where ${property} ${operator} "${value}"` };
      },

      [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params) => {
        const { layerId = 'points-layer', property, sizeRules = [], defaultSize = 8, reset = false } = params as {
          layerId?: string; property?: string; sizeRules?: SizeRule[]; defaultSize?: number; reset?: boolean;
        };
        const currentLayers = (deck.props.layers || []) as any[];

        const layer = currentLayers.find(l => l?.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        if (reset) {
          stateService.clearSizeRules(layerId);
          const updatedLayers = currentLayers.map(l => {
            if (l?.id === layerId) {
              return l.clone({
                getPointRadius: defaultSize,
                pointRadiusUnits: 'pixels',
                pointRadiusMinPixels: 1,
                pointRadiusMaxPixels: 200,
                updateTriggers: { getPointRadius: 'reset' }
              });
            }
            return l;
          });
          deck.setProps({ layers: updatedLayers });
          requestAnimationFrame(() => deck.redraw(true));
          return { success: true, message: `Size reset to uniform ${defaultSize}px` };
        }

        if (!property || sizeRules.length === 0) {
          return { success: false, message: 'Property and sizeRules are required. Use reset=true to clear size rules.' };
        }

        stateService.mergeSizeRules(layerId, property, sizeRules, defaultSize);
        const sizeAccessor = stateService.createSizeAccessor(layerId, property);
        const allRules = stateService.getSizeRulesArray(layerId);

        const updatedLayers = currentLayers.map(l => {
          if (l?.id === layerId) {
            return l.clone({
              getPointRadius: sizeAccessor,
              pointRadiusUnits: 'pixels',
              pointRadiusMinPixels: 1,
              pointRadiusMaxPixels: 200,
              updateTriggers: { getPointRadius: JSON.stringify(allRules) }
            });
          }
          return l;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw(true));
        setTimeout(() => deck.redraw(true), 50);

        const rulesDescription = allRules.map(r => `${r.value}=${r.size}px`).join(', ');
        return { success: true, message: `Size rules merged: ${rulesDescription} (default: ${defaultSize}px)` };
      },

      [TOOL_NAMES.AGGREGATE_FEATURES]: (params) => {
        const { layerId = 'points-layer', groupBy } = params as { layerId?: string; groupBy: string };
        const currentLayers = (deck.props.layers || []) as any[];

        const layer = currentLayers.find(l => l?.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        const data = (stateService.getOriginalData(layerId) || layer.props.data) as GeoJSON.FeatureCollection;
        if (!data?.features) {
          return { success: false, message: 'No feature data available' };
        }

        if (!groupBy) {
          return { success: false, message: 'groupBy property is required' };
        }

        const counts = new Map<string, number>();
        data.features.forEach(feature => {
          const value = String(feature.properties?.[groupBy] || 'unknown');
          counts.set(value, (counts.get(value) || 0) + 1);
        });

        const results = Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        const tableRows = results.map(r => `${r.value}: ${r.count}`).join('\n');
        const total = data.features.length;

        return {
          success: true,
          message: `Aggregation by "${groupBy}" (${total} total features):\n${tableRows}`,
          data: { groupBy, total, groups: results }
        };
      }
    };
  }

  function execute(tool: string, parameters: Record<string, unknown>): ToolResult {
    const executors = getExecutors();

    if (Object.keys(executors).length === 0) {
      return { success: false, message: 'Map tools not initialized' };
    }

    const executor = executors[tool];
    if (!executor) {
      console.warn(`Unknown tool: ${tool}`);
      return { success: false, message: `Unknown tool: ${tool}` };
    }

    console.log(`Executing tool: ${tool}`, parameters);
    return executor(parameters);
  }

  function isInitialized(): boolean {
    return deckRef.value !== null && mapRef.value !== null;
  }

  return { execute, isInitialized, getExecutors };
}
