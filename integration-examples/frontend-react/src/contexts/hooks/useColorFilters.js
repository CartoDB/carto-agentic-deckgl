import { useRef, useCallback } from 'react';
import { DEFAULT_LAYER_COLOR } from '../../config/constants';

/**
 * Hook for managing color filters state
 * Extracted from MapToolsContext
 */
export function useColorFilters() {
  const colorFiltersRef = useRef(new Map());

  /**
   * Get color filters for a layer
   */
  const getColorFilters = useCallback((layerId) => {
    if (!colorFiltersRef.current.has(layerId)) {
      colorFiltersRef.current.set(layerId, []);
    }
    return colorFiltersRef.current.get(layerId);
  }, []);

  /**
   * Add or update a color filter for a layer
   */
  const addColorFilter = useCallback(
    (layerId, filter) => {
      const filters = getColorFilters(layerId);
      const existingIdx = filters.findIndex((f) => f.key === filter.key);

      if (existingIdx >= 0) {
        filters[existingIdx] = filter;
      } else {
        filters.push(filter);
      }

      return [...filters]; // Return copy for update triggers
    },
    [getColorFilters]
  );

  /**
   * Clear all color filters for a layer
   */
  const clearColorFilters = useCallback((layerId) => {
    colorFiltersRef.current.set(layerId, []);
  }, []);

  /**
   * Create a color accessor function based on stored filters
   */
  const createColorAccessor = useCallback(
    (layerId, defaultColor = DEFAULT_LAYER_COLOR) => {
      const filters = getColorFilters(layerId);

      const matchesFilter = (feature, filter) => {
        const propValue = String(feature.properties[filter.property] || '');
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

      return (feature) => {
        for (const filter of filters) {
          if (matchesFilter(feature, filter)) {
            return filter.color;
          }
        }
        return defaultColor;
      };
    },
    [getColorFilters]
  );

  /**
   * Clear all color filters
   */
  const clearAllColorFilters = useCallback(() => {
    colorFiltersRef.current.clear();
  }, []);

  return {
    getColorFilters,
    addColorFilter,
    clearColorFilters,
    createColorAccessor,
    clearAllColorFilters,
  };
}
