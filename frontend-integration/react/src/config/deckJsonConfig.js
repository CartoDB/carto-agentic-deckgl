/**
 * @deck.gl/json Configuration
 *
 * This configuration sets up the JSONConverter with all the classes,
 * functions, and constants needed to convert @deck.gl/json specs into
 * deck.gl layer and view state props.
 */

import { JSONConverter } from '@deck.gl/json';
import { GeoJsonLayer, ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
import { RasterTileLayer, rasterSource, vectorTableSource } from '@deck.gl/carto';
import { FlyToInterpolator, LinearInterpolator } from '@deck.gl/core';

/**
 * CARTO configuration loaded from environment variables
 */
const getCartoConfig = () => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://gcp-us-east1.api.carto.com',
  accessToken: import.meta.env.VITE_API_ACCESS_TOKEN || '',
});

/**
 * Custom accessor functions for @deck.gl/json
 * These are referenced in specs using @@function prefix
 */
const accessorFunctions = {
  /**
   * Get color based on a property value
   * Usage in spec: "@@function/getColorByProperty"
   */
  getColorByProperty: ({ property, operator, colorMap, defaultColor }) => {
    const defaultRgba = defaultColor || [128, 128, 128, 180];

    return (d) => {
      if (!d || !d.properties) return defaultRgba;
      const propValue = d.properties[property];
      if (propValue === undefined || propValue === null) return defaultRgba;

      // Check each color mapping
      for (const [matchValue, color] of Object.entries(colorMap)) {
        let matches = false;

        switch (operator) {
          case 'equals':
            matches = String(propValue) === String(matchValue);
            break;
          case 'startsWith':
            matches = String(propValue).startsWith(matchValue);
            break;
          case 'contains':
            matches = String(propValue).includes(matchValue);
            break;
          case 'regex':
            try {
              matches = new RegExp(matchValue).test(String(propValue));
            } catch {
              matches = false;
            }
            break;
          default:
            matches = String(propValue) === String(matchValue);
        }

        if (matches) return color;
      }

      return defaultRgba;
    };
  },

  /**
   * Get size based on a property value
   * Usage in spec: "@@function/getSizeByProperty"
   */
  getSizeByProperty: ({ property, sizeMap, defaultSize }) => {
    const defSize = defaultSize || 8;

    return (d) => {
      if (!d || !d.properties) return defSize;
      const propValue = d.properties[property];
      if (propValue === undefined || propValue === null) return defSize;

      const size = sizeMap[String(propValue)];
      return size !== undefined ? size : defSize;
    };
  },

  /**
   * Create a CARTO raster source
   * Usage in spec: "@@function/rasterSource"
   */
  rasterSource: (config) => {
    const cartoConfig = getCartoConfig();
    return rasterSource({
      ...cartoConfig,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
    });
  },

  /**
   * Create a CARTO vector table source
   * Usage in spec: "@@function/vectorTableSource"
   */
  vectorTableSource: (config) => {
    const cartoConfig = getCartoConfig();
    return vectorTableSource({
      ...cartoConfig,
      connectionName: config.connectionName || 'carto_dw',
      tableName: config.tableName,
      columns: config.columns,
      spatialDataColumn: config.spatialDataColumn,
    });
  },

  /**
   * Temperature color function for raster data
   * Usage in spec: "@@function/temperatureColor"
   */
  temperatureColor: () => {
    return (d) => {
      if (!d || !d.properties) return [128, 128, 128];
      const { band_1 } = d.properties;
      if (band_1 === undefined) return [128, 128, 128];
      // Color scale: blue (cold) -> red (hot)
      return [10 * (band_1 - 20), 0, 300 - 5 * band_1];
    };
  },
};

/**
 * @deck.gl/json configuration object
 */
export const deckJsonConfiguration = {
  // Layer classes
  classes: {
    GeoJsonLayer,
    ScatterplotLayer,
    ArcLayer,
    RasterTileLayer,
  },

  // Accessor and data source functions
  functions: accessorFunctions,

  // Constants and interpolators
  constants: {
    FlyToInterpolator: new FlyToInterpolator(),
    LinearInterpolator: new LinearInterpolator(),
  },

  // Enumerations (for COORDINATE_SYSTEM etc if needed)
  enumerations: {},
};

/**
 * Create a configured JSONConverter instance
 */
export function createJsonConverter() {
  return new JSONConverter({ configuration: deckJsonConfiguration });
}

/**
 * Parse a function reference string and extract the function name and args
 * Example: "@@function/getColorByProperty({...})" -> { name: "getColorByProperty", args: {...} }
 */
export function parseFunctionRef(ref) {
  if (!ref || typeof ref !== 'string' || !ref.startsWith('@@function/')) {
    return null;
  }

  const content = ref.slice('@@function/'.length);
  const parenIndex = content.indexOf('(');

  if (parenIndex === -1) {
    return { name: content, args: null };
  }

  const funcName = content.slice(0, parenIndex);
  const argsStr = content.slice(parenIndex + 1, -1); // Remove opening and closing parens

  try {
    const args = JSON.parse(argsStr);
    return { name: funcName, args };
  } catch {
    return { name: funcName, args: null };
  }
}

/**
 * Resolve a function reference to an actual function
 */
export function resolveFunctionRef(ref) {
  const parsed = parseFunctionRef(ref);
  if (!parsed) return null;

  const func = accessorFunctions[parsed.name];
  if (!func) return null;

  return parsed.args ? func(parsed.args) : func;
}

/**
 * Resolve an interpolator reference
 * @param {string|Object} ref - Interpolator name or config object
 * @returns {Object} Interpolator instance
 */
export function resolveInterpolator(ref) {
  if (!ref) return null;

  // String reference: "FlyToInterpolator" or "LinearInterpolator"
  if (typeof ref === 'string') {
    const name = ref.replace('@@#', '');
    return deckJsonConfiguration.constants[name] || null;
  }

  // Object with @@type for custom config
  if (typeof ref === 'object' && ref['@@type']) {
    const typeName = ref['@@type'];
    if (typeName === 'LinearInterpolator' && ref.transitionProps) {
      return new LinearInterpolator({ transitionProps: ref.transitionProps });
    }
    return deckJsonConfiguration.constants[typeName] || null;
  }

  return null;
}

/**
 * Create a LinearInterpolator for specific properties
 * @param {string[]} transitionProps - Properties to interpolate
 * @returns {LinearInterpolator} Interpolator instance
 */
export function createLinearInterpolator(transitionProps) {
  return new LinearInterpolator({ transitionProps });
}

/**
 * Resolve a value that may contain @@ references
 * @param {*} value - Value to resolve
 * @returns {*} Resolved value
 */
export function resolveValue(value) {
  if (!value) return value;

  // String constant reference
  if (typeof value === 'string' && value.startsWith('@@#')) {
    const constName = value.slice(3);
    return deckJsonConfiguration.constants[constName] ?? value;
  }

  // Object with nested @@ references
  if (typeof value === 'object' && !Array.isArray(value)) {
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveValue(val);
    }
    return resolved;
  }

  return value;
}

/**
 * Resolve a color value (name, array, or @@ reference)
 * @param {string|Array} color - Color to resolve
 * @returns {Array} RGBA color array
 */
export function resolveColor(color) {
  if (Array.isArray(color)) return color;
  if (typeof color === 'string' && color.startsWith('@@#')) {
    const constName = color.slice(3);
    return deckJsonConfiguration.constants[constName] ?? [128, 128, 128, 180];
  }
  // Return as-is for named colors or other formats
  return color;
}

export default deckJsonConfiguration;
