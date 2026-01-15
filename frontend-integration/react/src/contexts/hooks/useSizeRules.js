import { useRef, useCallback } from 'react';
import { DEFAULT_POINT_SIZE } from '../../config/constants';

/**
 * Hook for managing size rules state
 * Extracted from MapToolsContext
 */
export function useSizeRules() {
  const sizeRulesRef = useRef(new Map());
  const defaultSizesRef = useRef(new Map());

  /**
   * Get size rules map for a layer
   */
  const getSizeRules = useCallback((layerId) => {
    if (!sizeRulesRef.current.has(layerId)) {
      sizeRulesRef.current.set(layerId, new Map());
    }
    return sizeRulesRef.current.get(layerId);
  }, []);

  /**
   * Get default size for a layer
   */
  const getDefaultSize = useCallback((layerId) => {
    return defaultSizesRef.current.get(layerId) ?? DEFAULT_POINT_SIZE;
  }, []);

  /**
   * Set default size for a layer
   */
  const setDefaultSize = useCallback((layerId, size) => {
    defaultSizesRef.current.set(layerId, size);
  }, []);

  /**
   * Merge new size rules with existing rules
   */
  const mergeSizeRules = useCallback(
    (layerId, property, newRules, defaultSize) => {
      const sizeMap = getSizeRules(layerId);

      // Update default size
      setDefaultSize(layerId, defaultSize);

      // Merge new rules with existing
      newRules.forEach((rule) => {
        sizeMap.set(rule.value, rule.size);
      });

      return sizeMap;
    },
    [getSizeRules, setDefaultSize]
  );

  /**
   * Clear size rules for a layer
   */
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
    return Array.from(sizeMap.entries()).map(([value, size]) => ({
      value,
      size,
    }));
  }, []);

  /**
   * Create a size accessor function based on stored rules
   */
  const createSizeAccessor = useCallback(
    (layerId, property) => {
      const sizeMap = getSizeRules(layerId);
      const defaultSize = getDefaultSize(layerId);

      return (feature) => {
        const propValue = String(feature.properties[property] || '');
        return sizeMap.get(propValue) ?? defaultSize;
      };
    },
    [getSizeRules, getDefaultSize]
  );

  /**
   * Clear all size rules
   */
  const clearAllSizeRules = useCallback(() => {
    sizeRulesRef.current.clear();
    defaultSizesRef.current.clear();
  }, []);

  return {
    getSizeRules,
    getDefaultSize,
    setDefaultSize,
    mergeSizeRules,
    clearSizeRules,
    getSizeRulesArray,
    createSizeAccessor,
    clearAllSizeRules,
  };
}
