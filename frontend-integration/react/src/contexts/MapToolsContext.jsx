import { createContext, useContext, useMemo, useCallback } from 'react';
import { useLayerRegistry } from './hooks/useLayerRegistry';
import { useColorFilters } from './hooks/useColorFilters';
import { useSizeRules } from './hooks/useSizeRules';
import { useDataFilters } from './hooks/useDataFilters';

/**
 * Context for managing persistent map tool state
 * Composes specialized hooks for better separation of concerns (ISP)
 */
const MapToolsContext = createContext(null);

/**
 * Provider component for MapToolsContext
 * Composes useLayerRegistry, useColorFilters, useSizeRules, and useDataFilters
 */
export function MapToolsProvider({ children }) {
  // Compose specialized hooks
  const layerRegistry = useLayerRegistry();
  const colorFilters = useColorFilters();
  const sizeRules = useSizeRules();
  const dataFilters = useDataFilters();

  /**
   * Get full layer state (for debugging/inspection)
   */
  const getLayerState = useCallback(
    (layerId) => {
      return {
        visible: layerRegistry.getLayerVisibility(layerId),
        baseColor: layerRegistry.getLayerBaseColor(layerId),
        colorFilters: colorFilters.getColorFilters(layerId),
        activeFilter: dataFilters.getActiveFilter(layerId),
        sizeRules: sizeRules.getSizeRulesArray(layerId),
        defaultSize: sizeRules.getDefaultSize(layerId),
      };
    },
    [layerRegistry, colorFilters, dataFilters, sizeRules]
  );

  /**
   * Reset all state for a layer
   */
  const resetLayerState = useCallback(
    (layerId) => {
      colorFilters.clearColorFilters(layerId);
      sizeRules.clearSizeRules(layerId);
      dataFilters.clearActiveFilter(layerId);
      layerRegistry.resetLayerToDefault(layerId);
    },
    [colorFilters, sizeRules, dataFilters, layerRegistry]
  );

  /**
   * Reset all state
   */
  const resetAllState = useCallback(() => {
    colorFilters.clearAllColorFilters();
    sizeRules.clearAllSizeRules();
    dataFilters.clearAllActiveFilters();
    layerRegistry.resetAllLayersToDefault();
  }, [colorFilters, sizeRules, dataFilters, layerRegistry]);

  // Memoize context value
  const value = useMemo(
    () => ({
      // Layer registry
      registerLayer: layerRegistry.registerLayer,
      getLayers: layerRegistry.getLayers,
      getLayerState,

      // Layer visibility
      getLayerVisibility: layerRegistry.getLayerVisibility,
      setLayerVisibility: layerRegistry.setLayerVisibility,

      // Layer base color
      getLayerBaseColor: layerRegistry.getLayerBaseColor,
      setLayerBaseColor: layerRegistry.setLayerBaseColor,

      // Active filter
      getActiveFilter: dataFilters.getActiveFilter,
      setActiveFilter: dataFilters.setActiveFilter,
      clearActiveFilter: dataFilters.clearActiveFilter,

      // Color filters
      getColorFilters: colorFilters.getColorFilters,
      addColorFilter: colorFilters.addColorFilter,
      clearColorFilters: colorFilters.clearColorFilters,
      createColorAccessor: colorFilters.createColorAccessor,

      // Original data
      getOriginalData: dataFilters.getOriginalData,
      setOriginalData: dataFilters.setOriginalData,
      getOrSetOriginalData: dataFilters.getOrSetOriginalData,

      // Size rules
      getSizeRules: sizeRules.getSizeRules,
      getDefaultSize: sizeRules.getDefaultSize,
      setDefaultSize: sizeRules.setDefaultSize,
      mergeSizeRules: sizeRules.mergeSizeRules,
      clearSizeRules: sizeRules.clearSizeRules,
      getSizeRulesArray: sizeRules.getSizeRulesArray,
      createSizeAccessor: sizeRules.createSizeAccessor,

      // Utilities
      resetLayerState,
      resetAllState,
    }),
    [
      layerRegistry,
      colorFilters,
      sizeRules,
      dataFilters,
      getLayerState,
      resetLayerState,
      resetAllState,
    ]
  );

  return (
    <MapToolsContext.Provider value={value}>
      {children}
    </MapToolsContext.Provider>
  );
}

/**
 * Hook to access MapToolsContext
 * @returns {Object} MapTools context value
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useMapTools() {
  const context = useContext(MapToolsContext);
  if (!context) {
    throw new Error('useMapTools must be used within a MapToolsProvider');
  }
  return context;
}

export default MapToolsContext;
