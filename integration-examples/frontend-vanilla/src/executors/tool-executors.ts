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
  convertJson,
  formatColorForConverter
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

export type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

// Callback for sending tool results back to server
export type SendToolResultCallback = (result: {
  toolName: string;
  callId: string;
  success: boolean;
  message: string;
  error?: string;
}) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolExecutorContext {
  deck: Deck<any>;
  zoomControls: ZoomControls;
  layerToggle: LayerToggle;
  toolStatus: ToolStatus;
  chatContainer: ChatContainer;
  layerRegistry: Map<string, string>;
  sendToolResult?: SendToolResultCallback;
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
 * Generate a semantic, human-readable name from technical parameters
 */
function generateSemanticLayerName(params: any): string {
  const { tableName, id } = params;

  // Extract context from table name or ID
  const tableNameLower = (tableName || '').toLowerCase();
  const idLower = (id || '').toLowerCase();

  // Detect common data types and generate appropriate names
  if (idLower.includes('population') || tableNameLower.includes('population')) {
    if (idLower.includes('empire_state') || idLower.includes('building')) {
      return 'Population - Empire State Area';
    }
    return 'Population Data';
  }

  if (idLower.includes('enriched_area')) {
    if (idLower.includes('empire_state')) {
      return 'Enriched Area - Empire State Building';
    }
    return 'Enriched Area Data';
  }

  // Check for geographic indicators
  if (tableNameLower.includes('buffer') || idLower.includes('buffer')) {
    return 'Buffer Zone Analysis';
  }

  // Default: Format the ID nicely
  const cleanName = id
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase())
    .replace(/\b(Wfproc|Mcptool|Out)\b/gi, '') // Remove technical terms
    .trim();

  return cleanName || 'Vector Layer';
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

        console.log('[color-features-by-property] Starting with params:', { layerId, property, operator, value, r, g, b, a, color });

        // Map common property name aliases to actual property names in the data
        const propertyAliases: Record<string, string[]> = {
          'type': ['group_name', 'subgroup_name', 'category', 'class', 'type'],
          'category': ['group_name', 'subgroup_name', 'category', 'type'],
          'class': ['subgroup_name', 'group_name', 'class', 'type'],
          'name': ['name', 'title', 'label'],
        };

        // Get alternative property names to try
        const propertiesToTry = propertyAliases[property.toLowerCase()] || [property];

        let rgba: number[];

        // Support both RGBA values and color names/arrays
        if (color !== undefined) {
          rgba = resolveColor(color);
        } else if (r !== undefined && g !== undefined && b !== undefined) {
          rgba = [r, g, b, a ?? 180];
        } else {
          return { success: false, message: 'Color specification required' };
        }

        console.log('[color-features-by-property] Resolved color:', rgba);

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

        console.log('[color-features-by-property] Active color filters:', colorFilters);

        const targetLayerId = layerId || 'pois';
        const currentLayers = (deck.props.layers || []) as CloneableLayer[];

        console.log('[color-features-by-property] Target layer:', targetLayerId);
        console.log('[color-features-by-property] Available layers:', currentLayers.map(l => l.id));

        // Create color accessor function with debug logging
        let accessorCallCount = 0;
        const colorAccessor = (feature: { properties?: Record<string, unknown> } | any) => {
          // Handle different feature structures (GeoJSON vs MVT)
          const props = feature.properties || feature;

          // Log first few calls for debugging
          if (accessorCallCount < 3) {
            const allKeys = props ? Object.keys(props) : [];
            console.log('[color-features-by-property] Feature properties:', allKeys.join(', '));
            console.log('[color-features-by-property] Trying properties:', propertiesToTry.join(', '));
            console.log('[color-features-by-property] Values:', propertiesToTry.map(p => `${p}=${props?.[p]}`).join(', '));
            accessorCallCount++;
          }

          // Check each filter against alternative property names
          for (const filter of colorFilters) {
            // Try each alternative property name
            for (const propName of propertiesToTry) {
              const propValue = props?.[propName];
              if (propValue !== undefined) {
                // Check if value matches (case-insensitive for strings)
                const filterValue = filter.value;
                const matches =
                  filter.operator === 'equals'
                    ? String(propValue).toLowerCase() === String(filterValue).toLowerCase()
                    : filter.operator === 'contains'
                    ? String(propValue).toLowerCase().includes(String(filterValue).toLowerCase())
                    : matchesFilter({ properties: { [filter.property]: propValue } }, filter);

                if (matches) {
                  return filter.color;
                }
              }
            }
          }
          return basePointColor;
        };

        // Use timestamp to ensure updateTriggers forces re-render
        const updateKey = `${Date.now()}-${JSON.stringify(colorFilters)}`;
        let layerFound = false;

        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            layerFound = true;
            console.log('[color-features-by-property] Updating layer:', layer.id, 'type:', layer.constructor.name);
            return layer.clone({
              getFillColor: colorAccessor,
              getColor: colorAccessor, // Some layers use getColor instead
              updateTriggers: {
                getFillColor: updateKey,
                getColor: updateKey
              }
            });
          }
          return layer;
        });

        if (!layerFound) {
          console.warn('[color-features-by-property] Layer not found:', targetLayerId);
          return { success: false, message: `Layer "${targetLayerId}" not found` };
        }

        deck.setProps({ layers: updatedLayers as Layer[] });
        scheduleRedraws(deck);

        console.log('[color-features-by-property] Layer updated successfully');

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

    [TOOL_NAMES.ADD_LAYER]: async (params) => {
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

        // Use JSONConverter to create the layer (await the async function)
        const resolvedLayer = await executeAddLayerSpec(layerSpec);

        // Add to deck
        const currentLayers = deck.props.layers || [];
        const updatedLayers = [...currentLayers, resolvedLayer];

        deck.setProps({ layers: updatedLayers });
        scheduleRedraws(deck);

        // Register the new layer
        const layerName = layerSpec.name || layerSpec.id;
        layerRegistry.set(layerName, layerSpec.id);

        // Add layer to the layer toggle UI
        const currentToggleLayers = layerToggle.getLayers();

        // Determine layer color from the spec
        let layerColor = '#666'; // Default gray
        if (layerSpec.getFillColor) {
          if (typeof layerSpec.getFillColor === 'string' && layerSpec.getFillColor.startsWith('@@#')) {
            // Extract color name from @@# reference
            layerColor = layerSpec.getFillColor.substring(3);
          } else if (Array.isArray(layerSpec.getFillColor)) {
            layerColor = `rgb(${layerSpec.getFillColor[0]}, ${layerSpec.getFillColor[1]}, ${layerSpec.getFillColor[2]})`;
          }
        }

        const newLayerInfo = {
          id: layerSpec.id,
          name: layerName,
          visible: resolvedLayer.props.visible !== false,
          color: layerColor
        };

        // Check if layer already exists in toggle
        const existingIndex = currentToggleLayers.findIndex((layer: any) => layer.id === layerSpec.id);
        if (existingIndex >= 0) {
          currentToggleLayers[existingIndex] = newLayerInfo;
        } else {
          currentToggleLayers.push(newLayerInfo);
        }

        // Update the layer toggle UI
        layerToggle.setLayers(currentToggleLayers);

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

    // ==================== ADD VECTOR LAYER ====================
    /**
     * Add a CARTO VectorTileLayer to visualize vector data from BigQuery or Snowflake.
     *
     * Required environment variables in .env file:
     * - VITE_API_BASE_URL: CARTO API base URL (e.g., https://gcp-us-east1.api.carto.com)
     * - VITE_API_ACCESS_TOKEN: Your CARTO access token
     * - VITE_CONNECTION_NAME: (optional) Default connection name
     *
     * When using MCP workflow results, extract credentials from the response:
     * - connectionName from response.data.connectionName
     * - tableName from response.data.jobMetadata.workflowOutputTableName
     * - accessToken from response.data.accessToken
     * - apiBaseUrl from response.data.apiBaseUrl
     */
    [TOOL_NAMES.ADD_VECTOR_LAYER]: async (params) => {
      const {
        id = '',
        displayName,
        connectionName = import.meta.env.VITE_CONNECTION_NAME || 'carto_dw',
        tableName = '',
        accessToken,
        apiBaseUrl,
        columns,
        spatialDataColumn,
        visible = true,
        opacity = 1,
        fillColor,
        lineColor,
        pointRadiusMinPixels,
        pickable = true
      } = params as {
        id: string;
        displayName?: string;
        connectionName?: string;
        tableName: string;
        accessToken?: string;
        apiBaseUrl?: string;
        columns?: string[];
        spatialDataColumn?: string;
        visible?: boolean;
        opacity?: number;
        fillColor?: string | number[];
        lineColor?: string | number[];
        pointRadiusMinPixels?: number;
        pickable?: boolean;
      };

      try {
        console.log('[add-vector-layer] Starting with params:', params);

        if (!id || !tableName) {
          console.error('[add-vector-layer] Missing required params:', { id, tableName });
          return { success: false, message: 'Layer ID and table name required' };
        }

        // Log credential status
        console.log('[add-vector-layer] Credentials status:', {
          hasAccessToken: !!accessToken,
          hasApiBaseUrl: !!apiBaseUrl,
          accessTokenLength: accessToken?.length,
          apiBaseUrl: apiBaseUrl
        });

        // Build CARTO data source configuration
        const dataConfig: Record<string, any> = {
          '@@function': 'vectorTableSource',
          connectionName,
          tableName
        };

        if (accessToken) dataConfig.accessToken = accessToken;
        if (apiBaseUrl) dataConfig.apiBaseUrl = apiBaseUrl;
        if (columns) dataConfig.columns = columns;
        if (spatialDataColumn) dataConfig.spatialDataColumn = spatialDataColumn;

        console.log('[add-vector-layer] Data config for JSONConverter:', dataConfig);

        // Build layer specification with JSONConverter syntax
        const layerSpec: Record<string, any> = {
          '@@type': 'VectorTileLayer',
          id,
          data: dataConfig,
          visible,
          opacity,
          pickable,
          // VectorTileLayer specific defaults
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true
        };

        // Add styling with JSONConverter color resolution
        if (fillColor) {
          layerSpec.getFillColor = formatColorForConverter(fillColor);
        } else {
          // Use bright red for better visibility
          layerSpec.getFillColor = [255, 0, 0, 200];
        }

        if (lineColor) {
          layerSpec.getLineColor = formatColorForConverter(lineColor);
        } else {
          // Use white for contrast
          layerSpec.getLineColor = [255, 255, 255, 255];
        }

        // Make points more visible
        layerSpec.pointRadiusMinPixels = pointRadiusMinPixels || 5;
        layerSpec.pointRadiusMaxPixels = 50;
        layerSpec.getPointRadius = 200; // Larger default radius
        layerSpec.lineWidthMinPixels = 2; // Thicker lines

        console.log('[add-vector-layer] Layer spec before JSONConverter:', layerSpec);
        console.log('[add-vector-layer] Layer spec data config:', layerSpec.data);

        // Get semantic name for the layer
        const semanticName = displayName || generateSemanticLayerName(params);
        const layerName = semanticName || tableName.split('.').pop() || id;

        // Add layer to toggle with loading state immediately
        const currentToggleLayers = layerToggle.getLayers();
        const newLayerInfo = {
          id: id,
          name: layerName,
          visible: visible,
          color: fillColor ?
            (typeof fillColor === 'string' ? fillColor :
             Array.isArray(fillColor) ? `rgb(${fillColor[0]}, ${fillColor[1]}, ${fillColor[2]})` : '#036fe2')
            : '#036fe2',
          loading: true,  // Initially loading
          loadingMessage: 'Creating layer...'
        };

        // Check if layer already exists in toggle
        const existingIndex = currentToggleLayers.findIndex((layer: any) => layer.id === id);
        if (existingIndex >= 0) {
          // Update existing layer
          currentToggleLayers[existingIndex] = newLayerInfo;
        } else {
          // Add new layer
          currentToggleLayers.push(newLayerInfo);
        }

        // Update the layer toggle UI immediately with loading state
        layerToggle.setLayers(currentToggleLayers);

        // Update loading message to resolving data source
        setTimeout(() => {
          const layers = layerToggle.getLayers();
          const layerInfo = layers.find(l => l.id === id);
          if (layerInfo && layerInfo.loading) {
            layerInfo.loadingMessage = 'Resolving data source...';
            layerToggle.setLayers(layers);
          }
        }, 100);

        // Use JSONConverter to create the layer - it will resolve the @@function
        const resolvedLayer = await executeAddLayerSpec(layerSpec);

        console.log('[add-vector-layer] Resolved layer after JSONConverter:', {
          id: resolvedLayer.id,
          type: resolvedLayer.constructor.name,
          dataConfig: resolvedLayer.props?.data,
          hasProps: !!resolvedLayer.props,
          propsKeys: resolvedLayer.props ? Object.keys(resolvedLayer.props) : []
        });

        // Add to deck
        const currentLayers = deck.props.layers || [];
        const updatedLayers = [...currentLayers, resolvedLayer];

        deck.setProps({ layers: updatedLayers });
        scheduleRedraws(deck);

        // Update loading message to loading tiles
        const toggleLayers = layerToggle.getLayers();
        const toggleLayerInfo = toggleLayers.find(l => l.id === id);
        if (toggleLayerInfo) {
          toggleLayerInfo.loadingMessage = 'Loading map tiles...';
          layerToggle.setLayers(toggleLayers);
        }

        // Get current viewport for debugging
        const viewport = deck.getViewports()?.[0] as any;
        const currentViewState: any = viewport ? {
          longitude: viewport.longitude,
          latitude: viewport.latitude,
          zoom: viewport.zoom
        } : deck.props.initialViewState;
        console.log('[add-vector-layer] Current viewport:', {
          longitude: currentViewState?.longitude,
          latitude: currentViewState?.latitude,
          zoom: currentViewState?.zoom
        });

        // Check if we have bounds in the data source
        if (resolvedLayer.props?.data?.bounds) {
          const bounds = resolvedLayer.props.data.bounds;
          const center = resolvedLayer.props.data.center;
          console.log('[add-vector-layer] Layer data bounds:', bounds);
          console.log('[add-vector-layer] Layer data center:', center);

          // Suggest zoom location if not in view
          if (center && center.length >= 2) {
            const [centerLng, centerLat, suggestedZoom] = center;
            const viewLng = currentViewState?.longitude;
            const viewLat = currentViewState?.latitude;
            const currentZoom = currentViewState?.zoom;

            // Check if viewport is far from data center
            const distance = Math.sqrt(
              Math.pow(viewLng - centerLng, 2) +
              Math.pow(viewLat - centerLat, 2)
            );

            console.log('[add-vector-layer] Distance from data center:', distance);

            if (distance > 0.1 || currentZoom < 12) {
              console.log('[add-vector-layer] TIP: Data is centered at:', {
                longitude: centerLng,
                latitude: centerLat,
                suggestedZoom: suggestedZoom || 14
              });
              console.log('[add-vector-layer] Auto-zooming to data bounds...');

              // Auto-zoom to the data bounds
              const newViewState = {
                longitude: centerLng,
                latitude: centerLat,
                zoom: suggestedZoom || 14,
                pitch: 0,
                bearing: 0,
                transitionDuration: 2000,
                transitionInterpolator: createLinearInterpolator(['longitude', 'latitude', 'zoom'])
              };

              deck.setProps({
                initialViewState: newViewState
              });

              // Schedule multiple redraws to ensure the transition completes
              scheduleRedraws(deck);
              setTimeout(() => scheduleRedraws(deck), 2100);
            }
          }
        }

        // Monitor tile loading and clear loading state when done
        let tilesLoaded = false;
        let checkCount = 0;
        const maxChecks = 20; // 10 seconds max

        const checkTileLoading = setInterval(() => {
          const finalLayers = deck.props.layers;
          const addedLayer = finalLayers?.find((l: any) => l.id === id) as any;
          checkCount++;

          if (addedLayer) {
            // Check various loading indicators
            const isLoaded = addedLayer.isLoaded ||
                           addedLayer.state?.isLoaded ||
                           addedLayer.state?.dataLoaded ||
                           checkCount > 3; // Consider loaded after 1.5 seconds minimum

            if (isLoaded && !tilesLoaded) {
              tilesLoaded = true;
              // Remove loading state
              const layers = layerToggle.getLayers();
              const layerInfo = layers.find(l => l.id === id);
              if (layerInfo) {
                layerInfo.loading = false;
                delete layerInfo.loadingMessage;
                layerToggle.setLayers(layers);
              }
              console.log(`[add-vector-layer] Layer ${id} tiles loaded`);
              clearInterval(checkTileLoading);
            } else if (checkCount >= maxChecks) {
              // Timeout - remove loading state anyway
              const layers = layerToggle.getLayers();
              const layerInfo = layers.find(l => l.id === id);
              if (layerInfo) {
                layerInfo.loading = false;
                delete layerInfo.loadingMessage;
                layerToggle.setLayers(layers);
              }
              clearInterval(checkTileLoading);
              console.log(`[add-vector-layer] Layer ${id} loading timeout`);
            } else if (checkCount === 2) {
              // First check - log status
              console.log('[add-vector-layer] Layer check after 1 second:', {
                layerFound: !!addedLayer,
                layerVisible: addedLayer?.props?.visible,
                layerOpacity: addedLayer?.props?.opacity,
                hasData: !!addedLayer?.props?.data,
                layerState: addedLayer?.state,
                isLoaded: addedLayer?.isLoaded,
                dataUrl: addedLayer?.props?.data?.tiles?.[0]?.substring(0, 100) + '...'
              });

              // Check if tiles are being requested
              if (addedLayer?.props?.data?.tiles) {
                console.log('[add-vector-layer] Tile URL pattern:', addedLayer.props.data.tiles[0]);
                console.log('[add-vector-layer] Check Network tab for tile requests to this URL');
              }
            }
          }
        }, 500);

        // Log the actual layer being added for debugging
        console.log('[add-vector-layer] Layer being added:', {
          id: resolvedLayer.id,
          type: resolvedLayer.constructor?.name,
          hasData: !!resolvedLayer.props?.data,
          dataType: typeof resolvedLayer.props?.data,
          visible: resolvedLayer.props?.visible
        });

        // Register the layer with semantic naming
        layerRegistry.set(layerName, id);

        // Set visibility if needed
        if (visible !== undefined) {
          layerToggle.updateLayerVisibility(id, visible);
        }

        console.log('[add-vector-layer] Successfully added layer:', id);

        // Log final layer state for debugging
        const finalLayers = deck.props.layers || [];
        console.log('[add-vector-layer] Final layers in deck:', {
          totalLayers: finalLayers.length,
          layers: finalLayers.map((layer: any) => ({
            id: layer.id,
            type: layer.constructor.name,
            visible: layer.props?.visible,
            data: layer.props?.data ? {
              type: typeof layer.props.data,
              isVectorTileSource: layer.props.data?.type === 'vector',
              connectionName: layer.props.data?.connectionName,
              tableName: layer.props.data?.tableName,
              hasAccessToken: !!layer.props.data?.accessToken,
              apiBaseUrl: layer.props.data?.apiBaseUrl
            } : 'no data',
            bounds: layer.getBounds ? layer.getBounds() : 'no bounds method',
            isLoaded: layer.isLoaded,
            state: layer.state,
            renderState: layer.renderState
          }))
        });

        // Check if the new layer is actually in the list
        const addedLayer = finalLayers.find((l: any) => l.id === id) as any;
        if (addedLayer) {
          console.log('[add-vector-layer] Added layer details:', {
            id: addedLayer.id,
            type: addedLayer.constructor?.name,
            props: addedLayer.props,
            data: addedLayer.props?.data,
            visible: addedLayer.props?.visible,
            opacity: addedLayer.props?.opacity,
            fillColor: addedLayer.props?.getFillColor,
            lineColor: addedLayer.props?.getLineColor
          });

          // Log data source details
          if (addedLayer.props?.data) {
            console.log('[add-vector-layer] Data source configuration:', addedLayer.props.data);
          }

          // If this is Empire State data, suggest zooming to that area
          if (tableName.toLowerCase().includes('empire') || tableName.toLowerCase().includes('state')) {
            console.log('[add-vector-layer] TIP: This appears to be Empire State Building data.');
            console.log('[add-vector-layer] The data is likely centered around: longitude: -73.9857, latitude: 40.7484');
            console.log('[add-vector-layer] Try zooming to Manhattan to see the data.');
          }

          // Try to zoom to layer bounds if available
          // Note: VectorTileLayer might not have bounds immediately
          // The data needs to load first
          setTimeout(() => {
            try {
              if (addedLayer.getBounds) {
                const bounds = addedLayer.getBounds();
                console.log('[add-vector-layer] Layer bounds:', bounds);
                if (bounds && bounds.length === 4) {
                  // Calculate center and zoom from bounds
                  const [minLng, minLat, maxLng, maxLat] = bounds;
                  const centerLng = (minLng + maxLng) / 2;
                  const centerLat = (minLat + maxLat) / 2;

                  console.log('[add-vector-layer] Would zoom to:', {
                    longitude: centerLng,
                    latitude: centerLat
                  });
                  // Uncomment to auto-zoom to layer:
                  // deck.setProps({
                  //   initialViewState: {
                  //     longitude: centerLng,
                  //     latitude: centerLat,
                  //     zoom: 12,
                  //     transitionDuration: 1000
                  //   }
                  // });
                }
              }
            } catch (e) {
              console.log('[add-vector-layer] Could not get layer bounds:', e);
            }
          }, 2000); // Wait 2 seconds for layer to load

        } else {
          console.error('[add-vector-layer] WARNING: Layer was not found in deck after adding!');
        }

        return {
          success: true,
          message: `Added vector layer: ${id} from ${tableName}`,
          data: { layerId: id }
        };
      } catch (error) {
        console.error('[add-vector-layer] Error:', error);

        // Provide helpful error message
        let helpfulMessage = `Failed to add vector layer: ${error instanceof Error ? error.message : 'Unknown error'}`;

        if (error instanceof Error && error.message.includes('Invalid URL')) {
          helpfulMessage += '. Check that VITE_API_BASE_URL and VITE_API_ACCESS_TOKEN are set in .env file';
        }

        console.error('[add-vector-layer] Troubleshooting tips:', {
          '1. Check .env file': 'Ensure VITE_API_BASE_URL and VITE_API_ACCESS_TOKEN are set',
          '2. Check connection': `Current connection: ${connectionName}`,
          '3. Check table name': `Table: ${tableName}`,
          '4. Verify credentials': 'Ensure access token has permissions for the table',
          '5. Example .env': 'See .env.example for required variables'
        });

        return {
          success: false,
          message: helpfulMessage,
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
  const { toolStatus, chatContainer, sendToolResult } = context;

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

  // Extract call ID for result tracking
  const callId = message.callId || `call_${Date.now()}`;

  console.log('[ToolExecutor] Extracted:', { rawToolName, rawData, callId });

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
    // Send failure result back to server
    if (sendToolResult) {
      sendToolResult({
        toolName: toolName || 'unknown',
        callId,
        success: false,
        message: error.message,
        error: error.message
      });
    }
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
      const resultOrPromise = executor(data);

      // Handle both sync and async executors - RETURN the promise so caller can wait
      return Promise.resolve(resultOrPromise).then(result => {
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

        // Send result back to server
        if (sendToolResult) {
          sendToolResult({
            toolName,
            callId,
            success: result.success,
            message: result.message,
            error: result.success ? undefined : result.message
          });
        }
      }).catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ToolExecutor] Execution error:', errorMessage, err);
        toolStatus.setError(errorMessage);
        chatContainer.addToolCall({
          toolName,
          status: 'error',
          message: errorMessage
        });

        // Send failure result back to server
        if (sendToolResult) {
          sendToolResult({
            toolName,
            callId,
            success: false,
            message: errorMessage,
            error: errorMessage
          });
        }
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

      // Send failure result back to server
      if (sendToolResult) {
        sendToolResult({
          toolName,
          callId,
          success: false,
          message: errorMessage,
          error: errorMessage
        });
      }
    }
  } else if (!executor) {
    console.warn(`[ToolExecutor] ⚠️ NO EXECUTOR FOUND for tool: "${toolName}"`);
    console.warn(`[ToolExecutor] Available executors:`, Object.keys(executors));
    console.warn(`[ToolExecutor] Tool data received:`, data);
    // Check if it's the add-layer tool with a different name
    if (toolName === 'add_layer' || toolName === 'addLayer') {
      const addLayerExecutor = executors['add-layer'];
      if (addLayerExecutor && data) {
        try {
          const resultOrPromise = addLayerExecutor(data);
          // RETURN the promise so caller can wait
          return Promise.resolve(resultOrPromise).then(result => {
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

            // Send result back to server
            if (sendToolResult) {
              sendToolResult({
                toolName,
                callId,
                success: result.success,
                message: result.message,
                error: result.success ? undefined : result.message
              });
            }
          }).catch(err => {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            toolStatus.setError(errorMessage);
            chatContainer.addToolCall({
              toolName,
              status: 'error',
              message: errorMessage
            });

            // Send failure result back to server
            if (sendToolResult) {
              sendToolResult({
                toolName,
                callId,
                success: false,
                message: errorMessage,
                error: errorMessage
              });
            }
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

          // Send failure result back to server
          if (sendToolResult) {
            sendToolResult({
              toolName,
              callId,
              success: false,
              message: errorMessage,
              error: errorMessage
            });
          }
        }
      }
    } else {
      console.error(`[ToolExecutor] ❌ UNHANDLED TOOL: "${toolName}" - No executor and no fallback available`);
      console.error(`[ToolExecutor] This tool needs to be implemented in createToolExecutors()`);
      toolStatus.showSuccess(`Tool ${toolName} executed on backend`);
    }
  } else if (!data) {
    console.warn(`[ToolExecutor] No data for tool: ${toolName}`);
    toolStatus.setError('No parameters provided for tool');
  }
}