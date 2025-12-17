/**
 * JSON Spec Executor
 *
 * This module handles the application of @deck.gl/json specs to deck.gl instances.
 * It processes layer operations (add, update, remove), view state changes,
 * and coordinates with the layer registry and filter state.
 */

import { createJsonConverter, resolveFunctionRef } from '../config/deckJsonConfig';
import { scheduleRedraws, REDRAW_PRESETS } from './deckUtils/redraw';
import { findLayerById, syncMapLibreView } from './deckUtils/layerUtils';
import { filterFeatures, createPropertyMatcher } from './deckUtils/propertyMatcher';

/**
 * Create a JSON spec executor for applying @deck.gl/json specs
 *
 * @param {Object} options
 * @param {Deck} options.deck - deck.gl instance
 * @param {Map} [options.map] - Optional MapLibre map instance
 * @param {Object} options.mapTools - MapTools context for state management
 * @returns {Object} Executor object with applySpec and other methods
 */
export function createJsonSpecExecutor({ deck, map, mapTools }) {
  const jsonConverter = createJsonConverter();

  /**
   * Get current layers from deck
   */
  const getCurrentLayers = () => deck.props.layers || [];

  /**
   * Get current view state from deck
   */
  const getCurrentViewState = () => {
    const vs = deck.props.initialViewState || deck.viewState || {};
    return {
      longitude: vs.longitude ?? 0,
      latitude: vs.latitude ?? 0,
      zoom: vs.zoom ?? 2,
      pitch: vs.pitch ?? 0,
      bearing: vs.bearing ?? 0,
    };
  };

  /**
   * Apply view state changes from spec
   */
  const applyViewState = (viewStateSpec) => {
    if (!viewStateSpec) return;

    const currentVs = getCurrentViewState();
    const newViewState = {
      ...currentVs,
    };

    // Apply only defined properties
    if (viewStateSpec.longitude !== undefined) newViewState.longitude = viewStateSpec.longitude;
    if (viewStateSpec.latitude !== undefined) newViewState.latitude = viewStateSpec.latitude;
    if (viewStateSpec.zoom !== undefined) newViewState.zoom = viewStateSpec.zoom;
    if (viewStateSpec.pitch !== undefined) newViewState.pitch = viewStateSpec.pitch;
    if (viewStateSpec.bearing !== undefined) newViewState.bearing = viewStateSpec.bearing;

    // Handle transition
    if (viewStateSpec.transitionDuration !== undefined) {
      newViewState.transitionDuration = viewStateSpec.transitionDuration;
    }

    // Handle transition interpolator (resolve from constant ref)
    if (viewStateSpec.transitionInterpolator) {
      const interpolator = resolveConstantRef(viewStateSpec.transitionInterpolator);
      if (interpolator) {
        newViewState.transitionInterpolator = interpolator;
      }
    }

    deck.setProps({ initialViewState: newViewState });

    // Sync with MapLibre if available
    if (map) {
      syncMapLibreView(map, newViewState);
    }

    // Schedule redraws
    scheduleRedraws(deck, REDRAW_PRESETS.flyTo);
  };

  /**
   * Resolve constant reference (e.g., "@@#FlyToInterpolator")
   */
  const resolveConstantRef = (ref) => {
    if (!ref || typeof ref !== 'string') return null;
    if (!ref.startsWith('@@#')) return null;

    const constName = ref.slice(3);
    // Import constants from config
    const { FlyToInterpolator, LinearInterpolator } = require('@deck.gl/core');

    const constants = {
      FlyToInterpolator: new FlyToInterpolator(),
      LinearInterpolator: new LinearInterpolator(),
    };

    return constants[constName] || null;
  };

  /**
   * Apply layer operations from spec
   */
  const applyLayerOperations = (operations) => {
    if (!operations || operations.length === 0) return;

    let currentLayers = [...getCurrentLayers()];

    for (const op of operations) {
      switch (op.operation) {
        case 'add':
          // Layer will be added from the layers array in spec
          break;

        case 'update':
          currentLayers = updateLayerById(currentLayers, op.layerId, op.props);
          break;

        case 'remove':
          currentLayers = currentLayers.filter((l) => l.id !== op.layerId);
          break;
      }
    }

    deck.setProps({ layers: currentLayers });
    scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);
  };

  /**
   * Update a layer by ID with new props
   */
  const updateLayerById = (layers, layerId, props) => {
    return layers.map((layer) => {
      if (layer.id !== layerId) return layer;

      // Handle special props that need resolution
      const resolvedProps = resolveLayerProps(props, layer);

      return layer.clone(resolvedProps);
    });
  };

  /**
   * Resolve layer props (handle function refs, filter params, etc.)
   */
  const resolveLayerProps = (props, existingLayer) => {
    const resolved = { ...props };

    // Handle getFillColor function reference
    if (typeof resolved.getFillColor === 'string' && resolved.getFillColor.startsWith('@@function')) {
      const func = resolveFunctionRef(resolved.getFillColor);
      if (func) {
        resolved.getFillColor = func;
      }
    }

    // Handle getPointRadius function reference
    if (typeof resolved.getPointRadius === 'string' && resolved.getPointRadius.startsWith('@@function')) {
      const func = resolveFunctionRef(resolved.getPointRadius);
      if (func) {
        resolved.getPointRadius = func;
      }
    }

    // Handle filter reset
    if (resolved._filterReset) {
      delete resolved._filterReset;
      // Restore original data from mapTools context
      const originalData = mapTools?.getOriginalData(existingLayer.id);
      if (originalData) {
        resolved.data = originalData;
        mapTools?.setActiveFilter(existingLayer.id, null);
      }
    }

    // Handle filter params
    if (resolved._filterParams) {
      const { property, operator, value } = resolved._filterParams;
      delete resolved._filterParams;

      // Store original data if not already stored
      const existingData = existingLayer.props?.data;
      if (existingData && mapTools) {
        mapTools.getOrSetOriginalData(existingLayer.id, existingData);
        const originalData = mapTools.getOriginalData(existingLayer.id);

        if (originalData) {
          const matcher = createPropertyMatcher(operator, value);
          const filteredData = filterFeatures(originalData, property, matcher);
          resolved.data = filteredData;
          mapTools.setActiveFilter(existingLayer.id, { property, operator, value });
        }
      }
    }

    return resolved;
  };

  /**
   * Add new layers from spec
   */
  const addNewLayers = (layerSpecs) => {
    if (!layerSpecs || layerSpecs.length === 0) return;

    const currentLayers = getCurrentLayers();
    const newLayers = [];

    for (const spec of layerSpecs) {
      // Check if layer already exists
      const existingIndex = currentLayers.findIndex((l) => l.id === spec.id);
      if (existingIndex >= 0) {
        console.warn(`Layer with id "${spec.id}" already exists, skipping add`);
        continue;
      }

      // Convert spec to layer using JSONConverter
      try {
        const converted = jsonConverter.convert({ layers: [spec] });
        if (converted.layers && converted.layers.length > 0) {
          newLayers.push(converted.layers[0]);
        }
      } catch (error) {
        console.error(`Failed to convert layer spec for "${spec.id}":`, error);
      }
    }

    if (newLayers.length > 0) {
      deck.setProps({ layers: [...currentLayers, ...newLayers] });
      scheduleRedraws(deck, REDRAW_PRESETS.dataUpdate);
    }
  };

  /**
   * Apply a complete @deck.gl/json spec
   */
  const applySpec = (spec) => {
    if (!spec) return { success: false, message: 'No spec provided' };

    try {
      // Apply view state changes
      if (spec.initialViewState) {
        applyViewState(spec.initialViewState);
      }

      // Add new layers first
      if (spec.layers && spec.layers.length > 0) {
        addNewLayers(spec.layers);
      }

      // Apply layer operations
      if (spec.layerOperations && spec.layerOperations.length > 0) {
        applyLayerOperations(spec.layerOperations);
      }

      return { success: true };
    } catch (error) {
      console.error('Error applying spec:', error);
      return { success: false, message: error.message };
    }
  };

  /**
   * Serialize current state to @deck.gl/json format
   */
  const serializeCurrentState = () => {
    const viewState = getCurrentViewState();
    const layers = getCurrentLayers();

    return {
      initialViewState: viewState,
      layerStates: layers.map((layer) => ({
        id: layer.id,
        type: layer.constructor.name,
        visible: layer.props.visible !== false,
        opacity: layer.props.opacity ?? 1,
      })),
    };
  };

  return {
    applySpec,
    applyViewState,
    applyLayerOperations,
    addNewLayers,
    getCurrentLayers,
    getCurrentViewState,
    serializeCurrentState,
    jsonConverter,
  };
}

export default createJsonSpecExecutor;
