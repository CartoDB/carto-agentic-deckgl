import { createContext, useContext, useRef, useCallback, useMemo, useState } from 'react';

/**
 * Context for managing persistent map tool state
 * Stores layer registry, visibility, colors, filters, size rules, and original data
 */
const MapToolsContext = createContext(null);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert hex color to RGBA array
 */
function hexToRgba(hex, alpha = 180) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
    alpha
  ] : null;
}

/**
 * Convert RGBA array to hex color string
 */
function rgbaToHex(rgba) {
  if (!rgba || rgba.length < 3) return null;
  return '#' + [rgba[0], rgba[1], rgba[2]]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Provider component for MapToolsContext
 */
export function MapToolsProvider({ children }) {
  // Persistent state using refs (survives re-renders)
  const colorFiltersRef = useRef(new Map()); // Map<layerId, filters[]>
  const originalLayerDataRef = useRef(new Map()); // Map<layerId, originalGeoJSON>
  const sizeRulesRef = useRef(new Map()); // Map<layerId, Map<propertyValue, size>>
  const defaultSizesRef = useRef(new Map()); // Map<layerId, defaultSize>

  // New refs for layer state management
  const layerRegistryRef = useRef(new Map()); // Map<layerId, {id, name, color}>
  const layerVisibilityRef = useRef(new Map()); // Map<layerId, boolean>
  const layerBaseColorRef = useRef(new Map()); // Map<layerId, [r,g,b,a]>
  const activeFiltersRef = useRef(new Map()); // Map<layerId, {property, operator, value} | null>

  // State to trigger re-renders when layer state changes
  const [layerStateVersion, setLayerStateVersion] = useState(0);
  const triggerLayerUpdate = useCallback(() => {
    setLayerStateVersion(v => v + 1);
  }, []);

  // ============================================================================
  // Layer Registry Management
  // ============================================================================

  /**
   * Register a layer with its initial configuration
   */
  const registerLayer = useCallback((config) => {
    // config: { id, name, color, visible? }
    if (!layerRegistryRef.current.has(config.id)) {
      layerRegistryRef.current.set(config.id, {
        id: config.id,
        name: config.name,
        color: config.color || '#c80050',
      });
      layerVisibilityRef.current.set(config.id, config.visible ?? true);
      layerBaseColorRef.current.set(config.id, hexToRgba(config.color) || [200, 0, 80, 180]);
      triggerLayerUpdate();
    }
  }, [triggerLayerUpdate]);

  /**
   * Get all layers with current state for UI
   * Note: depends on layerStateVersion to trigger re-renders when state changes
   */
  const getLayers = useCallback(() => {
    const layers = [];
    layerRegistryRef.current.forEach((config, layerId) => {
      layers.push({
        ...config,
        visible: layerVisibilityRef.current.get(layerId) ?? true,
        color: rgbaToHex(layerBaseColorRef.current.get(layerId)) || config.color,
      });
    });
    return layers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerStateVersion]);

  // ============================================================================
  // Layer Visibility Management
  // ============================================================================

  const getLayerVisibility = useCallback((layerId) => {
    return layerVisibilityRef.current.get(layerId) ?? true;
  }, []);

  const setLayerVisibility = useCallback((layerId, visible) => {
    layerVisibilityRef.current.set(layerId, visible);
    triggerLayerUpdate();
  }, [triggerLayerUpdate]);

  // ============================================================================
  // Layer Base Color Management
  // ============================================================================

  const getLayerBaseColor = useCallback((layerId) => {
    return layerBaseColorRef.current.get(layerId) ?? [200, 0, 80, 180];
  }, []);

  const setLayerBaseColor = useCallback((layerId, rgba) => {
    layerBaseColorRef.current.set(layerId, rgba);
    triggerLayerUpdate();
  }, [triggerLayerUpdate]);

  // ============================================================================
  // Active Filter Management
  // ============================================================================

  const getActiveFilter = useCallback((layerId) => {
    return activeFiltersRef.current.get(layerId) ?? null;
  }, []);

  const setActiveFilter = useCallback((layerId, filter) => {
    activeFiltersRef.current.set(layerId, filter);
  }, []);

  const clearActiveFilter = useCallback((layerId) => {
    activeFiltersRef.current.delete(layerId);
  }, []);

  // ============================================================================
  // Get Full Layer State (for debugging/inspection)
  // ============================================================================

  const getLayerState = useCallback((layerId) => {
    return {
      visible: layerVisibilityRef.current.get(layerId) ?? true,
      baseColor: layerBaseColorRef.current.get(layerId) ?? [200, 0, 80, 180],
      colorFilters: colorFiltersRef.current.get(layerId) ?? [],
      activeFilter: activeFiltersRef.current.get(layerId) ?? null,
      sizeRules: sizeRulesRef.current.get(layerId)
        ? Array.from(sizeRulesRef.current.get(layerId).entries()).map(([value, size]) => ({ value, size }))
        : [],
      defaultSize: defaultSizesRef.current.get(layerId) ?? 8,
    };
  }, []);

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
    clearActiveFilter(layerId);
    // Reset visibility and color to defaults
    layerVisibilityRef.current.set(layerId, true);
    const registry = layerRegistryRef.current.get(layerId);
    if (registry) {
      layerBaseColorRef.current.set(layerId, hexToRgba(registry.color) || [200, 0, 80, 180]);
    }
  }, [clearColorFilters, clearSizeRules, clearActiveFilter]);

  /**
   * Reset all state
   */
  const resetAllState = useCallback(() => {
    colorFiltersRef.current.clear();
    sizeRulesRef.current.clear();
    defaultSizesRef.current.clear();
    activeFiltersRef.current.clear();
    // Reset visibility and colors to defaults for all layers
    layerRegistryRef.current.forEach((config, layerId) => {
      layerVisibilityRef.current.set(layerId, true);
      layerBaseColorRef.current.set(layerId, hexToRgba(config.color) || [200, 0, 80, 180]);
    });
    // Note: We keep originalLayerDataRef and layerRegistryRef as they're source data
  }, []);

  // Memoize context value
  const value = useMemo(() => ({
    // Layer registry
    registerLayer,
    getLayers,
    getLayerState,

    // Layer visibility
    getLayerVisibility,
    setLayerVisibility,

    // Layer base color
    getLayerBaseColor,
    setLayerBaseColor,

    // Active filter
    getActiveFilter,
    setActiveFilter,
    clearActiveFilter,

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
    registerLayer, getLayers, getLayerState,
    getLayerVisibility, setLayerVisibility,
    getLayerBaseColor, setLayerBaseColor,
    getActiveFilter, setActiveFilter, clearActiveFilter,
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
