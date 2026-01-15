import { LAYER_NAME_MAP } from '../../config/constants';

/**
 * Layer manipulation utilities for deck.gl
 * Centralizes the repeated layer find/update patterns
 */

/**
 * Find a layer by its ID (with null safety)
 *
 * @param {Array} layers - Array of deck.gl layers
 * @param {string} layerId - The layer ID to find
 * @returns {Object|undefined} The found layer or undefined
 */
export function findLayerById(layers, layerId) {
  if (!layers || !Array.isArray(layers)) {
    return undefined;
  }
  return layers.find((layer) => layer && layer.id === layerId);
}

/**
 * Resolve a layer name to its ID using the name map
 * Handles case-insensitive lookups
 *
 * @param {string} layerName - The layer name (e.g., "airports", "points")
 * @returns {string} The resolved layer ID
 */
export function resolveLayerId(layerName) {
  if (!layerName) return layerName;
  const normalizedName = layerName.toLowerCase();
  return LAYER_NAME_MAP[normalizedName] || normalizedName;
}

/**
 * Update a specific layer in the layers array
 *
 * @param {Array} layers - Array of deck.gl layers
 * @param {string} layerId - The layer ID to update
 * @param {Function} updateFn - Function that receives the layer and returns updated layer
 * @returns {Array} New array with the updated layer
 */
export function updateLayer(layers, layerId, updateFn) {
  if (!layers || !Array.isArray(layers)) {
    return layers;
  }

  return layers.map((layer) => {
    if (layer && layer.id === layerId) {
      return updateFn(layer);
    }
    return layer;
  });
}

/**
 * Clone a layer with new properties
 *
 * @param {Object} layer - The deck.gl layer to clone
 * @param {Object} props - New properties to apply
 * @returns {Object} Cloned layer with new properties
 */
export function cloneLayerWithProps(layer, props) {
  if (!layer || typeof layer.clone !== 'function') {
    return layer;
  }
  return layer.clone(props);
}

/**
 * Sync MapLibre view state with deck.gl
 *
 * @param {Object} map - MapLibre GL map instance
 * @param {Object} viewState - View state object with longitude, latitude, zoom, etc.
 * @param {Object} options - Additional options
 * @param {boolean} options.animate - Whether to animate the transition (flyTo vs jumpTo)
 * @param {number} options.duration - Animation duration in ms (for animate=true)
 */
export function syncMapLibreView(map, viewState, options = {}) {
  if (!map) return;

  const { animate = false, duration = 1000, bearing = 0, pitch = 0 } = options;

  const mapOptions = {
    center: [viewState.longitude, viewState.latitude],
    zoom: viewState.zoom,
    bearing: viewState.bearing ?? bearing,
    pitch: viewState.pitch ?? pitch,
  };

  if (animate) {
    map.flyTo({ ...mapOptions, duration });
  } else {
    map.jumpTo(mapOptions);
  }
}

/**
 * Check if a layer exists in the layers array
 *
 * @param {Array} layers - Array of deck.gl layers
 * @param {string} layerId - The layer ID to check
 * @returns {boolean} Whether the layer exists
 */
export function layerExists(layers, layerId) {
  return findLayerById(layers, layerId) !== undefined;
}

/**
 * Get layer data (GeoJSON) from a layer
 *
 * @param {Object} layer - The deck.gl layer
 * @returns {Object|null} The layer's data or null
 */
export function getLayerData(layer) {
  if (!layer || !layer.props) {
    return null;
  }
  return layer.props.data;
}
