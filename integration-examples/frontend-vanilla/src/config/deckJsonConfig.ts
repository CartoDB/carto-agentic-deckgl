/**
 * @deck.gl/json Configuration for frontend-vanilla
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
import {
  GeoJsonLayer,
  PathLayer,
  ScatterplotLayer,
  IconLayer,
  ArcLayer,
  LineLayer,
  PolygonLayer,
  PointCloudLayer,
  TextLayer
} from '@deck.gl/layers';
import {
  VectorTileLayer,
  H3TileLayer,
  QuadbinTileLayer
} from '@deck.gl/carto';

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
  // Additional colors
  Brown: [139, 69, 19, 200],
  Navy: [0, 0, 128, 200],
  Olive: [128, 128, 0, 200],
  Teal: [0, 128, 128, 200],
  Silver: [192, 192, 192, 200],
  Gold: [255, 215, 0, 200],
  Indigo: [75, 0, 130, 200],
  Violet: [238, 130, 238, 200],
  // CARTO brand colors
  CartoPrimary: [3, 111, 226, 200], // CARTO blue
  CartoSecondary: [255, 255, 255, 255],
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
  colorWithAlpha: ({ color, alpha }: { color: string | number[], alpha: number }) => {
    const baseColor = typeof color === 'string'
      ? COLOR_CONSTANTS[color as keyof typeof COLOR_CONSTANTS] || [128, 128, 128, 200]
      : color;
    return [baseColor[0], baseColor[1], baseColor[2], alpha];
  },

  /**
   * Scale a value by a factor
   * Usage: { "@@function": "scale", "value": 10, "factor": 2 }
   */
  scale: ({ value, factor }: { value: number, factor: number }) => value * factor,

  /**
   * Clamp a value between min and max
   * Usage: { "@@function": "clamp", "value": 150, "min": 0, "max": 100 }
   */
  clamp: ({ value, min, max }: { value: number, min: number, max: number }) =>
    Math.max(min, Math.min(max, value)),

  /**
   * Linear interpolation between two values
   * Usage: { "@@function": "lerp", "a": 0, "b": 100, "t": 0.5 }
   */
  lerp: ({ a, b, t }: { a: number, b: number, t: number }) => a + (b - a) * t,

  /**
   * Create accessor function for property-based coloring
   * Usage: { "@@function": "propertyColor", "property": "value", "min": 0, "max": 100, "lowColor": "Blue", "highColor": "Red" }
   */
  propertyColor: ({
    property,
    min,
    max,
    lowColor,
    highColor
  }: {
    property: string,
    min: number,
    max: number,
    lowColor: string | number[],
    highColor: string | number[]
  }) => {
    const low = typeof lowColor === 'string'
      ? COLOR_CONSTANTS[lowColor as keyof typeof COLOR_CONSTANTS]
      : lowColor;
    const high = typeof highColor === 'string'
      ? COLOR_CONSTANTS[highColor as keyof typeof COLOR_CONSTANTS]
      : highColor;

    return (d: any) => {
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

  /**
   * Create a CARTO vector tile source
   * Usage: { "@@function": "cartoVectorTileSource", "connectionName": "...", "tableName": "..." }
   * Note: Returns configuration object for VectorTileLayer data prop
   */
  cartoVectorTileSource: (config: any) => {
    // Get credentials from environment or config
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_CARTO_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_CARTO_ACCESS_TOKEN;

    // Return configuration for VectorTileLayer
    return {
      type: 'vector',
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
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
    // Core layers
    GeoJsonLayer,
    PathLayer,
    ScatterplotLayer,
    IconLayer,
    ArcLayer,
    LineLayer,
    PolygonLayer,
    PointCloudLayer,
    TextLayer,
    // Geo layers
    TripsLayer,
    Tile3DLayer,
    // CARTO layers
    VectorTileLayer,
    H3TileLayer,
    QuadbinTileLayer,
    // Interpolators as classes
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
 */
let jsonConverterInstance: JSONConverter | null = null;

/**
 * Get or create the JSONConverter singleton
 */
export function getJsonConverter(): JSONConverter {
  if (!jsonConverterInstance) {
    jsonConverterInstance = new JSONConverter({ configuration: deckJsonConfiguration });
  }
  return jsonConverterInstance;
}

/**
 * Create a new JSONConverter instance (non-singleton)
 */
export function createJsonConverter(): JSONConverter {
  return new JSONConverter({ configuration: deckJsonConfiguration });
}

/**
 * Convert a JSON spec to deck.gl props using JSONConverter
 */
export function convertJson(jsonSpec: any): any {
  const converter = getJsonConverter();
  return converter.convert(jsonSpec);
}

/**
 * Convert layer style props, resolving all @@ references
 */
export function convertLayerStyle(styleProps: any): any {
  const converter = getJsonConverter();

  // Wrap in a minimal structure that JSONConverter can process
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
  } catch (e: any) {
    console.warn('[deckJsonConfig] JSONConverter.convert() failed, falling back to manual resolution:', e.message);
  }

  // Fallback: manual resolution for simpler cases
  return resolveValue(styleProps);
}

/**
 * Recursively resolve @@ references in any value
 */
export function resolveValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle @@# constant reference
  if (typeof value === 'string' && value.startsWith('@@#')) {
    const constName = value.slice(3);
    // Check for enum.value format
    if (constName.includes('.')) {
      const [enumName, enumValue] = constName.split('.');
      const enumObj = deckJsonConfiguration.enumerations[enumName as keyof typeof deckJsonConfiguration.enumerations];
      if (enumObj && enumObj[enumValue as keyof typeof enumObj] !== undefined) {
        return enumObj[enumValue as keyof typeof enumObj];
      }
    }
    // Regular constant lookup
    const resolved = deckJsonConfiguration.constants[constName as keyof typeof deckJsonConfiguration.constants];
    return resolved !== undefined ? resolved : value;
  }

  // Handle @@function call
  if (typeof value === 'object' && value['@@function']) {
    const funcName = value['@@function'];
    const func = deckJsonConfiguration.functions[funcName as keyof typeof deckJsonConfiguration.functions];
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
    const ClassRef = deckJsonConfiguration.classes[className as keyof typeof deckJsonConfiguration.classes];
    if (ClassRef) {
      const { '@@type': _, ...args } = value;
      const resolvedArgs = resolveValue(args);
      return new ClassRef(resolvedArgs);
    }
    console.warn(`[deckJsonConfig] Unknown class: ${className}`);
    return null;
  }

  // Handle @@= accessor expression
  if (typeof value === 'string' && value.startsWith('@@=')) {
    const expr = value.slice(3);
    if (expr === '-') {
      return (d: any) => d; // Return datum unchanged
    }
    // Simple property accessor: "@@=propertyName"
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      return (d: any) => d.properties?.[expr] ?? d[expr];
    }
    // Array accessor: "@@=[lng, lat]"
    const arrayMatch = expr.match(/^\[([^\]]+)\]$/);
    if (arrayMatch) {
      const props = arrayMatch[1].split(',').map((p) => p.trim());
      return (d: any) => props.map((p) => d.properties?.[p] ?? d[p]);
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
    const resolved: any = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val);
    }
    return resolved;
  }

  return value;
}

/**
 * Resolve an interpolator reference to an actual interpolator instance
 */
export function resolveInterpolator(ref: any): any {
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
 */
export function createLinearInterpolator(properties: string[] = ['bearing', 'pitch']): LinearInterpolator {
  return new LinearInterpolator(properties);
}

/**
 * Resolve a color value - handles color names, @@# refs, and RGBA arrays
 */
export function resolveColor(color: string | number[]): number[] {
  if (Array.isArray(color)) {
    // Ensure alpha channel
    return color.length === 3 ? [...color, 255] : color;
  }

  if (typeof color === 'string') {
    // Handle @@# format
    if (color.startsWith('@@#')) {
      const constName = color.slice(3);
      return COLOR_CONSTANTS[constName as keyof typeof COLOR_CONSTANTS] || [128, 128, 128, 200];
    }

    // Case-insensitive color name lookup
    const colorName = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    return COLOR_CONSTANTS[colorName as keyof typeof COLOR_CONSTANTS] || [128, 128, 128, 200];
  }

  return [128, 128, 128, 200]; // Default gray
}

/**
 * Get all available color constant names
 */
export function getColorConstantNames(): string[] {
  return Object.keys(COLOR_CONSTANTS);
}

/**
 * Format color for JSONConverter (adds @@# prefix if it's a known color name)
 */
export function formatColorForConverter(color: string | number[]): string | number[] {
  if (typeof color === 'string') {
    // If it's already in @@# format, return as is
    if (color.startsWith('@@#')) {
      return color;
    }
    // If it's a known color name, add @@# prefix
    const colorName = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    if (COLOR_CONSTANTS[colorName as keyof typeof COLOR_CONSTANTS]) {
      return `@@#${colorName}`;
    }
  }
  return color;
}

export default deckJsonConfiguration;