import { reactive } from 'vue';

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
 * Singleton state for map tools (Vue equivalent of React's MapToolsContext)
 */
const state = reactive({
  colorFilters: new Map<string, ColorFilter[]>(),
  originalLayerData: new Map<string, GeoJSON.FeatureCollection>(),
  sizeRules: new Map<string, Map<string, number>>(),
  defaultSizes: new Map<string, number>()
});

/**
 * Composable for managing persistent map tool state
 */
export function useMapToolsState() {
  // ============================================================================
  // Color Filters Management
  // ============================================================================

  function getColorFilters(layerId: string): ColorFilter[] {
    if (!state.colorFilters.has(layerId)) {
      state.colorFilters.set(layerId, []);
    }
    return state.colorFilters.get(layerId)!;
  }

  function addColorFilter(layerId: string, filter: ColorFilter): ColorFilter[] {
    const filters = getColorFilters(layerId);
    const existingIdx = filters.findIndex(f => f.key === filter.key);

    if (existingIdx >= 0) {
      filters[existingIdx] = filter;
    } else {
      filters.push(filter);
    }

    return [...filters];
  }

  function clearColorFilters(layerId: string): void {
    state.colorFilters.set(layerId, []);
  }

  // ============================================================================
  // Original Layer Data Management
  // ============================================================================

  function getOriginalData(layerId: string): GeoJSON.FeatureCollection | undefined {
    return state.originalLayerData.get(layerId);
  }

  function setOriginalData(layerId: string, data: GeoJSON.FeatureCollection): void {
    if (!state.originalLayerData.has(layerId) && data?.features) {
      state.originalLayerData.set(layerId, data);
    }
  }

  function getOrSetOriginalData(layerId: string, currentData: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
    let originalData = state.originalLayerData.get(layerId);
    if (!originalData && currentData?.features) {
      originalData = currentData;
      state.originalLayerData.set(layerId, originalData);
    }
    return originalData!;
  }

  // ============================================================================
  // Size Rules Management
  // ============================================================================

  function getSizeRules(layerId: string): Map<string, number> {
    if (!state.sizeRules.has(layerId)) {
      state.sizeRules.set(layerId, new Map());
    }
    return state.sizeRules.get(layerId)!;
  }

  function getDefaultSize(layerId: string): number {
    return state.defaultSizes.get(layerId) ?? 8;
  }

  function setDefaultSize(layerId: string, size: number): void {
    state.defaultSizes.set(layerId, size);
  }

  function mergeSizeRules(layerId: string, _property: string, newRules: SizeRule[], defaultSize: number): Map<string, number> {
    const sizeMap = getSizeRules(layerId);
    setDefaultSize(layerId, defaultSize);

    newRules.forEach(rule => {
      sizeMap.set(rule.value, rule.size);
    });

    return sizeMap;
  }

  function clearSizeRules(layerId: string): void {
    state.sizeRules.delete(layerId);
    state.defaultSizes.delete(layerId);
  }

  function getSizeRulesArray(layerId: string): SizeRule[] {
    const sizeMap = state.sizeRules.get(layerId);
    if (!sizeMap) return [];
    return Array.from(sizeMap.entries()).map(([value, size]) => ({ value, size }));
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function createColorAccessor(layerId: string, defaultColor: number[] = [200, 0, 80, 180]): (feature: GeoJSON.Feature) => number[] {
    const filters = getColorFilters(layerId);

    const matchesFilter = (feature: GeoJSON.Feature, filter: ColorFilter): boolean => {
      const propValue = String(feature.properties?.[filter.property] || '');
      switch (filter.operator) {
        case 'equals': return propValue === filter.value;
        case 'startsWith': return propValue.startsWith(filter.value);
        case 'contains': return propValue.includes(filter.value);
        case 'regex': return new RegExp(filter.value).test(propValue);
        default: return false;
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

  function createSizeAccessor(layerId: string, property: string): (feature: GeoJSON.Feature) => number {
    const sizeMap = getSizeRules(layerId);
    const defaultSize = getDefaultSize(layerId);

    return (feature: GeoJSON.Feature): number => {
      const propValue = String(feature.properties?.[property] || '');
      return sizeMap.get(propValue) ?? defaultSize;
    };
  }

  function resetLayerState(layerId: string): void {
    clearColorFilters(layerId);
    clearSizeRules(layerId);
  }

  function resetAllState(): void {
    state.colorFilters.clear();
    state.sizeRules.clear();
    state.defaultSizes.clear();
  }

  return {
    getColorFilters,
    addColorFilter,
    clearColorFilters,
    createColorAccessor,
    getOriginalData,
    setOriginalData,
    getOrSetOriginalData,
    getSizeRules,
    getDefaultSize,
    setDefaultSize,
    mergeSizeRules,
    clearSizeRules,
    getSizeRulesArray,
    createSizeAccessor,
    resetLayerState,
    resetAllState
  };
}
