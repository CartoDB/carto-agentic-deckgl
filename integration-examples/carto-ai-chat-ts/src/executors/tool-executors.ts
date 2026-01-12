import { Deck, Layer } from '@deck.gl/core';
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';
import { VectorTileLayer } from '@deck.gl/carto';
import { vectorTableSource } from '@carto/api-client';
import { scheduleRedraws } from '../map/deckgl-map';
import type { ZoomControls } from '../ui/ZoomControls';
import type { LayerToggle } from '../ui/LayerToggle';
import type { ToolStatus } from '../ui/ToolStatus';
import type { ChatContainer } from '../ui/ChatContainer';
import type { ToolCallMessage } from '../chat/types';

// Layer with clone method
interface CloneableLayer extends Layer {
  clone(props: Record<string, unknown>): Layer;
}

export interface ToolResult {
  success: boolean;
  message: string;
}

export type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

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
let basePointColor: [number, number, number, number] = [3, 111, 226, 200];

// Color name to RGBA mapping
const COLOR_MAP: Record<string, [number, number, number, number]> = {
  red: [255, 0, 0, 200],
  green: [0, 255, 0, 200],
  blue: [0, 0, 255, 200],
  yellow: [255, 255, 0, 200],
  orange: [255, 165, 0, 200],
  purple: [128, 0, 128, 200],
  pink: [255, 192, 203, 200],
  cyan: [0, 255, 255, 200],
  white: [255, 255, 255, 200],
  black: [0, 0, 0, 200],
  gray: [128, 128, 128, 200],
  grey: [128, 128, 128, 200]
};

/**
 * Convert color value (name or RGBA array) to RGBA array
 */
function parseColor(color: unknown): [number, number, number, number] | null {
  if (Array.isArray(color) && color.length >= 3) {
    return [color[0], color[1], color[2], color[3] ?? 200];
  }
  if (typeof color === 'string') {
    const normalized = color.toLowerCase().trim();
    if (COLOR_MAP[normalized]) {
      return COLOR_MAP[normalized];
    }
  }
  return null;
}

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

      deck.setProps({
        initialViewState: {
          ...currentView,
          longitude: lng,
          latitude: lat,
          zoom: newZoom,
          pitch: pitch ?? (currentView.pitch as number) ?? 0,
          bearing: bearing ?? (currentView.bearing as number) ?? 0,
          transitionDuration: transitionDuration ?? 1000,
          transitionInterruption: 1 // Enable smooth transitions
        }
      });

      // Force redraws for deck.gl
      requestAnimationFrame(() => deck.redraw('all'));
      setTimeout(() => deck.redraw('all'), 50);
      setTimeout(() => deck.redraw('all'), 1100);

      zoomControls.setZoomLevel(newZoom);

      return { success: true, message: `Flying to ${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    },

    [TOOL_NAMES.ZOOM_MAP]: (params) => {
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
    },

    [TOOL_NAMES.SET_VIEW_STATE]: (params) => {
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
    },

    [TOOL_NAMES.ROTATE_MAP]: (params) => {
      const { bearing, relative, transitionDuration } = params as {
        bearing: number;
        relative?: boolean;
        transitionDuration?: number;
      };

      const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};
      const currentBearing = (currentView.bearing as number) || 0;
      const newBearing = relative ? currentBearing + bearing : bearing;

      deck.setProps({
        initialViewState: {
          longitude: (currentView.longitude as number) || -110.5556199,
          latitude: (currentView.latitude as number) || 41.8097343,
          zoom: (currentView.zoom as number) || 3,
          pitch: currentView.pitch as number,
          bearing: newBearing,
          transitionDuration: transitionDuration ?? 500
        }
      });

      scheduleRedraws(deck);

      return { success: true, message: `Rotated to bearing ${newBearing.toFixed(0)}` };
    },

    [TOOL_NAMES.SET_PITCH]: (params) => {
      const { pitch, transitionDuration } = params as {
        pitch: number;
        transitionDuration?: number;
      };

      const currentView = (deck.props.initialViewState as Record<string, unknown>) || {};

      deck.setProps({
        initialViewState: {
          longitude: (currentView.longitude as number) || -110.5556199,
          latitude: (currentView.latitude as number) || 41.8097343,
          zoom: (currentView.zoom as number) || 3,
          pitch: Math.min(85, Math.max(0, pitch)),
          bearing: currentView.bearing as number,
          transitionDuration: transitionDuration ?? 500
        }
      });

      scheduleRedraws(deck);

      return { success: true, message: `Pitch set to ${pitch}` };
    },

    // ==================== LAYER VISIBILITY TOOLS ====================

    [TOOL_NAMES.TOGGLE_LAYER]: (params) => {
      const { layerName, visible } = params as {
        layerName: string;
        visible: boolean;
      };

      const layerId = findLayerIdByName(layerName, layerRegistry) || layerName;
      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      const updatedLayers = currentLayers.map((layer) => {
        if (layer.id === layerId) {
          return layer.clone({ visible });
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
    },

    [TOOL_NAMES.SHOW_HIDE_LAYER]: (params) => {
      const { layerId, visible } = params as {
        layerId: string;
        visible: boolean;
      };

      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      const updatedLayers = currentLayers.map((layer) => {
        if (layer.id === layerId) {
          return layer.clone({ visible });
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
    },

    // ==================== STYLING TOOLS ====================

    [TOOL_NAMES.SET_POINT_COLOR]: (params) => {
      const { layerId, r, g, b, a } = params as {
        layerId?: string;
        r: number;
        g: number;
        b: number;
        a?: number;
      };

      const rgba: [number, number, number, number] = [r, g, b, a ?? 200];
      basePointColor = rgba;

      const targetLayerId = layerId || 'pois';
      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      const updatedLayers = currentLayers.map((layer) => {
        if (layer.id === targetLayerId) {
          return layer.clone({ getFillColor: rgba });
        }
        return layer;
      });

      deck.setProps({ layers: updatedLayers as Layer[] });
      scheduleRedraws(deck);

      return {
        success: true,
        message: `Color changed to rgb(${r}, ${g}, ${b})`
      };
    },

    [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params) => {
      const { layerId, property, operator, value, r, g, b, a } = params as {
        layerId?: string;
        property: string;
        operator: string;
        value: unknown;
        r: number;
        g: number;
        b: number;
        a?: number;
      };

      const rgba: [number, number, number, number] = [r, g, b, a ?? 180];
      const filterKey = `${property}:${operator}:${value}`;
      const newFilter: ColorFilter = {
        key: filterKey,
        property,
        operator,
        value,
        color: rgba
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
    },

    [TOOL_NAMES.RESET_VISUALIZATION]: (params) => {
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
          return layer.clone({
            getFillColor: basePointColor,
            visible: true,
            updateTriggers: { getFillColor: 'reset' }
          });
        });
        deck.setProps({ layers: updatedLayers as Layer[] });
      }

      if (resetViewState !== false) {
        deck.setProps({
          initialViewState: {
            latitude: 41.8097343,
            longitude: -110.5556199,
            zoom: 3,
            bearing: 0,
            pitch: 0,
            transitionDuration: 1000
          }
        });
        zoomControls.setZoomLevel(3);
      }

      scheduleRedraws(deck);

      return { success: true, message: 'Visualization reset' };
    },

    // ==================== UPDATE LAYER STYLE ====================

    [TOOL_NAMES.UPDATE_LAYER_STYLE]: (params) => {
      const {
        layerId,
        fillColor,
        lineColor,
        opacity,
        visible
      } = params as {
        layerId: string;
        fillColor?: string | number[];
        lineColor?: string | number[];
        opacity?: number;
        visible?: boolean;
      };

      const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;
      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      // Build the update props - only include what was provided
      const updateProps: Record<string, unknown> = {};
      const changes: string[] = [];

      if (fillColor !== undefined && fillColor !== null) {
        const rgba = parseColor(fillColor);
        if (rgba) {
          updateProps.getFillColor = rgba;
          basePointColor = rgba; // Update base color for consistency
          changes.push(`fill: ${typeof fillColor === 'string' ? fillColor : 'custom'}`);
        }
      }

      if (lineColor !== undefined && lineColor !== null) {
        const rgba = parseColor(lineColor);
        if (rgba) {
          updateProps.getLineColor = rgba;
          changes.push(`line: ${typeof lineColor === 'string' ? lineColor : 'custom'}`);
        }
      }

      if (opacity !== undefined) {
        updateProps.opacity = opacity;
        changes.push(`opacity: ${opacity}`);
      }

      if (visible !== undefined) {
        updateProps.visible = visible;
        changes.push(`visible: ${visible}`);
        layerToggle.updateLayerVisibility(targetLayerId, visible);
      }

      if (Object.keys(updateProps).length === 0) {
        return { success: false, message: 'No valid style properties provided' };
      }

      // Add update triggers for color changes
      if (updateProps.getFillColor || updateProps.getLineColor) {
        updateProps.updateTriggers = {
          getFillColor: JSON.stringify(updateProps.getFillColor),
          getLineColor: JSON.stringify(updateProps.getLineColor)
        };
      }

      const updatedLayers = currentLayers.map((layer) => {
        if (layer.id === targetLayerId) {
          return layer.clone(updateProps);
        }
        return layer;
      });

      deck.setProps({ layers: updatedLayers as Layer[] });
      scheduleRedraws(deck);

      return {
        success: true,
        message: `Layer "${layerId}" updated: ${changes.join(', ')}`
      };
    },

    // ==================== FILTER FEATURES ====================

    [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params) => {
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
    },

    // ==================== SIZE FEATURES ====================

    [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params) => {
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
        const updatedLayers = currentLayers.map((layer) => {
          if (layer.id === targetLayerId) {
            return layer.clone({
              getPointRadius: baseSize,
              pointRadiusMinPixels: 1,
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
    },

    // ==================== REMOVE LAYER ====================

    [TOOL_NAMES.REMOVE_LAYER]: (params) => {
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
    },

    // ==================== ADD VECTOR LAYER ====================

    [TOOL_NAMES.ADD_VECTOR_LAYER]: async (params) => {
      const {
        id,
        connectionName = 'carto_dw',
        tableName,
        accessToken,
        apiBaseUrl = 'https://gcp-us-east1.api.carto.com',
        columns,
        spatialDataColumn,
        visible = true,
        opacity = 1,
        fillColor,
        lineColor,
        pointRadiusMinPixels = 2,
        lineWidthMinPixels = 0.3,
        pickable = true,
      } = params as {
        id: string;
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
        lineWidthMinPixels?: number;
        pickable?: boolean;
      };

      console.log('[ToolExecutor] ADD_VECTOR_LAYER called with params:', params);

      try {
        // Build vectorTableSource configuration
        const sourceConfig: {
          connectionName: string;
          tableName: string;
          accessToken: string;
          apiBaseUrl: string;
          columns?: string[];
          spatialDataColumn?: string;
        } = {
          connectionName,
          tableName,
          accessToken: accessToken || import.meta.env.VITE_API_ACCESS_TOKEN || '',
          apiBaseUrl: apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'https://gcp-us-east1.api.carto.com',
        };

        // Handle columns - if empty/not specified but spatialDataColumn is provided, include it
        let finalColumns = columns;
        if ((!finalColumns || finalColumns.length === 0) && spatialDataColumn) {
          finalColumns = [spatialDataColumn];
        }
        if (finalColumns && finalColumns.length > 0) {
          sourceConfig.columns = finalColumns;
        }

        if (spatialDataColumn) {
          sourceConfig.spatialDataColumn = spatialDataColumn;
        }

        console.log('[ToolExecutor] Creating vectorTableSource with config:', sourceConfig);

        // Create the data source
        const dataSource = await vectorTableSource(sourceConfig);

        console.log('[ToolExecutor] Data source created:', dataSource);

        // Parse colors
        const parsedFillColor = fillColor ? parseColor(fillColor) : [0, 0, 255, 180];
        const parsedLineColor = lineColor ? parseColor(lineColor) : [255, 255, 255, 255];

        // Create the VectorTileLayer
        const newLayer = new VectorTileLayer({
          id,
          data: dataSource,
          visible,
          opacity,
          pickable,
          getFillColor: (parsedFillColor || [0, 0, 255, 180]) as [number, number, number, number],
          getLineColor: (parsedLineColor || [255, 255, 255, 255]) as [number, number, number, number],
          pointRadiusMinPixels,
          lineWidthMinPixels,
          getPointRadius: 50,
          getLineWidth: 10,
        });

        console.log('[ToolExecutor] Layer created:', newLayer);

        // Add layer to deck
        const currentLayers = (deck.props.layers || []) as Layer[];
        deck.setProps({ layers: [...currentLayers, newLayer] });

        // Register the layer
        layerRegistry.set(id, id);

        // Update layer toggle UI
        layerToggle.setLayers([
          ...layerToggle.getLayers(),
          {
            id,
            name: id,
            visible,
            color: Array.isArray(parsedFillColor)
              ? `rgb(${parsedFillColor[0]}, ${parsedFillColor[1]}, ${parsedFillColor[2]})`
              : '#0000ff'
          }
        ]);

        // Force redraws to ensure layer is visible
        scheduleRedraws(deck);

        console.log('[ToolExecutor] Layer added successfully, scheduled redraws');

        return {
          success: true,
          message: `Added vector layer "${id}" from table "${tableName}"`,
        };
      } catch (error) {
        console.error('[ToolExecutor] Error adding vector layer:', error);
        return {
          success: false,
          message: `Failed to add layer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },

    // ==================== UPDATE LAYER PROPS ====================

    [TOOL_NAMES.UPDATE_LAYER_PROPS]: (params) => {
      const { layerId, props } = params as {
        layerId: string;
        props: Record<string, unknown>;
      };

      const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;
      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      let found = false;
      const updatedLayers = currentLayers.map((layer) => {
        if (layer.id === targetLayerId) {
          found = true;
          return layer.clone(props);
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
    },

    // ==================== QUERY TOOLS (return info to LLM) ====================

    [TOOL_NAMES.GET_LAYER_CONFIG]: (params) => {
      const { layerId } = params as { layerId?: string };

      const currentLayers = (deck.props.layers || []) as CloneableLayer[];

      if (layerId) {
        const targetLayerId = findLayerIdByName(layerId, layerRegistry) || layerId;
        const layer = currentLayers.find((l) => l.id === targetLayerId);
        if (layer) {
          return {
            success: true,
            message: `Layer "${layerId}": visible=${layer.props.visible}, opacity=${layer.props.opacity}`
          };
        }
        return { success: false, message: `Layer "${layerId}" not found` };
      }

      // Return all layers info
      const layerInfo = currentLayers.map((l) => `${l.id} (visible: ${l.props.visible})`);
      return {
        success: true,
        message: `Available layers: ${layerInfo.join(', ')}`
      };
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
      const result = await executor(data);
      console.log('[ToolExecutor] Execution result:', result);
      toolStatus.showSuccess(result.message);
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
    toolStatus.showSuccess(`Tool ${toolName} executed on backend`);
  } else if (!data) {
    console.warn(`[ToolExecutor] No data for tool: ${toolName}`);
  }
}
