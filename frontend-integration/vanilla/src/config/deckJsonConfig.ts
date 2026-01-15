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

import { JSONConverter, _parseExpressionString as parseExpressionString } from '@deck.gl/json';
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
  QuadbinTileLayer,
  RasterTileLayer,
  vectorTableSource,
  vectorQuerySource,
  vectorTilesetSource,
  h3TableSource,
  h3QuerySource,
  h3TilesetSource,
  quadbinTableSource,
  quadbinQuerySource,
  quadbinTilesetSource,
  rasterSource,
  colorBins,
  colorCategories,
  colorContinuous
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
   * Create a CARTO vector table source using the official CARTO API
   * Usage: { "@@function": "createVectorTableSource", "connectionName": "...", "tableName": "..." }
   * Note: Creates a proper CARTO data source instance for VectorTileLayer
   * @see https://docs.carto.com/carto-for-developers/reference/data-sources/vectortablesource
   */
  createVectorTableSource: (config: any) => {
    console.log('[createVectorTableSource] Input config:', config);
    console.log('[createVectorTableSource] Environment variables:', {
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_ACCESS_TOKEN: import.meta.env.VITE_API_ACCESS_TOKEN ? 'SET' : 'NOT SET'
    });

    // Get credentials from environment or config
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;

    if (!apiBaseUrl) {
      console.warn('[createVectorTableSource] WARNING: No API base URL provided or found in environment');
    }
    if (!accessToken) {
      console.warn('[createVectorTableSource] WARNING: No access token provided or found in environment');
    }

    // Use the CARTO vectorTableSource function to create a proper data source instance
    try {
      console.log('[createVectorTableSource] Calling vectorTableSource with:', {
        apiBaseUrl,
        accessToken: accessToken ? 'SET' : 'NOT SET',
        connectionName: config.connectionName || 'carto_dw',
        tableName: config.tableName,
        columns: config.columns,
        spatialDataColumn: config.spatialDataColumn
      });

      const dataSource = vectorTableSource({
        apiBaseUrl,
        accessToken,
        connectionName: config.connectionName || 'carto_dw',
        tableName: config.tableName,
        columns: config.columns,
        spatialDataColumn: config.spatialDataColumn
      });

      console.log('[createVectorTableSource] Created CARTO data source:', dataSource);
      console.log('[createVectorTableSource] Data source type:', typeof dataSource);
      console.log('[createVectorTableSource] Data source properties:', Object.keys(dataSource || {}));

      // The vectorTableSource returns a Promise that resolves to the data source
      // We need to return the Promise so VectorTileLayer can handle it
      return dataSource;
    } catch (error) {
      console.error('[createVectorTableSource] Failed to create data source:', error);
      throw error;
    }
  },

  /**
   * Wrapper for CARTO's vectorTableSource - used by tool executor
   * This name matches what the tool executor expects
   */
  vectorTableSource: (config: any) => {
    console.log('[vectorTableSource] Creating CARTO data source');
    return CUSTOM_FUNCTIONS.createVectorTableSource(config);
  },

  // ============================================================================
  // CARTO Data Sources (for JSONConverter @@function references)
  // ============================================================================

  /**
   * Vector query source - execute SQL query and get vector tiles
   * Usage: { "@@function": "vectorQuerySource", "sql": "SELECT * FROM ...", "connectionName": "..." }
   */
  vectorQuerySource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return vectorQuerySource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      sqlQuery: config.sqlQuery || config.sql,
      spatialDataColumn: config.spatialDataColumn,
    });
  },

  /**
   * Vector tileset source - use pre-computed vector tilesets
   */
  vectorTilesetSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return vectorTilesetSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
    });
  },

  /**
   * H3 table source - H3 hexagonal grid data from table
   */
  h3TableSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return h3TableSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
      aggregationExp: config.aggregationExp,
      aggregationResLevel: config.aggregationResLevel,
    });
  },

  /**
   * H3 query source - H3 hexagonal grid data from SQL query
   */
  h3QuerySource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return h3QuerySource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      sqlQuery: config.sqlQuery || config.sql,
      aggregationExp: config.aggregationExp,
      aggregationResLevel: config.aggregationResLevel,
    });
  },

  /**
   * H3 tileset source - pre-computed H3 tilesets
   */
  h3TilesetSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return h3TilesetSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
    });
  },

  /**
   * Quadbin table source - quadbin spatial index data from table
   */
  quadbinTableSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return quadbinTableSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
      aggregationExp: config.aggregationExp,
      aggregationResLevel: config.aggregationResLevel,
    });
  },

  /**
   * Quadbin query source - quadbin spatial index data from SQL query
   */
  quadbinQuerySource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return quadbinQuerySource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      sqlQuery: config.sqlQuery || config.sql,
      aggregationExp: config.aggregationExp,
      aggregationResLevel: config.aggregationResLevel,
    });
  },

  /**
   * Quadbin tileset source - pre-computed quadbin tilesets
   */
  quadbinTilesetSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return quadbinTilesetSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
    });
  },

  /**
   * Raster source - raster tile data
   */
  rasterSource: (config: any) => {
    const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL;
    const accessToken = config.accessToken || import.meta.env.VITE_API_ACCESS_TOKEN;
    return rasterSource({
      apiBaseUrl,
      accessToken,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
    });
  },

  // ============================================================================
  // CARTO Styling Functions (for JSONConverter @@function references)
  // ============================================================================

  /**
   * Color bins - assign colors based on value ranges (quantile, equal, etc.)
   * Usage: { "@@function": "colorBins", "attr": "population", "domain": [0, 1000, 10000], "colors": "Sunset" }
   */
  colorBins: (config: any) => {
    return colorBins({
      attr: config.attr,
      domain: config.domain,
      colors: config.colors || 'PurpOr',
      nullColor: config.nullColor,
    });
  },

  /**
   * Color categories - assign colors based on categorical values
   * Usage: { "@@function": "colorCategories", "attr": "type", "domain": ["A", "B", "C"], "colors": ["red", "green", "blue"] }
   */
  colorCategories: (config: any) => {
    return colorCategories({
      attr: config.attr,
      domain: config.domain,
      colors: config.colors || 'Bold',
      nullColor: config.nullColor,
      othersColor: config.othersColor,
    });
  },

  /**
   * Color continuous - assign colors based on continuous value interpolation
   * Usage: { "@@function": "colorContinuous", "attr": "temperature", "domain": [0, 100], "colors": "Temps" }
   */
  colorContinuous: (config: any) => {
    return colorContinuous({
      attr: config.attr,
      domain: config.domain,
      colors: config.colors || 'Sunset',
      nullColor: config.nullColor,
    });
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
    RasterTileLayer,
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

    // Complex expressions (ternary, comparisons, etc.) - delegate to native deck.gl/json expression parser
    try {
      const func = parseExpressionString(expr, deckJsonConfiguration);
      if (func && typeof func === 'function') {
        console.log(`[deckJsonConfig] Compiled @@= expression: ${expr.substring(0, 50)}...`);
        return func;
      }
    } catch (e) {
      console.warn(`[deckJsonConfig] Failed to parse @@= expression: ${expr}`, e);
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