import { Injectable } from '@angular/core';
import { Deck } from '@deck.gl/core';
import { TOOL_NAMES, parseToolResponse } from '@carto/maps-ai-tools';
import { MapToolsStateService, SizeRule } from './map-tools-state.service';
import maplibregl from 'maplibre-gl';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

type ToolExecutor = (params: any) => ToolResult;

@Injectable({
  providedIn: 'root'
})
export class MapToolsService {
  private deck: Deck | null = null;
  private map: maplibregl.Map | null = null;
  private executors: Record<string, ToolExecutor> = {};

  constructor(private stateService: MapToolsStateService) {}

  initialize(deck: Deck, map: maplibregl.Map): void {
    this.deck = deck;
    this.map = map;
    this.executors = this.createExecutors();
  }

  private createExecutors(): Record<string, ToolExecutor> {
    const deck = this.deck!;
    const map = this.map!;
    const stateService = this.stateService;

    return {
      [TOOL_NAMES.FLY_TO]: (params: { lat: number; lng: number; zoom?: number }): ToolResult => {
        const currentView = deck.props.initialViewState || {};
        deck.setProps({
          initialViewState: {
            ...currentView,
            longitude: params.lng,
            latitude: params.lat,
            zoom: params.zoom || 12,
            transitionDuration: 1000,
            transitionInterruption: 1
          }
        });

        // Sync MapLibre
        if (map) {
          map.flyTo({
            center: [params.lng, params.lat],
            zoom: params.zoom || 12,
            duration: 1000
          });
        }

        // Force redraws
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);
        setTimeout(() => deck.redraw(), 1100);

        return { success: true, message: `Flying to ${params.lat.toFixed(2)}, ${params.lng.toFixed(2)}` };
      },

      [TOOL_NAMES.ZOOM_MAP]: (params: { direction: 'in' | 'out'; levels?: number }): ToolResult => {
        const currentView = (deck.props.initialViewState as any) || { zoom: 10 };
        const currentZoom = currentView.zoom || 10;
        const levels = params.levels || 1;
        const newZoom = params.direction === 'in'
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

        // Sync MapLibre
        if (map) {
          map.jumpTo({
            center: [currentView.longitude, currentView.latitude],
            zoom: newZoom,
            bearing: currentView.bearing || 0,
            pitch: currentView.pitch || 0
          });
        }

        // Force redraws
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);
        setTimeout(() => deck.redraw(), 600);

        return { success: true, message: `Zoomed ${params.direction} to level ${newZoom.toFixed(1)}` };
      },

      [TOOL_NAMES.TOGGLE_LAYER]: (params: { layerName: string; visible: boolean }): ToolResult => {
        const currentLayers = deck.props.layers || [];

        // Find layer by name (case-insensitive)
        const layerNameMap: Record<string, string> = {
          'airports': 'points-layer',
          'points': 'points-layer',
          'points-layer': 'points-layer'
        };

        const normalizedName = params.layerName.toLowerCase();
        const layerId = layerNameMap[normalizedName] || normalizedName;

        const layerFound = (currentLayers as any[]).some(layer => layer && layer.id === layerId);
        if (!layerFound) {
          return { success: false, message: `Layer "${params.layerName}" not found` };
        }

        const updatedLayers = (currentLayers as any[]).map(layer => {
          if (layer && layer.id === layerId) {
            return layer.clone({ visible: params.visible });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw());

        return { success: true, message: `Layer "${params.layerName}" ${params.visible ? 'shown' : 'hidden'}` };
      },

      [TOOL_NAMES.SET_POINT_COLOR]: (params: { r: number; g: number; b: number; a?: number }): ToolResult => {
        const rgba = [params.r, params.g, params.b, params.a ?? 200];
        const currentLayers = deck.props.layers || [];

        const updatedLayers = (currentLayers as any[]).map(layer => {
          if (layer && layer.id === 'points-layer') {
            return layer.clone({ getFillColor: rgba });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);

        return { success: true, message: `Point color changed to rgb(${params.r}, ${params.g}, ${params.b})` };
      },

      [TOOL_NAMES.COLOR_FEATURES_BY_PROPERTY]: (params: {
        layerId?: string;
        property: string;
        operator?: string;
        value: string;
        r: number;
        g: number;
        b: number;
        a?: number;
      }): ToolResult => {
        const { layerId = 'points-layer', property, operator = 'equals', value } = params;
        const filterColor = [params.r, params.g, params.b, params.a ?? 180];
        const defaultColor = [200, 0, 80, 180];
        const currentLayers = deck.props.layers || [];

        // Add filter using state service (merges with existing filters)
        const filterKey = `${property}:${operator}:${value}`;
        const newFilter = { key: filterKey, property, operator: operator as any, value, color: filterColor };
        const filters = stateService.addColorFilter(layerId, newFilter);

        // Use state service's color accessor
        const colorAccessor = stateService.createColorAccessor(layerId, defaultColor);

        const updatedLayers = (currentLayers as any[]).map(layer => {
          if (layer && layer.id === layerId) {
            return layer.clone({
              getFillColor: colorAccessor,
              updateTriggers: { getFillColor: JSON.stringify(filters) }
            });
          }
          return layer;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);

        return {
          success: true,
          message: `Colored features where ${property} ${operator} "${value}"`
        };
      },

      [TOOL_NAMES.QUERY_FEATURES]: (params: {
        layerId?: string;
        property: string;
        operator?: string;
        value?: string;
        includeNames?: boolean;
      }): ToolResult => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', includeNames = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = (currentLayers as any[]).find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Get GeoJSON data from layer
        const data = layer.props.data;
        if (!data || !data.features) {
          return { success: false, message: 'No feature data available' };
        }

        // Property matcher function
        const matchesFilter = (feature: any): boolean => {
          if (operator === 'all') return true;
          const propValue = String(feature.properties[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        // Filter and count features
        const matchingFeatures = data.features.filter(matchesFilter);
        const count = matchingFeatures.length;
        const total = data.features.length;

        // Build response message
        let message = '';
        if (operator === 'all') {
          message = `Total features: ${count}`;
        } else {
          message = `Found ${count} features where ${property} ${operator} "${value}" (out of ${total} total)`;
        }

        // Include sample names if requested
        let sampleNames: string[] = [];
        if (includeNames && matchingFeatures.length > 0) {
          sampleNames = matchingFeatures
            .slice(0, 10)
            .map((f: any) => f.properties.name || f.properties.abbrev || 'Unknown')
            .filter(Boolean);
        }

        return {
          success: true,
          message,
          data: {
            count,
            total,
            sampleNames: sampleNames.length > 0 ? sampleNames : undefined
          }
        };
      },

      [TOOL_NAMES.FILTER_FEATURES_BY_PROPERTY]: (params: {
        layerId?: string;
        property?: string;
        operator?: string;
        value?: string;
        reset?: boolean;
      }): ToolResult => {
        const { layerId = 'points-layer', property, operator = 'equals', value = '', reset = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = (currentLayers as any[]).find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Get or store original data using state service
        const originalData = stateService.getOrSetOriginalData(layerId, layer.props.data);

        if (!originalData || !originalData.features) {
          return { success: false, message: 'No feature data available' };
        }

        // If reset=true, show all features (no property required)
        if (reset) {
          const updatedLayers = (currentLayers as any[]).map(l => {
            if (l && l.id === layerId) {
              return l.clone({
                data: originalData,
                updateTriggers: { data: 'reset' }
              });
            }
            return l;
          });
          deck.setProps({ layers: updatedLayers });
          requestAnimationFrame(() => deck.redraw());
          return { success: true, message: `Filter cleared - showing all ${originalData.features.length} features` };
        }

        // For filtering, property and value are required
        if (!property) {
          return { success: false, message: 'Property is required for filtering. Use reset=true to clear filters.' };
        }

        // Property matcher function
        const matchesFilter = (feature: any): boolean => {
          const propValue = String(feature.properties[property] || '');
          switch (operator) {
            case 'equals': return propValue === value;
            case 'startsWith': return propValue.startsWith(value);
            case 'contains': return propValue.includes(value);
            case 'regex': return new RegExp(value).test(propValue);
            default: return false;
          }
        };

        // Filter features from ORIGINAL data (not current filtered data)
        const filteredFeatures = originalData.features.filter(matchesFilter);
        const filteredData = {
          ...originalData,
          features: filteredFeatures
        };

        // Update layer with filtered data
        const updatedLayers = (currentLayers as any[]).map(l => {
          if (l && l.id === layerId) {
            return l.clone({
              data: filteredData,
              updateTriggers: { data: `${property}:${operator}:${value}` }
            });
          }
          return l;
        });

        deck.setProps({ layers: updatedLayers });
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);

        return {
          success: true,
          message: `Filtered to ${filteredFeatures.length} features where ${property} ${operator} "${value}"`
        };
      },

      [TOOL_NAMES.SIZE_FEATURES_BY_PROPERTY]: (params: {
        layerId?: string;
        property?: string;
        sizeRules?: SizeRule[];
        defaultSize?: number;
        reset?: boolean;
      }): ToolResult => {
        const { layerId = 'points-layer', property, sizeRules = [], defaultSize = 8, reset = false } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = (currentLayers as any[]).find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // If reset, use uniform size and clear stored rules
        if (reset) {
          stateService.clearSizeRules(layerId);
          const updatedLayers = (currentLayers as any[]).map(l => {
            if (l && l.id === layerId) {
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
          requestAnimationFrame(() => deck.redraw());
          return { success: true, message: `Size reset to uniform ${defaultSize}px` };
        }

        if (!property || sizeRules.length === 0) {
          return { success: false, message: 'Property and sizeRules are required. Use reset=true to clear size rules.' };
        }

        // Merge new size rules with existing using state service
        stateService.mergeSizeRules(layerId, property, sizeRules, defaultSize);

        // Create size accessor using state service
        const sizeAccessor = stateService.createSizeAccessor(layerId, property);

        // Get all rules for update trigger and message
        const allRules = stateService.getSizeRulesArray(layerId);

        // Update layer with dynamic size in PIXELS
        const updatedLayers = (currentLayers as any[]).map(l => {
          if (l && l.id === layerId) {
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
        requestAnimationFrame(() => deck.redraw());
        setTimeout(() => deck.redraw(), 50);

        const rulesDescription = allRules.map(r => `${r.value}=${r.size}px`).join(', ');
        return {
          success: true,
          message: `Size rules merged: ${rulesDescription} (default: ${defaultSize}px)`
        };
      },

      [TOOL_NAMES.AGGREGATE_FEATURES]: (params: { layerId?: string; groupBy: string }): ToolResult => {
        const { layerId = 'points-layer', groupBy } = params;
        const currentLayers = deck.props.layers || [];

        // Find the layer
        const layer = (currentLayers as any[]).find(l => l && l.id === layerId);
        if (!layer) {
          return { success: false, message: `Layer "${layerId}" not found` };
        }

        // Get GeoJSON data - use original if available, otherwise current
        let data = stateService.getOriginalData(layerId) || layer.props.data;
        if (!data || !data.features) {
          return { success: false, message: 'No feature data available' };
        }

        if (!groupBy) {
          return { success: false, message: 'groupBy property is required' };
        }

        // Aggregate counts by property value
        const counts = new Map<string, number>();
        data.features.forEach((feature: any) => {
          const value = String(feature.properties[groupBy] || 'unknown');
          counts.set(value, (counts.get(value) || 0) + 1);
        });

        // Convert to sorted array (by count descending)
        const results = Array.from(counts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        // Build table string for display
        const tableRows = results.map(r => `${r.value}: ${r.count}`).join('\n');
        const total = data.features.length;

        return {
          success: true,
          message: `Aggregation by "${groupBy}" (${total} total features):\n${tableRows}`,
          data: {
            groupBy,
            total,
            groups: results
          }
        };
      }
    };
  }

  async execute(tool: string, parameters: any): Promise<ToolResult> {
    if (!this.deck || !this.map) {
      return { success: false, message: 'Map tools not initialized' };
    }

    const executor = this.executors[tool];
    if (!executor) {
      console.warn(`Unknown tool: ${tool}`);
      return { success: false, message: `Unknown tool: ${tool}` };
    }

    console.log(`Executing tool: ${tool}`, parameters);
    return executor(parameters);
  }

  isInitialized(): boolean {
    return this.deck !== null && this.map !== null;
  }

  /**
   * Parse a tool response from the server
   */
  parseResponse(response: any): { toolName: string; data: any; error: any } {
    return parseToolResponse(response);
  }
}
