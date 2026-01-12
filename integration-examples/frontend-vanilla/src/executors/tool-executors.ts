import { Deck, Layer } from '@deck.gl/core';
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';
import { scheduleRedraws } from '../map/deckgl-map';
import type { ZoomControls } from '../ui/ZoomControls';
import type { LayerToggle } from '../ui/LayerToggle';
import type { ToolStatus } from '../ui/ToolStatus';
import type { ChatContainer } from '../ui/ChatContainer';
import type { ToolCallMessage } from '../chat/types';

// Import JSONConverter utilities
import {
  resolveColor,
  resolveInterpolator,
  createLinearInterpolator,
  convertJson
} from '../config/deckJsonConfig';

import {
  executeLayerStyleSpec,
  executeAddLayerSpec
} from './json-spec-executor';

// Layer with clone method
interface CloneableLayer extends Layer {
  clone(props: Record<string, unknown>): Layer;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}

export type ToolExecutor = (params: unknown) => ToolResult;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolExecutorContext {
  deck: Deck<any>;
  zoomControls: ZoomControls;
  layerToggle: LayerToggle;
  toolStatus: ToolStatus;
  chatContainer: ChatContainer;
  layerRegistry: Map<string, string>;
}

// Color filter state for conditional coloring
interface ColorFilter {
  key: string;
  property: string;
  operator: string;
  value: unknown;
  color: [number, number, number, number];
}

let colorFilters: ColorFilter[] = [];
let basePointColor: [number, number, number, number] = [3, 111, 226, 200]; // CARTO blue

/**
 * Find layer ID by name (case-insensitive)
 */
function findLayerIdByName(
  name: string,
  layerRegistry: Map<string, string>
): string | null {
  const normalizedName = name.toLowerCase();
  for (const [layerName, layerId] of layerRegistry.entries()) {
    if (layerName.toLowerCase() === normalizedName) {
      return layerId;
    }
  }
  // Also check if it's a direct layer ID
  for (const layerId of layerRegistry.values()) {
    if (layerId.toLowerCase() === normalizedName) {
      return layerId;
    }
  }
  return null;
}

/**
 * Check if a feature matches a filter condition
 */
function matchesFilter(
  feature: { properties?: Record<string, unknown> },
  filter: ColorFilter
): boolean {
  const propValue = feature.properties?.[filter.property];
  if (propValue === undefined) return false;

  const strValue = String(propValue).toLowerCase();
  const filterValue = String(filter.value).toLowerCase();

  switch (filter.operator) {
    case 'equals':
      return strValue === filterValue;
    case 'contains':
      return strValue.includes(filterValue);
    case 'startsWith':
      return strValue.startsWith(filterValue);
    case 'regex':
      try {
        return new RegExp(filter.value as string, 'i').test(strValue);
      } catch {
        return false;
      }
    default:
      return strValue === filterValue;
  }
}

/**
 * Create tool executors for the given context
 */
export function createToolExecutors(
  context: ToolExecutorContext
): Record<string, ToolExecutor> {
  const { deck, zoomControls, layerToggle, layerRegistry } = context;

  return {
    // ==================== VIEW STATE TOOLS ====================

    [TOOL_NAMES.FLY_TO]: (params) => {
      try {
        const { lat, lng, zoom, pitch, bearing, transitionDuration } = params as {
          lat: number;
          lng: number;
          zoom?: number;
          pitch?: number;
          bearing?: number;
          transitionDuration?: number;
        };

        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
        const newZoom = zoom ?? (currentView.zoom as number) ?? 12;

        // Use JSONConverter for interpolator if needed
        const interpolator = resolveInterpolator('FlyToInterpolator');

        deck.setProps({
          initialViewState: {
            ...currentView,
            longitude: lng,
            latitude: lat,
            zoom: newZoom,
            pitch: pitch ?? (currentView.pitch as number) ?? 0,
            bearing: bearing ?? (currentView.bearing as number) ?? 0,
            transitionDuration: transitionDuration ?? 1000,
            transitionInterpolator: interpolator,
            transitionInterruption: 1 // Enable smooth transitions
          }
        });

        // Force redraws for deck.gl
        scheduleRedraws(deck);

        zoomControls.setZoomLevel(newZoom);

        return { success: true, message: `Flying to ${lat.toFixed(4)}, ${lng.toFixed(4)}` };
      } catch (error) {
        console.error('[fly-to] Error:', error);
        return {
          success: false,
          message: `Failed to fly to location: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.ZOOM_MAP]: (params) => {
      try {
        const { direction, levels } = params as {
          direction: 'in' | 'out';
          levels: number;
        };

        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
        const currentZoom = (currentView.zoom as number) || 10;
        const newZoom =
          direction === 'in'
            ? Math.min(22, currentZoom + levels)
            : Math.max(0, currentZoom - levels);

        deck.setProps({
          initialViewState: {
            longitude: (currentView.longitude as number) || -110.5556199,
            latitude: (currentView.latitude as number) || 41.8097343,
            zoom: newZoom,
            pitch: currentView.pitch as number,
            bearing: currentView.bearing as number,
            transitionDuration: 500
          }
        });

        scheduleRedraws(deck);
        zoomControls.setZoomLevel(newZoom);

        return { success: true, message: `Zoomed ${direction} to level ${newZoom.toFixed(1)}` };
      } catch (error) {
        console.error('[zoom-map] Error:', error);
        return {
          success: false,
          message: `Failed to zoom map: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.SET_VIEW_STATE]: (params) => {
      try {
        const { longitude, latitude, zoom, pitch, bearing, transitionDuration } =
          params as {
            longitude?: number;
            latitude?: number;
            zoom?: number;
            pitch?: number;
            bearing?: number;
            transitionDuration?: number;
          };

        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
        const newView = {
          longitude: longitude ?? (currentView.longitude as number) ?? -110.5556199,
          latitude: latitude ?? (currentView.latitude as number) ?? 41.8097343,
          zoom: zoom ?? (currentView.zoom as number) ?? 3,
          pitch: pitch ?? (currentView.pitch as number),
          bearing: bearing ?? (currentView.bearing as number),
          transitionDuration: transitionDuration ?? 1000
        };

        deck.setProps({ initialViewState: newView });
        scheduleRedraws(deck);

        if (zoom !== undefined) {
          zoomControls.setZoomLevel(zoom);
        }

        return { success: true, message: 'View state updated' };
      } catch (error) {
        console.error('[set-view-state] Error:', error);
        return {
          success: false,
          message: `Failed to set view state: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.ROTATE_MAP]: (params) => {
      try {
        const { bearing, relative, transitionDuration, transitionInterpolator } = params as {
          bearing: number;
          relative?: boolean;
          transitionDuration?: number;
          transitionInterpolator?: string;
        };

        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
        const currentBearing = (currentView.bearing as number) || 0;
        const newBearing = relative ? currentBearing + bearing : bearing;

        // Use JSONConverter for interpolator
        const interpolator = transitionInterpolator
          ? resolveInterpolator(transitionInterpolator)
          : createLinearInterpolator(['bearing']);

        deck.setProps({
          initialViewState: {
            longitude: (currentView.longitude as number) || -110.5556199,
            latitude: (currentView.latitude as number) || 41.8097343,
            zoom: (currentView.zoom as number) || 3,
            pitch: currentView.pitch as number,
            bearing: newBearing,
            transitionDuration: transitionDuration ?? 500,
            transitionInterpolator: interpolator
          }
        });

        scheduleRedraws(deck);

        return { success: true, message: `Rotated to bearing ${newBearing.toFixed(0)}` };
      } catch (error) {
        console.error('[rotate-map] Error:', error);
        return {
          success: false,
          message: `Failed to rotate map: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.SET_PITCH]: (params) => {
      try {
        const { pitch, transitionDuration } = params as {
          pitch: number;
          transitionDuration?: number;
        };

        const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};

        // Use JSONConverter for interpolator
        const interpolator = createLinearInterpolator(['pitch']);

        deck.setProps({
          initialViewState: {
            longitude: (currentView.longitude as number) || -110.5556199,
            latitude: (currentView.latitude as number) || 41.8097343,
            zoom: (currentView.zoom as number) || 3,
            pitch: Math.min(85, Math.max(0, pitch)),
            bearing: currentView.bearing as number,
            transitionDuration: transitionDuration ?? 500,
            transitionInterpolator: interpolator
          }
        });

        scheduleRedraws(deck);

        return { success: true, message: `Pitch set to ${pitch}` };
      } catch (error) {
        console.error('[set-pitch] Error:', error);
        return {
          success: false,
          message: `Failed to set pitch: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== LAYER VISIBILITY TOOLS ====================

    [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
      try {
        const { layerName, visible } = params as {
          layerName: string;
          visible: boolean;
        };

        const layerId = findLayerIdByName(layerName, layerRegistry) || layerName;

        // Use JSONConverter for layer update
        const result = executeLayerStyleSpec({
          layerId,
          visible
        });

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];
        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === result.layerId) {
            return layer.clone(result.props);
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);
        layerToggle.updateLayerVisibility(layerId, visible);

        return {
          success: true,
          message: `Layer "${layerName}" ${visible ? 'shown' : 'hidden'}`
        };
      } catch (error) {
        console.error('[toggle-layer] Error:', error);
        return {
          success: false,
          message: `Failed to toggle layer: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.SHOW_HIDE_LAYER]: (params) => {
      try {
        const { layerId, visible } = params as {
          layerId: string;
          visible: boolean;
        };

        // Use JSONConverter for layer update
        const result = executeLayerStyleSpec({
          layerId,
          visible
        });

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];
        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === result.layerId) {
            return layer.clone(result.props);
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);
        layerToggle.updateLayerVisibility(layerId, visible);

        return {
          success: true,
          message: `Layer ${visible ? 'shown' : 'hidden'}`
        };
      } catch (error) {
        console.error('[show-hide-layer] Error:', error);
        return {
          success: false,
          message: `Failed to show/hide layer: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== STYLING TOOLS ====================

    [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
      try {
        const { layerId, r, g, b, a, color } = params as {
          layerId?: string;
          r?: number;
          g?: number;
          b?: number;
          a?: number;
          color?: string | number[];
        };

        const targetLayerId = layerId || 'pois';
        let rgba: number[];

        // Support both RGBA values and color names/arrays
        if (color !== undefined) {
          rgba = resolveColor(color);
        } else if (r !== undefined && g !== undefined && b !== undefined) {
          rgba = [r, g, b, a ?? 200];
        } else {
          return { success: false, message: 'Color specification required' };
        }

        basePointColor = rgba as [number, number, number, number];

        // Use JSONConverter for layer update
        const result = executeLayerStyleSpec({
          layerId: targetLayerId,
          fillColor: rgba,
          pointColor: rgba
        });

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];
        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === result.layerId) {
            return layer.clone(result.props);
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        const colorDesc = typeof color === 'string' ? color : `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`;
        return {
          success: true,
          message: `Color changed to ${colorDesc}`
        };
      } catch (error) {
        console.error('[set-point-color] Error:', error);
        return {
          success: false,
          message: `Failed to set point color: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
      try {
        const { layerId, property, operator, value, r, g, b, a, color } = params as {
          layerId?: string;
          property: string;
          operator: string;
          value: unknown;
          r?: number;
          g?: number;
          b?: number;
          a?: number;
          color?: string | number[];
        };

        let rgba: number[];

        // Support both RGBA values and color names/arrays
        if (color !== undefined) {
          rgba = resolveColor(color);
        } else if (r !== undefined && g !== undefined && b !== undefined) {
          rgba = [r, g, b, a ?? 180];
        } else {
          return { success: false, message: 'Color specification required' };
        }

        const filterKey = `${property}:${operator}:${value}`;
        const newFilter: ColorFilter = {
          key: filterKey,
          property,
          operator,
          value,
          color: rgba as [number, number, number, number]
        };

        // Update or add filter
        const existingIdx = colorFilters.findIndex((f) => f.key === filterKey);
        if (existingIdx >= 0) {
          colorFilters[existingIdx] = newFilter;
        } else {
          colorFilters.push(newFilter);
        }

        const targetLayerId = layerId || 'pois';
        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        // Create color accessor function
        const colorAccessor = (feature: { properties?: Record<string, unknown> }) => {
          for (const filter of colorFilters) {
            if (matchesFilter(feature, filter)) {
              return filter.color;
            }
          }
          return basePointColor;
        };

        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            return layer.clone({
              getFillColor: colorAccessor,
              updateTriggers: {
                getFillColor: JSON.stringify(colorFilters)
              }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        return {
          success: true,
          message: `Color filter applied: ${property} ${operator} ${value}`
        };
      } catch (error) {
        console.error('[color-features-by-property] Error:', error);
        return {
          success: false,
          message: `Failed to color features: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    [TOOL_NAMES.RESET_VISUALIZATION]: (params) => {
      try {
        const { resetLayers, resetViewState } = params as {
          resetLayers?: boolean;
          resetViewState?: boolean;
        };

        if (resetLayers !== false) {
          // Clear color filters
          colorFilters = [];
          basePointColor = [3, 111, 226, 200];

          const currentLayers = (deck.props.layers || []) as CloneableLayer[];
          const updatedLayers = currentLayers.map((layer) => {
            // Use JSONConverter to reset to default colors
            const result = executeLayerStyleSpec({
              layerId: layer.id,
              fillColor: 'CartoPrimary',
              visible: true
            });
            return layer.clone({
              ...result.props,
              updateTriggers: { getFillColor: 'reset' }
            });
          });
          deck.setProps({ layers: updatedLayers as Layer[] });
        }

        if (resetViewState !== false) {
          const interpolator = resolveInterpolator('FlyToInterpolator');
          deck.setProps({
            initialViewState: {
              latitude: 41.8097343,
              longitude: -110.5556199,
              zoom: 3,
              bearing: 0,
              pitch: 0,
              transitionDuration: 1000,
              transitionInterpolator: interpolator
            }
          });
          zoomControls.setZoomLevel(3);
        }

        scheduleRedraws(deck);

        return { success: true, message: 'Visualization reset' };
      } catch (error) {
        console.error('[reset-visualization] Error:', error);
        return {
          success: false,
          message: `Failed to reset visualization: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== UPDATE LAYER STYLE ====================

    [TOOL_NAMES.UPDATE_LAYER_STYLE]: (params) => {
      try {
        const layerParams = params as Record<string, any>;
        const { layerId } = layerParams;

        if (!layerId) {
          return { success: false, message: 'Layer ID required' };
        }

        const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;

        // Use JSONConverter to process all style parameters
        const result = executeLayerStyleSpec({
          ...layerParams,
          layerId: targetLayerId
        });

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];
        let found = false;

        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === result.layerId) {
            found = true;
            // Update base color if fill color was changed
            if (result.props.getFillColor && Array.isArray(result.props.getFillColor)) {
              basePointColor = result.props.getFillColor as [number, number, number, number];
            }
            // Update layer toggle if visibility changed
            if ('visible' in result.props) {
              layerToggle.updateLayerVisibility(result.layerId, result.props.visible as boolean);
            }
            return layer.clone(result.props);
          }
          return layer;
        });

        if (!found) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        const changes = Object.keys(result.props).join(', ');
        return {
          success: true,
          message: `Layer "${layerId}" updated: ${changes}`
        };
      } catch (error) {
        console.error('[update-layer-style] Error:', error);
        return {
          success: false,
          message: `Failed to update layer style: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== ADD LAYER (NEW TOOL) ====================

    'add-layer': (params) => {
      try {
        const { layerSpec } = params as { layerSpec: Record<string, any> };

        if (!layerSpec) {
          return { success: false, message: 'Layer specification required' };
        }

        if (!layerSpec['@@type'] && !layerSpec.type) {
          return { success: false, message: 'Layer type (@@type) required in specification' };
        }

        // Ensure @@type format
        if (layerSpec.type && !layerSpec['@@type']) {
          layerSpec['@@type'] = layerSpec.type;
          delete layerSpec.type;
        }

        // Use JSONConverter to create the layer
        const resolvedLayer = executeAddLayerSpec(layerSpec);

        // Add to deck
        const currentLayers = deck.props.layers || [];
        const updatedLayers = [...currentLayers, resolvedLayer];

        deck.setProps({ layers: updatedLayers });
        scheduleRedraws(deck);

        // Register the new layer
        if (layerSpec.name) {
          layerRegistry.set(layerSpec.name, layerSpec.id);
        }

        // Update layer toggle if it's visible
        if (resolvedLayer.props.visible !== false) {
          layerToggle.updateLayerVisibility(layerSpec.id, true);
        }

        return {
          success: true,
          message: `Added layer: ${layerSpec.id}`,
          data: { layerId: layerSpec.id }
        };
      } catch (error) {
        console.error('[add-layer] Error:', error);
        return {
          success: false,
          message: `Failed to add layer: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== FILTER FEATURES ====================

    [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params) => {
      try {
        const { layerId, property, operator, value, reset } = params as {
          layerId?: string;
          property?: string;
          operator?: string;
          value?: string;
          reset?: boolean;
        };

        const targetLayerId = layerId || 'pois';
        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        if (reset) {
          // Reset filter - show all features
          const updatedLayers = currentLayers.map((layer) => {
            if (layer.id === targetLayerId) {
              return layer.clone({
                getFilterValue: () => 1,
                filterRange: [0, 1],
                updateTriggers: { getFilterValue: 'reset' }
              });
            }
            return layer;
          });
          deck.setProps({ layers: updatedLayers as Layer[] });
          scheduleRedraws(deck);
          return { success: true, message: 'Filter reset - showing all features' };
        }

        if (!property || value === undefined) {
          return { success: false, message: 'Property and value required for filtering' };
        }

        // Create filter function
        const filterFn = (feature: { properties?: Record<string, unknown> }) => {
          const propValue = feature.properties?.[property];
          if (propValue === undefined) return 0;

          const strValue = String(propValue).toLowerCase();
          const filterValue = String(value).toLowerCase();

          switch (operator || 'equals') {
            case 'equals':
              return strValue === filterValue ? 1 : 0;
            case 'contains':
              return strValue.includes(filterValue) ? 1 : 0;
            case 'startsWith':
              return strValue.startsWith(filterValue) ? 1 : 0;
            case 'regex':
              try {
                return new RegExp(value, 'i').test(strValue) ? 1 : 0;
              } catch {
                return 0;
              }
            default:
              return strValue === filterValue ? 1 : 0;
          }
        };

        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            return layer.clone({
              getFilterValue: filterFn,
              filterRange: [1, 1],
              extensions: [], // DataFilterExtension would be needed for proper filtering
              updateTriggers: { getFilterValue: `${property}:${operator}:${value}` }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        return {
          success: true,
          message: `Filter applied: ${property} ${operator || 'equals'} "${value}"`
        };
      } catch (error) {
        console.error('[filter-features-by-property] Error:', error);
        return {
          success: false,
          message: `Failed to filter features: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== SIZE FEATURES ====================

    [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params) => {
      try {
        const { layerId, property, sizeRules, defaultSize, reset } = params as {
          layerId?: string;
          property?: string;
          sizeRules?: Array<{ value: string; size: number }>;
          defaultSize?: number;
          reset?: boolean;
        };

        const targetLayerId = layerId || 'pois';
        const currentLayers = (deck.props.layers || []) as CloneableLayer[];
        const baseSize = defaultSize || 8;

        if (reset) {
          // Use JSONConverter for size reset
          const result = executeLayerStyleSpec({
            layerId: targetLayerId,
            pointRadius: baseSize
          });

          const updatedLayers = currentLayers.map((layer) => {
            if (layer.id === result.layerId) {
              return layer.clone({
                ...result.props,
                updateTriggers: { getPointRadius: 'reset' }
              });
            }
            return layer;
          });
          deck.setProps({ layers: updatedLayers as Layer[] });
          scheduleRedraws(deck);
          return { success: true, message: 'Size reset to uniform' };
        }

        if (!property) {
          return { success: false, message: 'Property required for sizing' };
        }

        // Create size accessor function
        const sizeAccessor = (feature: { properties?: Record<string, unknown> }) => {
          const propValue = feature.properties?.[property];
          if (propValue === undefined) return baseSize;

          const strValue = String(propValue).toLowerCase();

          if (sizeRules) {
            for (const rule of sizeRules) {
              if (strValue === String(rule.value).toLowerCase()) {
                return rule.size;
              }
            }
          }
          return baseSize;
        };

        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            return layer.clone({
              getPointRadius: sizeAccessor,
              pointRadiusMinPixels: 1,
              updateTriggers: { getPointRadius: JSON.stringify(sizeRules) }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        return {
          success: true,
          message: `Size by property "${property}" applied`
        };
      } catch (error) {
        console.error('[size-features-by-property] Error:', error);
        return {
          success: false,
          message: `Failed to size features: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== REMOVE LAYER ====================

    [TOOL_NAMES.REMOVE_LAYER]: (params) => {
      try {
        const { layerId } = params as { layerId: string };

        const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;
        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        const updatedLayers = currentLayers.filter((layer) => layer.id !== targetLayerId);

        if (updatedLayers.length === currentLayers.length) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Remove from registry
        for (const [name, id] of layerRegistry.entries()) {
          if (id === targetLayerId) {
            layerRegistry.delete(name);
            break;
          }
        }

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        return { success: true, message: `Layer "${layerId}" removed` };
      } catch (error) {
        console.error('[remove-layer] Error:', error);
        return {
          success: false,
          message: `Failed to remove layer: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== UPDATE LAYER PROPS ====================

    [TOOL_NAMES.UPDATE_LAYER_PROPS]: (params) => {
      try {
        const { layerId, props } = params as {
          layerId: string;
          props: Record<string, unknown>;
        };

        const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;

        // Use JSONConverter to resolve any @@ references in props
        const resolvedProps = convertJson(props);

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        let found = false;
        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            found = true;
            return layer.clone(resolvedProps);
          }
          return layer;
        });

        if (!found) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        return {
          success: true,
          message: `Layer "${layerId}" props updated`
        };
      } catch (error) {
        console.error('[update-layer-props] Error:', error);
        return {
          success: false,
          message: `Failed to update layer props: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    },

    // ==================== QUERY TOOLS (return info to LLM) ====================

    [TOOL_NAMES.GET_LAYER_CONFIG]: (params) => {
      try {
        const { layerId } = params as { layerId?: string };

        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        if (layerId) {
          const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;
          const layer = currentLayers.find((l) => l.id === targetLayerId);
          if (layer) {
            return {
              success: true,
              message: `Layer "${layerId}": visible=${layer.props.visible}, opacity=${layer.props.opacity}`,
              data: {
                id: layer.id,
                type: layer.constructor.name,
                visible: layer.props.visible,
                opacity: layer.props.opacity
              }
            };
          }
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Return all layers info
        const layerInfo = currentLayers.map((l) => ({
          id: l.id,
          type: l.constructor.name,
          visible: l.props.visible
        }));
        return {
          success: true,
          message: `Available layers: ${layerInfo.map(l => `${l.id} (visible: ${l.visible})`).join(', ')}`,
          data: { layers: layerInfo }
        };
      } catch (error) {
        console.error('[get-layer-config] Error:', error);
        return {
          success: false,
          message: `Failed to get layer config: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: error as Error
        };
      }
    }
  };
}

/**
 * Handle incoming tool call messages
 */
export async function handleToolCall(
  message: ToolCallMessage,
  executors: Record<string, ToolExecutor>,
  context: ToolExecutorContext
): Promise<void> {
  const { toolStatus, chatContainer } = context;

  console.log('[ToolExecutor] Received tool_call message:', JSON.stringify(message, null, 2));
  console.log('[ToolExecutor] Available executors:', Object.keys(executors));

  // Extract tool name - server may use different field names
  const rawToolName =
    message.toolName ||
    message.tool ||
    message.tool_name ||
    '';

  // Extract parameters - server may use different field names
  const rawData =
    message.data ||
    message.parameters ||
    {};

  console.log('[ToolExecutor] Extracted:', { rawToolName, rawData });

  // Parse the tool response to get standardized format
  const parsed = parseToolResponse({
    toolName: rawToolName,
    data: rawData,
    message: message.message,
    error: message.error ? { code: 'EXECUTION_ERROR', message: message.error } : undefined
  });

  const { toolName, data, error } = parsed;

  console.log('[ToolExecutor] Parsed:', { toolName, data, error });

  if (error) {
    console.error(`[ToolExecutor] Tool error: ${error.message}`);
    toolStatus.setError(error.message);
    chatContainer.addToolCall({
      toolName: toolName || 'unknown',
      status: 'error',
      message: error.message
    });
    return;
  }

  if (!toolName) {
    console.error('[ToolExecutor] No tool name in message. Raw message:', message);
    toolStatus.setError('No tool name provided');
    return;
  }

  // Show executing state
  toolStatus.showToolExecution(toolName);

  // Execute the tool
  const executor = executors[toolName];
  console.log('[ToolExecutor] Executor found:', !!executor, 'Data:', data);

  if (executor && data) {
    try {
      console.log('[ToolExecutor] Executing tool:', toolName, 'with data:', data);
      const result = executor(data);
      console.log('[ToolExecutor] Execution result:', result);

      if (result.success) {
        toolStatus.showSuccess(result.message);
      } else {
        toolStatus.setError(result.message);
      }

      chatContainer.addToolCall({
        toolName,
        status: result.success ? 'success' : 'error',
        message: result.message
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ToolExecutor] Execution error:', errorMessage, err);
      toolStatus.setError(errorMessage);
      chatContainer.addToolCall({
        toolName,
        status: 'error',
        message: errorMessage
      });
    }
  } else if (!executor) {
    console.warn(`[ToolExecutor] No executor found for tool: ${toolName}`);
    // Check if it's the add-layer tool with a different name
    if (toolName === 'add_layer' || toolName === 'addLayer') {
      const addLayerExecutor = executors['add-layer'];
      if (addLayerExecutor && data) {
        try {
          const result = addLayerExecutor(data);
          if (result.success) {
            toolStatus.showSuccess(result.message);
          } else {
            toolStatus.setError(result.message);
          }
          chatContainer.addToolCall({
            toolName,
            status: result.success ? 'success' : 'error',
            message: result.message
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          toolStatus.setError(errorMessage);
          chatContainer.addToolCall({
            toolName,
            status: 'error',
            message: errorMessage
          });
        }
      }
    } else {
      toolStatus.showSuccess(`Tool ${toolName} executed on backend`);
    }
  } else if (!data) {
    console.warn(`[ToolExecutor] No data for tool: ${toolName}`);
    toolStatus.setError('No parameters provided for tool');
  }
}