/**
 * Update Layer Style - Helper for UPDATE_LAYER_STYLE tool
 *
 * Provides color resolution and layer style spec execution for
 * the UPDATE_LAYER_STYLE tool that accepts color names and @@# references.
 */

/**
 * Color name to RGBA mapping
 * Supports common color names that can be used in tool parameters
 */
const COLOR_MAP = {
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
  Grey: [128, 128, 128, 200],
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
 * Resolve a color value to RGBA array
 * Supports color names, @@# references, and RGBA arrays
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
    const name = color.startsWith('@@#') ? color.slice(3) : color;
    // Normalize to title case
    const normalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    return COLOR_MAP[normalized] || [128, 128, 128, 200];
  }

  return [128, 128, 128, 200]; // Default gray
}

/**
 * Valid CARTO color scheme names
 */
export const CARTO_COLOR_SCHEMES = {
  // Sequential
  Burg: 'Burg', BurgYl: 'BurgYl', RedOr: 'RedOr', OrYel: 'OrYel',
  Peach: 'Peach', PinkYl: 'PinkYl', Mint: 'Mint', BluGrn: 'BluGrn',
  DarkMint: 'DarkMint', Emrld: 'Emrld', BluYl: 'BluYl', Teal: 'Teal',
  TealGrn: 'TealGrn', Purp: 'Purp', PurpOr: 'PurpOr', Sunset: 'Sunset',
  Magenta: 'Magenta', SunsetDark: 'SunsetDark', BrwnYl: 'BrwnYl',
  // Diverging
  ArmyRose: 'ArmyRose', Fall: 'Fall', Geyser: 'Geyser', Temps: 'Temps',
  TealRose: 'TealRose', Tropic: 'Tropic', Earth: 'Earth',
  // Qualitative
  Antique: 'Antique', Bold: 'Bold', Pastel: 'Pastel', Prism: 'Prism',
  Safe: 'Safe', Vivid: 'Vivid',
};

/**
 * Build a deck.gl layer props object from tool parameters
 * Maps tool-friendly parameter names to deck.gl property names
 *
 * @param {Object} params - Tool parameters
 * @returns {Object} deck.gl layer props with special handling for colorScheme
 */
function buildLayerProps(params) {
  const {
    // CARTO color scheme
    colorScheme,
    // Color properties
    fillColor,
    lineColor,
    // Opacity & visibility
    opacity,
    visible,
    // Line/stroke width
    lineWidth,
    lineWidthMinPixels,
    lineWidthMaxPixels,
    // Point/circle radius
    pointRadius,
    radiusMinPixels,
    radiusMaxPixels,
    // Boolean style flags
    stroked,
    filled,
    // Elevation/3D properties
    elevation,
    elevationScale,
    extruded,
    wireframe,
  } = params;

  const props = {};

  // CARTO color scheme - pass through for special handling in executor
  if (colorScheme !== undefined) {
    // Validate color scheme name
    const normalizedScheme = Object.keys(CARTO_COLOR_SCHEMES).find(
      k => k.toLowerCase() === colorScheme.toLowerCase()
    );
    if (normalizedScheme) {
      props._colorScheme = normalizedScheme;
    } else {
      console.warn(`[updateLayerStyle] Unknown color scheme: ${colorScheme}, using PurpOr`);
      props._colorScheme = 'PurpOr';
    }
  }

  // Color properties - resolve color names to RGBA
  if (fillColor !== undefined) {
    const resolved = resolveColor(fillColor);
    props.getFillColor = resolved;
    props.getColor = resolved; // For ScatterplotLayer
  }

  if (lineColor !== undefined) {
    const resolved = resolveColor(lineColor);
    props.getLineColor = resolved;
  }

  // Opacity & visibility
  if (opacity !== undefined) props.opacity = opacity;
  if (visible !== undefined) props.visible = visible;

  // Line/stroke width
  if (lineWidth !== undefined) props.getLineWidth = lineWidth;
  if (lineWidthMinPixels !== undefined) props.lineWidthMinPixels = lineWidthMinPixels;
  if (lineWidthMaxPixels !== undefined) props.lineWidthMaxPixels = lineWidthMaxPixels;

  // Point/circle radius
  if (pointRadius !== undefined) {
    props.getRadius = pointRadius;
    props.getPointRadius = pointRadius;
  }
  if (radiusMinPixels !== undefined) {
    props.radiusMinPixels = radiusMinPixels;
    props.pointRadiusMinPixels = radiusMinPixels;
  }
  if (radiusMaxPixels !== undefined) {
    props.radiusMaxPixels = radiusMaxPixels;
    props.pointRadiusMaxPixels = radiusMaxPixels;
  }

  // Boolean style flags
  if (stroked !== undefined) props.stroked = stroked;
  if (filled !== undefined) props.filled = filled;

  // Elevation/3D properties
  if (elevation !== undefined) props.getElevation = elevation;
  if (elevationScale !== undefined) props.elevationScale = elevationScale;
  if (extruded !== undefined) props.extruded = extruded;
  if (wireframe !== undefined) props.wireframe = wireframe;

  return props;
}

/**
 * Execute a layer style update spec
 * Resolves all color references and returns deck.gl-ready props
 *
 * @param {Object} spec - Tool parameters including layerId
 * @returns {{ layerId: string, props: Object }} Layer ID and resolved props
 *
 * @example
 * executeLayerStyleSpec({ layerId: 'my-layer', fillColor: 'Red', opacity: 0.8 })
 * // Returns: { layerId: 'my-layer', props: { getFillColor: [255,0,0,200], opacity: 0.8 } }
 */
export function executeLayerStyleSpec(spec) {
  const { layerId, ...styleParams } = spec;

  const props = buildLayerProps(styleParams);

  console.log(`[updateLayerStyle] Layer "${layerId}" - resolved props:`, Object.keys(props).join(', '));

  return {
    layerId,
    props,
  };
}

/**
 * Get all available color constant names
 * @returns {string[]} Array of color constant names
 */
export function getColorNames() {
  return Object.keys(COLOR_MAP);
}

export default {
  executeLayerStyleSpec,
  resolveColor,
  getColorNames,
  COLOR_MAP,
};
