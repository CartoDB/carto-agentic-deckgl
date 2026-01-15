import { useRef, useCallback } from 'react';

/**
 * Hook for managing data filters and original data state
 * Extracted from MapToolsContext
 */
export function useDataFilters() {
  const activeFiltersRef = useRef(new Map());
  const originalLayerDataRef = useRef(new Map());

  /**
   * Get active filter for a layer
   */
  const getActiveFilter = useCallback((layerId) => {
    return activeFiltersRef.current.get(layerId) ?? null;
  }, []);

  /**
   * Set active filter for a layer
   */
  const setActiveFilter = useCallback((layerId, filter) => {
    activeFiltersRef.current.set(layerId, filter);
  }, []);

  /**
   * Clear active filter for a layer
   */
  const clearActiveFilter = useCallback((layerId) => {
    activeFiltersRef.current.delete(layerId);
  }, []);

  /**
   * Get original data for a layer
   */
  const getOriginalData = useCallback((layerId) => {
    return originalLayerDataRef.current.get(layerId);
  }, []);

  /**
   * Set original data for a layer (only if not already set)
   */
  const setOriginalData = useCallback((layerId, data) => {
    if (!originalLayerDataRef.current.has(layerId) && data?.features) {
      originalLayerDataRef.current.set(layerId, data);
    }
  }, []);

  /**
   * Get or set original data for a layer
   * Returns existing data or stores and returns the provided data
   */
  const getOrSetOriginalData = useCallback((layerId, currentData) => {
    let originalData = originalLayerDataRef.current.get(layerId);
    if (!originalData && currentData?.features) {
      originalData = currentData;
      originalLayerDataRef.current.set(layerId, originalData);
    }
    return originalData;
  }, []);

  /**
   * Clear all active filters
   */
  const clearAllActiveFilters = useCallback(() => {
    activeFiltersRef.current.clear();
  }, []);

  /**
   * Clear all original data (use with caution)
   */
  const clearAllOriginalData = useCallback(() => {
    originalLayerDataRef.current.clear();
  }, []);

  return {
    getActiveFilter,
    setActiveFilter,
    clearActiveFilter,
    getOriginalData,
    setOriginalData,
    getOrSetOriginalData,
    clearAllActiveFilters,
    clearAllOriginalData,
  };
}
