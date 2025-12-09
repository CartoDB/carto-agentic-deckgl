import { Injectable } from '@angular/core';

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
 * Stores color filters, size rules, and original layer data across tool executions
 */
@Injectable({
  providedIn: 'root'
})
export class MapToolsStateService {
  // Persistent state maps
  private colorFiltersMap = new Map<string, ColorFilter[]>();
  private originalLayerDataMap = new Map<string, GeoJSON.FeatureCollection>();
  private sizeRulesMap = new Map<string, Map<string, number>>();
  private defaultSizesMap = new Map<string, number>();

  constructor() {}

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
    const existingIdx = filters.findIndex(f => f.key === filter.key);

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

  getOrSetOriginalData(layerId: string, currentData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
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
    return this.defaultSizesMap.get(layerId) ?? 8;
  }

  setDefaultSize(layerId: string, size: number): void {
    this.defaultSizesMap.set(layerId, size);
  }

  /**
   * Add or update size rules, merging with existing rules
   */
  mergeSizeRules(layerId: string, property: string, newRules: SizeRule[], defaultSize: number): Map<string, number> {
    const sizeMap = this.getSizeRules(layerId);

    // Update default size
    this.setDefaultSize(layerId, defaultSize);

    // Merge new rules with existing
    newRules.forEach(rule => {
      sizeMap.set(rule.value, rule.size);
    });

    return sizeMap;
  }

  clearSizeRules(layerId: string): void {
    this.sizeRulesMap.delete(layerId);
    this.defaultSizesMap.delete(layerId);
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
  createColorAccessor(layerId: string, defaultColor: number[] = [200, 0, 80, 180]): (feature: any) => number[] {
    const filters = this.getColorFilters(layerId);

    const matchesFilter = (feature: any, filter: ColorFilter): boolean => {
      const propValue = String(feature.properties[filter.property] || '');
      switch (filter.operator) {
        case 'equals': return propValue === filter.value;
        case 'startsWith': return propValue.startsWith(filter.value);
        case 'contains': return propValue.includes(filter.value);
        case 'regex': return new RegExp(filter.value).test(propValue);
        default: return false;
      }
    };

    return (feature: any): number[] => {
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
  createSizeAccessor(layerId: string, property: string): (feature: any) => number {
    const sizeMap = this.getSizeRules(layerId);
    const defaultSize = this.getDefaultSize(layerId);

    return (feature: any): number => {
      const propValue = String(feature.properties[property] || '');
      return sizeMap.get(propValue) ?? defaultSize;
    };
  }

  /**
   * Reset all state for a layer
   */
  resetLayerState(layerId: string): void {
    this.clearColorFilters(layerId);
    this.clearSizeRules(layerId);
  }

  /**
   * Reset all state
   */
  resetAllState(): void {
    this.colorFiltersMap.clear();
    this.sizeRulesMap.clear();
    this.defaultSizesMap.clear();
    // Note: We keep originalLayerDataMap as it's source data
  }
}
