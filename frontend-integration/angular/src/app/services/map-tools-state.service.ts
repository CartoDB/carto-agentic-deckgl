import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LayerConfig, ActiveFilter } from '../models/message.model';

// Default constants matching React
const DEFAULT_LAYER_COLOR: number[] = [200, 0, 80, 180];
const DEFAULT_POINT_SIZE = 8;

/**
 * Color filter for feature styling
 */
export interface ColorFilter {
  key: string;
  property: string;
  operator: 'equals' | 'startsWith' | 'contains' | 'regex';
  value: string;
  color: number[];
}

/**
 * Size rule for feature sizing
 */
export interface SizeRule {
  value: string;
  size: number;
}

/**
 * Service for managing persistent map tool state
 * Angular equivalent of React's MapToolsContext
 * Stores layer registry, color filters, size rules, active filters, and original layer data
 */
@Injectable({
  providedIn: 'root',
})
export class MapToolsStateService {
  // ============================================================================
  // Layer Registry (matching React's useLayerRegistry)
  // ============================================================================
  private layerRegistry = new Map<string, LayerConfig>();
  private layerVisibility = new Map<string, boolean>();
  private layerBaseColor = new Map<string, number[]>();

  // Observable for layer state changes (for LayerToggle component)
  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);
  public layers$: Observable<LayerConfig[]> = this.layersSubject.asObservable();

  // ============================================================================
  // Active Filters (matching React's useDataFilters)
  // ============================================================================
  private activeFilters = new Map<string, ActiveFilter | null>();

  // ============================================================================
  // Existing State Maps
  // ============================================================================
  private colorFiltersMap = new Map<string, ColorFilter[]>();
  private originalLayerDataMap = new Map<string, GeoJSON.FeatureCollection>();
  private sizeRulesMap = new Map<string, Map<string, number>>();
  private defaultSizesMap = new Map<string, number>();

  // ============================================================================
  // Layer Registry Methods
  // ============================================================================

  registerLayer(config: {
    id: string;
    name: string;
    color?: string;
    visible?: boolean;
  }): void {
    if (!this.layerRegistry.has(config.id)) {
      const layerConfig: LayerConfig = {
        id: config.id,
        name: config.name,
        color: config.color || '#c80050',
        visible: config.visible ?? true,
      };
      this.layerRegistry.set(config.id, layerConfig);
      this.layerVisibility.set(config.id, config.visible ?? true);
      this.layerBaseColor.set(config.id, this.hexToRgba(config.color) || DEFAULT_LAYER_COLOR);
      this.emitLayersUpdate();
    }
  }

  getLayers(): LayerConfig[] {
    const layers: LayerConfig[] = [];
    this.layerRegistry.forEach((config, layerId) => {
      layers.push({
        ...config,
        visible: this.layerVisibility.get(layerId) ?? true,
        color: this.rgbaToHex(this.layerBaseColor.get(layerId) || []) || config.color,
      });
    });
    return layers;
  }

  getLayerVisibility(layerId: string): boolean {
    return this.layerVisibility.get(layerId) ?? true;
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.layerVisibility.set(layerId, visible);
    this.emitLayersUpdate();
  }

  getLayerBaseColor(layerId: string): number[] {
    return this.layerBaseColor.get(layerId) ?? DEFAULT_LAYER_COLOR;
  }

  setLayerBaseColor(layerId: string, rgba: number[]): void {
    this.layerBaseColor.set(layerId, rgba);
    this.emitLayersUpdate();
  }

  resetLayerToDefault(layerId: string): void {
    const config = this.layerRegistry.get(layerId);
    if (config) {
      this.layerVisibility.set(layerId, true);
      this.layerBaseColor.set(layerId, this.hexToRgba(config.color) || DEFAULT_LAYER_COLOR);
      this.emitLayersUpdate();
    }
  }

  resetAllLayersToDefault(): void {
    this.layerRegistry.forEach((config, layerId) => {
      this.layerVisibility.set(layerId, true);
      this.layerBaseColor.set(layerId, this.hexToRgba(config.color) || DEFAULT_LAYER_COLOR);
    });
    this.emitLayersUpdate();
  }

  // ============================================================================
  // Active Filters Management
  // ============================================================================

  getActiveFilter(layerId: string): ActiveFilter | null {
    return this.activeFilters.get(layerId) ?? null;
  }

  setActiveFilter(layerId: string, filter: ActiveFilter): void {
    this.activeFilters.set(layerId, filter);
  }

  clearActiveFilter(layerId: string): void {
    this.activeFilters.delete(layerId);
  }

  clearAllActiveFilters(): void {
    this.activeFilters.clear();
  }

  // ============================================================================
  // Color Filters Management
  // ============================================================================

  getColorFilters(layerId: string): ColorFilter[] {
    if (!this.colorFiltersMap.has(layerId)) {
      this.colorFiltersMap.set(layerId, []);
    }
    return this.colorFiltersMap.get(layerId)!;
  }

  addColorFilter(layerId: string, filter: ColorFilter): ColorFilter[] {
    const filters = this.getColorFilters(layerId);
    const existingIdx = filters.findIndex((f) => f.key === filter.key);

    if (existingIdx >= 0) {
      filters[existingIdx] = filter;
    } else {
      filters.push(filter);
    }

    return [...filters]; // Return copy for update triggers
  }

  clearColorFilters(layerId: string): void {
    this.colorFiltersMap.set(layerId, []);
  }

  clearAllColorFilters(): void {
    this.colorFiltersMap.clear();
  }

  // ============================================================================
  // Original Layer Data Management
  // ============================================================================

  getOriginalData(layerId: string): GeoJSON.FeatureCollection | undefined {
    return this.originalLayerDataMap.get(layerId);
  }

  setOriginalData(layerId: string, data: GeoJSON.FeatureCollection): void {
    if (!this.originalLayerDataMap.has(layerId) && data?.features) {
      this.originalLayerDataMap.set(layerId, data);
    }
  }

  getOrSetOriginalData(
    layerId: string,
    currentData: GeoJSON.FeatureCollection
  ): GeoJSON.FeatureCollection {
    let originalData = this.originalLayerDataMap.get(layerId);
    if (!originalData && currentData?.features) {
      originalData = currentData;
      this.originalLayerDataMap.set(layerId, originalData);
    }
    return originalData!;
  }

  // ============================================================================
  // Size Rules Management (with merging support)
  // ============================================================================

  getSizeRules(layerId: string): Map<string, number> {
    if (!this.sizeRulesMap.has(layerId)) {
      this.sizeRulesMap.set(layerId, new Map());
    }
    return this.sizeRulesMap.get(layerId)!;
  }

  getDefaultSize(layerId: string): number {
    return this.defaultSizesMap.get(layerId) ?? DEFAULT_POINT_SIZE;
  }

  setDefaultSize(layerId: string, size: number): void {
    this.defaultSizesMap.set(layerId, size);
  }

  /**
   * Add or update size rules, merging with existing rules
   */
  mergeSizeRules(
    layerId: string,
    property: string,
    newRules: SizeRule[],
    defaultSize: number
  ): Map<string, number> {
    const sizeMap = this.getSizeRules(layerId);

    // Update default size
    this.setDefaultSize(layerId, defaultSize);

    // Merge new rules with existing
    newRules.forEach((rule) => {
      sizeMap.set(rule.value, rule.size);
    });

    return sizeMap;
  }

  clearSizeRules(layerId: string): void {
    this.sizeRulesMap.delete(layerId);
    this.defaultSizesMap.delete(layerId);
  }

  clearAllSizeRules(): void {
    this.sizeRulesMap.clear();
    this.defaultSizesMap.clear();
  }

  /**
   * Get all size rules as array for display
   */
  getSizeRulesArray(layerId: string): SizeRule[] {
    const sizeMap = this.sizeRulesMap.get(layerId);
    if (!sizeMap) return [];
    return Array.from(sizeMap.entries()).map(([value, size]) => ({ value, size }));
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Create a getFillColor function that uses stored color filters
   */
  createColorAccessor(
    layerId: string,
    defaultColor: number[] = DEFAULT_LAYER_COLOR
  ): (feature: GeoJSON.Feature) => number[] {
    const filters = this.getColorFilters(layerId);

    const matchesFilter = (feature: GeoJSON.Feature, filter: ColorFilter): boolean => {
      const propValue = String(feature.properties?.[filter.property] || '');
      switch (filter.operator) {
        case 'equals':
          return propValue === filter.value;
        case 'startsWith':
          return propValue.startsWith(filter.value);
        case 'contains':
          return propValue.includes(filter.value);
        case 'regex':
          return new RegExp(filter.value).test(propValue);
        default:
          return false;
      }
    };

    return (feature: GeoJSON.Feature): number[] => {
      for (const filter of filters) {
        if (matchesFilter(feature, filter)) {
          return filter.color;
        }
      }
      return defaultColor;
    };
  }

  /**
   * Create a getPointRadius function that uses stored size rules
   */
  createSizeAccessor(layerId: string, property: string): (feature: GeoJSON.Feature) => number {
    const sizeMap = this.getSizeRules(layerId);
    const defaultSize = this.getDefaultSize(layerId);

    return (feature: GeoJSON.Feature): number => {
      const propValue = String(feature.properties?.[property] || '');
      return sizeMap.get(propValue) ?? defaultSize;
    };
  }

  /**
   * Reset all state for a layer
   */
  resetLayerState(layerId: string): void {
    this.clearColorFilters(layerId);
    this.clearSizeRules(layerId);
    this.clearActiveFilter(layerId);
    this.resetLayerToDefault(layerId);
  }

  /**
   * Reset all state
   */
  resetAllState(): void {
    this.colorFiltersMap.clear();
    this.sizeRulesMap.clear();
    this.defaultSizesMap.clear();
    this.activeFilters.clear();
    this.resetAllLayersToDefault();
    // Note: We keep originalLayerDataMap as it's source data
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private hexToRgba(hex?: string, alpha = 180): number[] | null {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), alpha]
      : null;
  }

  private rgbaToHex(rgba: number[]): string | null {
    if (!rgba || rgba.length < 3) return null;
    return '#' + [rgba[0], rgba[1], rgba[2]].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  private emitLayersUpdate(): void {
    this.layersSubject.next(this.getLayers());
  }
}
