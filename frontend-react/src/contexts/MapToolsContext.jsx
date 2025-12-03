import { createContext, useContext, useRef, useCallback, useMemo } from 'react';

/**
 * Context for managing persistent map tool state
 * Stores color filters, size rules, and original layer data across tool executions
 */
const MapToolsContext = createContext(null);

/**
 * Provider component for MapToolsContext
 */
export function MapToolsProvider({ children }) {
  // Persistent state using refs (survives re-renders)
  const colorFiltersRef = useRef(new Map()); // Map<layerId, filters[]>
  const originalLayerDataRef = useRef(new Map()); // Map<layerId, originalGeoJSON>
  const sizeRulesRef = useRef(new Map()); // Map<layerId, Map<propertyValue, size>>
  const defaultSizesRef = useRef(new Map()); // Map<layerId, defaultSize>

  // ============================================================================
  // Color Filters Management
  // ============================================================================

  const getColorFilters = useCallback((layerId) => {
    if (!colorFiltersRef.current.has(layerId)) {
      colorFiltersRef.current.set(layerId, []);
    }
    return colorFiltersRef.current.get(layerId);
  }, []);

  const addColorFilter = useCallback((layerId, filter) => {
    const filters = getColorFilters(layerId);
    const existingIdx = filters.findIndex(f => f.key === filter.key);

    if (existingIdx >= 0) {
      filters[existingIdx] = filter;
    } else {
      filters.push(filter);
    }

    return [...filters]; // Return copy for update triggers
  }, [getColorFilters]);

  const clearColorFilters = useCallback((layerId) => {
    colorFiltersRef.current.set(layerId, []);
  }, []);

  // ============================================================================
  // Original Layer Data Management
  // ============================================================================

  const getOriginalData = useCallback((layerId) => {
    return originalLayerDataRef.current.get(layerId);
  }, []);

  const setOriginalData = useCallback((layerId, data) => {
    if (!originalLayerDataRef.current.has(layerId) && data?.features) {
      originalLayerDataRef.current.set(layerId, data);
    }
  }, []);

  const getOrSetOriginalData = useCallback((layerId, currentData) => {
    let originalData = originalLayerDataRef.current.get(layerId);
    if (!originalData && currentData?.features) {
      originalData = currentData;
      originalLayerDataRef.current.set(layerId, originalData);
    }
    return originalData;
  }, []);

  // ============================================================================
  // Size Rules Management (with merging support)
  // ============================================================================

  const getSizeRules = useCallback((layerId) => {
    if (!sizeRulesRef.current.has(layerId)) {
      sizeRulesRef.current.set(layerId, new Map());
    }
    return sizeRulesRef.current.get(layerId);
  }, []);

  const getDefaultSize = useCallback((layerId) => {
    return defaultSizesRef.current.get(layerId) ?? 8;
  }, []);

  const setDefaultSize = useCallback((layerId, size) => {
    defaultSizesRef.current.set(layerId, size);
  }, []);

  /**
   * Add or update size rules, merging with existing rules
   * @param {string} layerId - Layer ID
   * @param {string} property - Property name for sizing
   * @param {Array} newRules - Array of {value, size} rules to add/update
   * @param {number} defaultSize - Default size for unmatched features
   * @returns {Map} Updated size map
   */
  const mergeSizeRules = useCallback((layerId, property, newRules, defaultSize) => {
    const sizeMap = getSizeRules(layerId);

    // Update default size
    setDefaultSize(layerId, defaultSize);

    // Merge new rules with existing
    newRules.forEach(rule => {
      sizeMap.set(rule.value, rule.size);
    });

    return sizeMap;
  }, [getSizeRules, setDefaultSize]);

  const clearSizeRules = useCallback((layerId) => {
    sizeRulesRef.current.delete(layerId);
    defaultSizesRef.current.delete(layerId);
  }, []);

  /**
   * Get all size rules as array for display
   */
  const getSizeRulesArray = useCallback((layerId) => {
    const sizeMap = sizeRulesRef.current.get(layerId);
    if (!sizeMap) return [];
    return Array.from(sizeMap.entries()).map(([value, size]) => ({ value, size }));
  }, []);

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Create a getFillColor function that uses stored color filters
   */
  const createColorAccessor = useCallback((layerId, defaultColor = [200, 0, 80, 180]) => {
    const filters = getColorFilters(layerId);

    const matchesFilter = (feature, filter) => {
      const propValue = String(feature.properties[filter.property] || '');
      switch (filter.operator) {
        case 'equals': return propValue === filter.value;
        case 'startsWith': return propValue.startsWith(filter.value);
        case 'contains': return propValue.includes(filter.value);
        case 'regex': return new RegExp(filter.value).test(propValue);
        default: return false;
      }
    };

    return (feature) => {
      for (const filter of filters) {
        if (matchesFilter(feature, filter)) {
          return filter.color;
        }
      }
      return defaultColor;
    };
  }, [getColorFilters]);

  /**
   * Create a getPointRadius function that uses stored size rules
   */
  const createSizeAccessor = useCallback((layerId, property) => {
    const sizeMap = getSizeRules(layerId);
    const defaultSize = getDefaultSize(layerId);

    return (feature) => {
      const propValue = String(feature.properties[property] || '');
      return sizeMap.get(propValue) ?? defaultSize;
    };
  }, [getSizeRules, getDefaultSize]);

  /**
   * Reset all state for a layer
   */
  const resetLayerState = useCallback((layerId) => {
    clearColorFilters(layerId);
    clearSizeRules(layerId);
  }, [clearColorFilters, clearSizeRules]);

  /**
   * Reset all state
   */
  const resetAllState = useCallback(() => {
    colorFiltersRef.current.clear();
    sizeRulesRef.current.clear();
    defaultSizesRef.current.clear();
    // Note: We keep originalLayerDataRef as it's source data
  }, []);

  // Memoize context value
  const value = useMemo(() => ({
    // Color filters
    getColorFilters,
    addColorFilter,
    clearColorFilters,
    createColorAccessor,

    // Original data
    getOriginalData,
    setOriginalData,
    getOrSetOriginalData,

    // Size rules
    getSizeRules,
    getDefaultSize,
    setDefaultSize,
    mergeSizeRules,
    clearSizeRules,
    getSizeRulesArray,
    createSizeAccessor,

    // Utilities
    resetLayerState,
    resetAllState,
  }), [
    getColorFilters, addColorFilter, clearColorFilters, createColorAccessor,
    getOriginalData, setOriginalData, getOrSetOriginalData,
    getSizeRules, getDefaultSize, setDefaultSize, mergeSizeRules,
    clearSizeRules, getSizeRulesArray, createSizeAccessor,
    resetLayerState, resetAllState
  ]);

  return (
    <MapToolsContext.Provider value={value}>
      {children}
    </MapToolsContext.Provider>
  );
}

/**
 * Hook to access MapToolsContext
 */
export function useMapTools() {
  const context = useContext(MapToolsContext);
  if (!context) {
    throw new Error('useMapTools must be used within a MapToolsProvider');
  }
  return context;
}

export default MapToolsContext;
