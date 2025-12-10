import { useMemo } from 'react';
import { createAllExecutors } from '../services/toolExecutors';

/**
 * Custom hook for creating tool executors
 * Factory hook that creates executors when map instances are available
 *
 * @param {Object} mapInstances - Map instances { deck, map }
 * @param {Object} mapTools - MapTools context
 * @returns {Object} Map of tool name to executor function
 */
export function useToolExecutors(mapInstances, mapTools) {
  return useMemo(() => {
    if (!mapInstances) {
      return {};
    }

    const { deck, map } = mapInstances;

    return createAllExecutors({
      deck,
      map,
      mapTools,
    });
  }, [mapInstances, mapTools]);
}
