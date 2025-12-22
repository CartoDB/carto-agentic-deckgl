/**
 * @deck.gl/json Configuration for sdsc-2025-congestion
 *
 * Provides full JSONConverter integration for:
 * - @@# constant references (colors, interpolators)
 * - @@= accessor expressions
 * - @@function custom function calls
 * - @@type class instantiation
 *
 * @see https://deck.gl/docs/api-reference/json/conversion-reference
 */

import { JSONConverter } from '@deck.gl/json';
import { FlyToInterpolator, LinearInterpolator, COORDINATE_SYSTEM } from '@deck.gl/core';
import { Tile3DLayer, TripsLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, PathLayer, ScatterplotLayer, IconLayer, ArcLayer, LineLayer } from '@deck.gl/layers';

/**
 * Color constants for JSONConverter @@# references
 * Usage in JSON: "@@#Red", "@@#Blue", etc.
 */
const COLOR_CONSTANTS = {
  // Primary colors
  Red: [255, 0, 0, 200],
  Green: [0, 255, 0, 200],
  Blue: [0, 0, 255, 200],
  // Secondary colors
  Yellow: [255, 255, 0, 200],
  Orange: [255, 165, 0, 200],
  Purple: [128, 0, 128, 200],
  Pink: [255, 192, 203, 200],
  Cyan: [0, 255, 255, 200],
  Magenta: [255, 0, 255, 200],
  // Neutral colors
  White: [255, 255, 255, 255],
  Black: [0, 0, 0, 255],
  Gray: [128, 128, 128, 200],
  LightGray: [192, 192, 192, 200],
  DarkGray: [64, 64, 64, 200],
  // Semantic colors
  Success: [16, 185, 129, 200],
  Warning: [245, 158, 11, 200],
  Error: [239, 68, 68, 200],
  Info: [59, 130, 246, 200],
  // Transparent
  Transparent: [0, 0, 0, 0],
};

/**
 * Custom functions for JSONConverter @@function references
 * Usage in JSON: { "@@function": "functionName", "arg1": value }
 */
const CUSTOM_FUNCTIONS = {
  /**
   * Create a color with custom alpha
   * Usage: { "@@function": "colorWithAlpha", "color": "Red", "alpha": 128 }
   */
  colorWithAlpha: ({ color, alpha }) => {
    const baseColor = typeof color === 'string'
      ? COLOR_CONSTANTS[color] || [128, 128, 128, 200]
      : color;
    return [baseColor[0], baseColor[1], baseColor[2], alpha];
  },

  /**
   * Scale a value by a factor
   * Usage: { "@@function": "scale", "value": 10, "factor": 2 }
   */
  scale: ({ value, factor }) => value * factor,

  /**
   * Clamp a value between min and max
   * Usage: { "@@function": "clamp", "value": 150, "min": 0, "max": 100 }
   */
  clamp: ({ value, min, max }) => Math.max(min, Math.min(max, value)),

  /**
   * Linear interpolation between two values
   * Usage: { "@@function": "lerp", "a": 0, "b": 100, "t": 0.5 }
   */
  lerp: ({ a, b, t }) => a + (b - a) * t,

  /**
   * Create accessor function for property-based coloring
   * Usage: { "@@function": "propertyColor", "property": "value", "colorScale": [...] }
   */
  propertyColor: ({ property, min, max, lowColor, highColor }) => {
    const low = typeof lowColor === 'string' ? COLOR_CONSTANTS[lowColor] : lowColor;
    const high = typeof highColor === 'string' ? COLOR_CONSTANTS[highColor] : highColor;
    return (d) => {
      const value = d.properties?.[property] ?? d[property] ?? 0;
      const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
      return [
        Math.round(low[0] + (high[0] - low[0]) * t),
        Math.round(low[1] + (high[1] - low[1]) * t),
        Math.round(low[2] + (high[2] - low[2]) * t),
        Math.round((low[3] ?? 255) + ((high[3] ?? 255) - (low[3] ?? 255)) * t),
      ];
    };
  },
};

/**
 * @deck.gl/json configuration object
 * This is passed to JSONConverter for resolving all @@ references
 */
export const deckJsonConfiguration = {
  // Layer classes for @@type references
  classes: {
    GeoJsonLayer,
    PathLayer,
    TripsLayer,
    Tile3DLayer,
    ScatterplotLayer,
    IconLayer,
    ArcLayer,
    LineLayer,
    // Interpolators as classes (can be instantiated)
    FlyToInterpolator,
    LinearInterpolator,
  },

  // Constants for @@# references
  constants: {
    // Interpolator instances
    FlyToInterpolator: new FlyToInterpolator(),
    LinearInterpolator: new LinearInterpolator(),
    // All color constants
    ...COLOR_CONSTANTS,
  },

  // Functions for @@function references
  functions: CUSTOM_FUNCTIONS,

  // Enumerations for @@#ENUM.VALUE references
  enumerations: {
    COORDINATE_SYSTEM,
  },
};

/**
 * Singleton JSONConverter instance
 * Use this for all JSON-to-props conversions
 */
let jsonConverterInstance = null;

/**
 * Get or create the JSONConverter singleton
 * @returns {JSONConverter} Configured JSONConverter instance
 */
export function getJsonConverter() {
  if (!jsonConverterInstance) {
    jsonConverterInstance = new JSONConverter({ configuration: deckJsonConfiguration });
  }
  return jsonConverterInstance;
}

/**
 * Create a new JSONConverter instance (non-singleton)
 * Use when you need isolated conversion
 * @returns {JSONConverter} New JSONConverter instance
 */
export function createJsonConverter() {
  return new JSONConverter({ configuration: deckJsonConfiguration });
}

/**
 * Convert a JSON spec to deck.gl props using JSONConverter
 * This is the primary method for converting layer/view specs
 *
 * @param {Object} jsonSpec - JSON specification with @@ references
 * @returns {Object} Resolved deck.gl props
 *
 * @example
 * // Convert a full deck spec
 * const props = convertJson({
 *   initialViewState: { longitude: -122.4, latitude: 37.8, zoom: 12 },
 *   layers: [{ "@@type": "GeoJsonLayer", data: "...", getFillColor: "@@#Red" }]
 * });
 *
 * @example
 * // Convert layer props only
 * const layerProps = convertJson({
 *   getFillColor: "@@#Blue",
 *   getLineColor: { "@@function": "colorWithAlpha", "color": "Red", "alpha": 128 }
 * });
 */
export function convertJson(jsonSpec) {
  const converter = getJsonConverter();
  return converter.convert(jsonSpec);
}

/**
 * Convert layer style props, resolving all @@ references
 * Specialized for partial layer updates (not full deck specs)
 *
 * @param {Object} styleProps - Style properties with potential @@ references
 * @returns {Object} Resolved style properties
 *
 * @example
 * const resolved = convertLayerStyle({
 *   getFillColor: "@@#Red",
 *   opacity: 0.8,
 *   getLineWidth: { "@@function": "scale", "value": 5, "factor": 2 }
 * });
 * // Returns: { getFillColor: [255,0,0,200], opacity: 0.8, getLineWidth: 10 }
 */
export function convertLayerStyle(styleProps) {
  const converter = getJsonConverter();

  // Wrap in a minimal structure that JSONConverter can process
  // then extract just the layer props we care about
  const wrappedSpec = {
    layers: [{
      '@@type': 'GeoJsonLayer', // Dummy type for conversion
      id: '__temp__',
      data: [],
      ...styleProps,
    }],
  };

  try {
    const converted = converter.convert(wrappedSpec);
    if (converted.layers && converted.layers[0]) {
      const { id, data, ...resolvedProps } = converted.layers[0].props || converted.layers[0];
      return resolvedProps;
    }
  } catch (e) {
    console.warn('[deckJsonConfig] JSONConverter.convert() failed, falling back to manual resolution:', e.message);
  }

  // Fallback: manual resolution for simpler cases
  return resolveValue(styleProps);
}

/**
 * Recursively resolve @@ references in any value
 * Handles nested objects and arrays
 *
 * @param {any} value - Value that may contain @@ references
 * @returns {any} Resolved value
 */
export function resolveValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle @@# constant reference
  if (typeof value === 'string' && value.startsWith('@@#')) {
    const constName = value.slice(3);
    // Check for enum.value format
    if (constName.includes('.')) {
      const [enumName, enumValue] = constName.split('.');
      const enumObj = deckJsonConfiguration.enumerations[enumName];
      if (enumObj && enumObj[enumValue] !== undefined) {
        return enumObj[enumValue];
      }
    }
    // Regular constant lookup
    const resolved = deckJsonConfiguration.constants[constName];
    return resolved !== undefined ? resolved : value;
  }

  // Handle @@function call
  if (typeof value === 'object' && value['@@function']) {
    const funcName = value['@@function'];
    const func = deckJsonConfiguration.functions[funcName];
    if (func) {
      const { '@@function': _, ...args } = value;
      return func(args);
    }
    console.warn(`[deckJsonConfig] Unknown function: ${funcName}`);
    return null;
  }

  // Handle @@type class instantiation
  if (typeof value === 'object' && value['@@type']) {
    const className = value['@@type'];
    const ClassRef = deckJsonConfiguration.classes[className];
    if (ClassRef) {
      const { '@@type': _, ...args } = value;
      const resolvedArgs = resolveValue(args);
      return new ClassRef(resolvedArgs);
    }
    console.warn(`[deckJsonConfig] Unknown class: ${className}`);
    return null;
  }

  // Handle @@= accessor expression (simplified - creates property accessor)
  if (typeof value === 'string' && value.startsWith('@@=')) {
    const expr = value.slice(3);
    if (expr === '-') {
      return (d) => d; // Return datum unchanged
    }
    // Simple property accessor: "@@=propertyName"
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      return (d) => d.properties?.[expr] ?? d[expr];
    }
    // Array accessor: "@@=[lng, lat]"
    const arrayMatch = expr.match(/^\[([^\]]+)\]$/);
    if (arrayMatch) {
      const props = arrayMatch[1].split(',').map((p) => p.trim());
      return (d) => props.map((p) => d.properties?.[p] ?? d[p]);
    }
    console.warn(`[deckJsonConfig] Unsupported @@= expression: ${expr}`);
    return value;
  }

  // Recursively resolve arrays
  if (Array.isArray(value)) {
    return value.map(resolveValue);
  }

  // Recursively resolve objects
  if (typeof value === 'object') {
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val);
    }
    return resolved;
  }

  return value;
}

/**
 * Resolve an interpolator reference to an actual interpolator instance
 * Supports @@# format, string names, and @@type instantiation
 *
 * @param {string|Object} ref - Interpolator reference
 * @returns {FlyToInterpolator|LinearInterpolator|null} The interpolator instance
 *
 * @example
 * resolveInterpolator("@@#FlyToInterpolator")
 * resolveInterpolator("FlyToInterpolator")
 * resolveInterpolator({ "@@type": "LinearInterpolator", "transitionProps": ["bearing"] })
 */
export function resolveInterpolator(ref) {
  if (!ref) return null;

  // Handle @@type object
  if (typeof ref === 'object' && ref['@@type']) {
    return resolveValue(ref);
  }

  if (typeof ref !== 'string') return null;

  // Handle @@# format
  const cleanRef = ref.startsWith('@@#') ? ref.slice(3) : ref;

  switch (cleanRef) {
    case 'FlyToInterpolator':
      return new FlyToInterpolator();
    case 'LinearInterpolator':
      return new LinearInterpolator();
    default:
      return null;
  }
}

/**
 * Create a LinearInterpolator for specific properties
 *
 * @param {string[]} properties - Properties to interpolate
 * @returns {LinearInterpolator} Configured linear interpolator
 */
export function createLinearInterpolator(properties = ['bearing', 'pitch']) {
  return new LinearInterpolator(properties);
}

/**
 * Resolve a color value - handles color names, @@# refs, and RGBA arrays
 *
 * @param {string|number[]} color - Color specification
 * @returns {number[]} RGBA array [r, g, b, a]
 *
 * @example
 * resolveColor("red")        // [255, 0, 0, 200]
 * resolveColor("@@#Blue")    // [0, 0, 255, 200]
 * resolveColor([255, 0, 0])  // [255, 0, 0, 255]
 */
export function resolveColor(color) {
  if (Array.isArray(color)) {
    // Ensure alpha channel
    return color.length === 3 ? [...color, 255] : color;
  }

  if (typeof color === 'string') {
    // Handle @@# format
    if (color.startsWith('@@#')) {
      const constName = color.slice(3);
      return COLOR_CONSTANTS[constName] || [128, 128, 128, 200];
    }

    // Case-insensitive color name lookup
    const colorName = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    return COLOR_CONSTANTS[colorName] || [128, 128, 128, 200];
  }

  return [128, 128, 128, 200]; // Default gray
}

/**
 * Get all available color constant names
 * @returns {string[]} Array of color constant names
 */
export function getColorConstantNames() {
  return Object.keys(COLOR_CONSTANTS);
}

/**
 * Legacy alias for resolveValue (backwards compatibility)
 * @deprecated Use resolveValue instead
 */
export const resolveLayerProps = resolveValue;

export default deckJsonConfiguration;
