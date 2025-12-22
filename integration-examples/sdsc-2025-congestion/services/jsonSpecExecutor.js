/**
 * JSON Spec Executor for sdsc-2025-congestion
 *
 * Executes layer style update specs using @deck.gl/json JSONConverter.
 * Properly uses JSONConverter for all @@ reference resolution:
 * - @@# constant references (colors, interpolators)
 * - @@= accessor expressions
 * - @@function custom function calls
 * - @@type class instantiation
 *
 * Supports comprehensive deck.gl layer properties:
 * - GeoJsonLayer: getFillColor, getLineColor, getLineWidth, lineWidthMinPixels, etc.
 * - TripsLayer/PathLayer: getColor, widthMinPixels, trailLength, etc.
 * - ScatterplotLayer: getRadius, radiusMinPixels, etc.
 * - 3D properties: getElevation, elevationScale, extruded, wireframe
 *
 * @see https://deck.gl/docs/api-reference/json/conversion-reference
 */

import {
  getJsonConverter,
  convertLayerStyle,
  resolveColor,
  resolveValue,
} from '../config/deckJsonConfig';

/**
 * Build a JSON spec object with deck.gl property names.
 * Uses @@# references for colors to leverage JSONConverter resolution.
 *
 * @param {Object} spec - Tool parameters from update-layer-style tool
 * @returns {Object} JSON spec with @@# references for colors
 */
function buildJsonSpec(spec) {
  const {
    // Color properties - can be color names, @@# refs, or RGBA arrays
    fillColor,
    lineColor,
    // Opacity & visibility
    opacity,
    visible,
    // Line/stroke width (GeoJsonLayer)
    lineWidth,
    lineWidthMinPixels,
    lineWidthMaxPixels,
    // Path/trail width (TripsLayer, PathLayer)
    widthMinPixels,
    widthMaxPixels,
    widthScale,
    // Point/circle radius
    pointRadius,
    radiusMinPixels,
    radiusMaxPixels,
    radiusScale,
    // Boolean style flags
    stroked,
    filled,
    // Trail properties (TripsLayer)
    trailLength,
    fadeTrail,
    // Path style
    capRounded,
    jointRounded,
    // Elevation/3D properties
    elevation,
    elevationScale,
    extruded,
    wireframe,
  } = spec;

  const jsonSpec = {};

  // === COLOR PROPERTIES ===
  // Convert color names to @@# format for JSONConverter resolution
  if (fillColor !== undefined) {
    // Format color for JSONConverter - supports "Red", "@@#Red", or [255,0,0]
    const colorRef = formatColorForConverter(fillColor);
    jsonSpec.getFillColor = colorRef;
    // Also set getColor for layers that use it (like ScatterplotLayer)
    jsonSpec.getColor = colorRef;
  }

  if (lineColor !== undefined) {
    const colorRef = formatColorForConverter(lineColor);
    jsonSpec.getLineColor = colorRef;
    // Also set getColor for TripsLayer/PathLayer
    jsonSpec.getColor = colorRef;
  }

  // === OPACITY & VISIBILITY ===
  if (opacity !== undefined) jsonSpec.opacity = opacity;
  if (visible !== undefined) jsonSpec.visible = visible;

  // === LINE/STROKE WIDTH (GeoJsonLayer) ===
  if (lineWidth !== undefined) jsonSpec.getLineWidth = lineWidth;
  if (lineWidthMinPixels !== undefined) jsonSpec.lineWidthMinPixels = lineWidthMinPixels;
  if (lineWidthMaxPixels !== undefined) jsonSpec.lineWidthMaxPixels = lineWidthMaxPixels;

  // === PATH/TRAIL WIDTH (TripsLayer, PathLayer) ===
  if (widthMinPixels !== undefined) {
    jsonSpec.widthMinPixels = widthMinPixels;
    jsonSpec.lineWidthMinPixels = widthMinPixels; // GeoJsonLayer compatibility
  }
  if (widthMaxPixels !== undefined) {
    jsonSpec.widthMaxPixels = widthMaxPixels;
    jsonSpec.lineWidthMaxPixels = widthMaxPixels;
  }
  if (widthScale !== undefined) {
    jsonSpec.widthScale = widthScale;
    jsonSpec.lineWidthScale = widthScale;
  }

  // === POINT/CIRCLE RADIUS ===
  if (pointRadius !== undefined) {
    jsonSpec.getRadius = pointRadius;
    jsonSpec.getPointRadius = pointRadius;
  }
  if (radiusMinPixels !== undefined) {
    jsonSpec.radiusMinPixels = radiusMinPixels;
    jsonSpec.pointRadiusMinPixels = radiusMinPixels;
  }
  if (radiusMaxPixels !== undefined) {
    jsonSpec.radiusMaxPixels = radiusMaxPixels;
    jsonSpec.pointRadiusMaxPixels = radiusMaxPixels;
  }
  if (radiusScale !== undefined) {
    jsonSpec.radiusScale = radiusScale;
    jsonSpec.pointRadiusScale = radiusScale;
  }

  // === BOOLEAN STYLE FLAGS ===
  if (stroked !== undefined) jsonSpec.stroked = stroked;
  if (filled !== undefined) jsonSpec.filled = filled;

  // === TRAIL PROPERTIES (TripsLayer) ===
  if (trailLength !== undefined) jsonSpec.trailLength = trailLength;
  if (fadeTrail !== undefined) jsonSpec.fadeTrail = fadeTrail;

  // === PATH STYLE ===
  if (capRounded !== undefined) {
    jsonSpec.capRounded = capRounded;
    jsonSpec.lineCapRounded = capRounded;
  }
  if (jointRounded !== undefined) {
    jsonSpec.jointRounded = jointRounded;
    jsonSpec.lineJointRounded = jointRounded;
  }

  // === ELEVATION/3D PROPERTIES ===
  if (elevation !== undefined) jsonSpec.getElevation = elevation;
  if (elevationScale !== undefined) jsonSpec.elevationScale = elevationScale;
  if (extruded !== undefined) jsonSpec.extruded = extruded;
  if (wireframe !== undefined) jsonSpec.wireframe = wireframe;

  return jsonSpec;
}

/**
 * Format a color value for JSONConverter resolution.
 * Converts color names to @@# format, passes through arrays and existing @@# refs.
 *
 * @param {string|number[]} color - Color name, @@# reference, or RGBA array
 * @returns {string|number[]} Formatted color for JSONConverter
 */
function formatColorForConverter(color) {
  if (Array.isArray(color)) {
    return color; // Already RGBA array
  }

  if (typeof color === 'string') {
    // Already in @@# format
    if (color.startsWith('@@#')) {
      return color;
    }

    // Convert color name to @@# format (capitalize first letter)
    const colorName = color.charAt(0).toUpperCase() + color.slice(1).toLowerCase();
    return `@@#${colorName}`;
  }

  return color;
}

/**
 * Execute a layer style update spec using JSONConverter.
 * Maps tool parameters to deck.gl layer properties and resolves all @@ references.
 *
 * @param {Object} spec - Tool parameters from update-layer-style tool
 * @returns {{ layerId: string, props: Object }} Resolved layer ID and properties
 *
 * @example
 * // Using color names
 * executeLayerStyleSpec({ layerId: 'my-layer', fillColor: 'Red', opacity: 0.8 })
 * // Returns: { layerId: 'my-layer', props: { getFillColor: [255,0,0,200], opacity: 0.8 } }
 *
 * @example
 * // Using @@# references
 * executeLayerStyleSpec({ layerId: 'my-layer', lineColor: '@@#Blue' })
 * // Returns: { layerId: 'my-layer', props: { getLineColor: [0,0,255,200] } }
 *
 * @example
 * // Using @@function for computed colors
 * executeLayerStyleSpec({
 *   layerId: 'my-layer',
 *   fillColor: { '@@function': 'colorWithAlpha', color: 'Red', alpha: 128 }
 * })
 * // Returns: { layerId: 'my-layer', props: { getFillColor: [255,0,0,128] } }
 */
export function executeLayerStyleSpec(spec) {
  const { layerId } = spec;

  // Build JSON spec with @@# color references
  const jsonSpec = buildJsonSpec(spec);

  // Use JSONConverter to resolve all @@ references
  // convertLayerStyle handles @@#, @@function, @@type, @@= syntax
  const resolvedProps = convertLayerStyle(jsonSpec);

  // Log for debugging
  console.log(`[jsonSpecExecutor] Layer "${layerId}" - JSONConverter resolved props:`, Object.keys(resolvedProps).join(', '));

  return {
    layerId,
    props: resolvedProps,
  };
}

/**
 * Create a layer style spec from AI-friendly parameters.
 * Useful for converting natural language-derived params to spec format.
 *
 * @param {string} layerId - Layer ID
 * @param {Object} styleParams - Style parameters (colors, opacity, etc.)
 * @returns {Object} Spec ready for executeLayerStyleSpec
 *
 * @example
 * const spec = createLayerStyleSpec('congestion-zone', {
 *   fillColor: 'Red',
 *   opacity: 0.5,
 *   lineWidthMinPixels: 3
 * });
 * const result = executeLayerStyleSpec(spec);
 */
export function createLayerStyleSpec(layerId, styleParams) {
  return {
    layerId,
    ...styleParams,
  };
}

/**
 * Execute a full deck.gl JSON spec using JSONConverter.
 * Use this when you have a complete deck.gl configuration object.
 *
 * @param {Object} fullSpec - Full deck.gl JSON spec with layers, viewState, etc.
 * @returns {Object} Resolved deck.gl props
 *
 * @example
 * const props = executeFullSpec({
 *   initialViewState: {
 *     longitude: -122.4,
 *     latitude: 37.8,
 *     zoom: 12,
 *     transitionInterpolator: '@@#FlyToInterpolator',
 *     transitionDuration: 1000
 *   },
 *   layers: [{
 *     '@@type': 'GeoJsonLayer',
 *     id: 'my-layer',
 *     data: 'https://example.com/data.json',
 *     getFillColor: '@@#Red',
 *     getLineColor: { '@@function': 'colorWithAlpha', color: 'Blue', alpha: 128 }
 *   }]
 * });
 */
export function executeFullSpec(fullSpec) {
  const converter = getJsonConverter();
  return converter.convert(fullSpec);
}

// Re-export JSONConverter utilities for direct use
export { getJsonConverter, convertLayerStyle, resolveColor, resolveValue };
