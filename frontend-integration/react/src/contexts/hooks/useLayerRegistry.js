import { useRef, useCallback, useState } from 'react';
import { DEFAULT_LAYER_COLOR } from '../../config/constants';

/**
 * Convert hex color to RGBA array
 */
function hexToRgba(hex, alpha = 180) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        alpha,
      ]
    : null;
}

/**
 * Convert RGBA array to hex color string
 */
function rgbaToHex(rgba) {
  if (!rgba || rgba.length < 3) return null;
  return (
    '#' +
    [rgba[0], rgba[1], rgba[2]].map((x) => x.toString(16).padStart(2, '0')).join('')
  );
}

/**
 * Hook for managing layer registry, visibility, and base colors
 * Extracted from MapToolsContext
 */
export function useLayerRegistry() {
  // Persistent state using refs
  const layerRegistryRef = useRef(new Map());
  const layerVisibilityRef = useRef(new Map());
  const layerBaseColorRef = useRef(new Map());

  // State to trigger re-renders when layer state changes
  const [layerStateVersion, setLayerStateVersion] = useState(0);
  const triggerLayerUpdate = useCallback(() => {
    setLayerStateVersion((v) => v + 1);
  }, []);

  /**
   * Register a layer with its initial configuration
   */
  const registerLayer = useCallback(
    (config) => {
      if (!layerRegistryRef.current.has(config.id)) {
        layerRegistryRef.current.set(config.id, {
          id: config.id,
          name: config.name,
          color: config.color || '#c80050',
        });
        layerVisibilityRef.current.set(config.id, config.visible ?? true);
        layerBaseColorRef.current.set(
          config.id,
          hexToRgba(config.color) || DEFAULT_LAYER_COLOR
        );
        triggerLayerUpdate();
      }
    },
    [triggerLayerUpdate]
  );

  /**
   * Get all layers with current state for UI
   */
  const getLayers = useCallback(() => {
    const layers = [];
    layerRegistryRef.current.forEach((config, layerId) => {
      layers.push({
        ...config,
        visible: layerVisibilityRef.current.get(layerId) ?? true,
        color:
          rgbaToHex(layerBaseColorRef.current.get(layerId)) || config.color,
      });
    });
    return layers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerStateVersion]);

  /**
   * Get visibility state for a layer
   */
  const getLayerVisibility = useCallback((layerId) => {
    return layerVisibilityRef.current.get(layerId) ?? true;
  }, []);

  /**
   * Set visibility state for a layer
   */
  const setLayerVisibility = useCallback(
    (layerId, visible) => {
      layerVisibilityRef.current.set(layerId, visible);
      triggerLayerUpdate();
    },
    [triggerLayerUpdate]
  );

  /**
   * Get base color for a layer
   */
  const getLayerBaseColor = useCallback((layerId) => {
    return layerBaseColorRef.current.get(layerId) ?? DEFAULT_LAYER_COLOR;
  }, []);

  /**
   * Set base color for a layer
   */
  const setLayerBaseColor = useCallback(
    (layerId, rgba) => {
      layerBaseColorRef.current.set(layerId, rgba);
      triggerLayerUpdate();
    },
    [triggerLayerUpdate]
  );

  /**
   * Reset layer to default state
   */
  const resetLayerToDefault = useCallback(
    (layerId) => {
      layerVisibilityRef.current.set(layerId, true);
      const registry = layerRegistryRef.current.get(layerId);
      if (registry) {
        layerBaseColorRef.current.set(
          layerId,
          hexToRgba(registry.color) || DEFAULT_LAYER_COLOR
        );
      }
      triggerLayerUpdate();
    },
    [triggerLayerUpdate]
  );

  /**
   * Reset all layers to default state
   */
  const resetAllLayersToDefault = useCallback(() => {
    layerRegistryRef.current.forEach((config, layerId) => {
      layerVisibilityRef.current.set(layerId, true);
      layerBaseColorRef.current.set(
        layerId,
        hexToRgba(config.color) || DEFAULT_LAYER_COLOR
      );
    });
    triggerLayerUpdate();
  }, [triggerLayerUpdate]);

  return {
    registerLayer,
    getLayers,
    getLayerVisibility,
    setLayerVisibility,
    getLayerBaseColor,
    setLayerBaseColor,
    resetLayerToDefault,
    resetAllLayersToDefault,
  };
}
