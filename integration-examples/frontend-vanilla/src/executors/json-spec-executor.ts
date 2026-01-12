/**
 * JSON Spec Executor for frontend-vanilla
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
 * - VectorTileLayer: point/line/fill properties
 * - 3D properties: getElevation, elevationScale, extruded, wireframe
 *
 * @see https://deck.gl/docs/api-reference/json/conversion-reference
 */

import {
  getJsonConverter,
  convertLayerStyle,
  resolveColor,
  resolveValue,
  formatColorForConverter,
} from '../config/deckJsonConfig';

/**
 * Default values that OpenAI tends to fill in automatically.
 * Filter these out to prevent overriding layer's original values.
 *
 * When user asks "make trails blue and 50 for width", OpenAI returns ALL properties
 * with default values (opacity: 1, trailLength: 1, etc.), which destroys the
 * layer's original configuration.
 */
const OPENAI_DEFAULT_VALUES: Record<string, any> = {
  opacity: 1,
  visible: true,
  stroked: true,
  filled: true,
  fadeTrail: true,
  capRounded: true,
  jointRounded: true,
  extruded: false,
  wireframe: false,
  widthScale: 1,
  radiusScale: 1,
  elevationScale: 1,
  trailLength: 1,
  pointRadius: 1,
  radiusMinPixels: 1,
  radiusMaxPixels: 1,
  elevation: 1,
  pickable: true,
};

/**
 * Filter out properties that match OpenAI's typical default values.
 * These are likely not explicitly requested by the user.
 * NOTE: Never filter 'visible' property as it's used for layer toggling
 */
function filterDefaultValues(spec: Record<string, any>): Record<string, any> {
  const filtered = { ...spec };

  // Properties that should never be filtered
  const neverFilter = ['visible', 'layerId'];

  for (const [key, defaultValue] of Object.entries(OPENAI_DEFAULT_VALUES)) {
    // Skip properties that should never be filtered
    if (neverFilter.includes(key)) {
      continue;
    }

    if (filtered[key] === defaultValue) {
      delete filtered[key];
    }
  }

  // Log what was filtered for debugging
  const originalKeys = Object.keys(spec).filter(k => k !== 'layerId');
  const filteredKeys = Object.keys(filtered).filter(k => k !== 'layerId');
  const removedKeys = originalKeys.filter(k => !filteredKeys.includes(k));

  if (removedKeys.length > 0) {
    console.log(`[jsonSpecExecutor] Filtered out default values: ${removedKeys.join(', ')}`);
  }

  return filtered;
}

/**
 * Build a JSON spec object with deck.gl property names.
 * Uses @@# references for colors to leverage JSONConverter resolution.
 */
function buildJsonSpec(spec: Record<string, any>): Record<string, any> {
  // Filter out default values that OpenAI fills in automatically
  const filteredSpec = filterDefaultValues(spec);

  const {
    // Color properties - can be color names, @@# refs, or RGBA arrays
    fillColor,
    lineColor,
    pointColor,
    // Opacity & visibility
    opacity,
    visible,
    pickable,
    // Line/stroke width (GeoJsonLayer, VectorTileLayer)
    lineWidth,
    lineWidthMinPixels,
    lineWidthMaxPixels,
    lineWidthScale,
    // Path/trail width (TripsLayer, PathLayer)
    widthMinPixels,
    widthMaxPixels,
    widthScale,
    // Point/circle radius
    pointRadius,
    radiusMinPixels,
    radiusMaxPixels,
    radiusScale,
    // VectorTileLayer specific
    pointRadiusMinPixels,
    pointRadiusMaxPixels,
    pointRadiusScale,
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
    // Text properties
    fontSize,
    fontFamily,
    fontWeight,
    // Icon properties
    iconSize,
    iconSizeScale,
    iconSizeMinPixels,
    iconSizeMaxPixels,
  } = filteredSpec;

  const jsonSpec: Record<string, any> = {};

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
    // For PathLayer/TripsLayer that use getColor for line
    if (!fillColor) {
      jsonSpec.getColor = colorRef;
    }
  }

  if (pointColor !== undefined) {
    const colorRef = formatColorForConverter(pointColor);
    // VectorTileLayer uses getPointColor
    jsonSpec.getPointColor = colorRef;
    // ScatterplotLayer uses getColor
    if (!fillColor && !lineColor) {
      jsonSpec.getColor = colorRef;
    }
  }

  // === OPACITY & VISIBILITY ===
  if (opacity !== undefined) jsonSpec.opacity = opacity;
  if (visible !== undefined) jsonSpec.visible = visible;
  if (pickable !== undefined) jsonSpec.pickable = pickable;

  // === LINE/STROKE WIDTH (GeoJsonLayer, VectorTileLayer) ===
  if (lineWidth !== undefined) jsonSpec.getLineWidth = lineWidth;
  if (lineWidthMinPixels !== undefined) jsonSpec.lineWidthMinPixels = lineWidthMinPixels;
  if (lineWidthMaxPixels !== undefined) jsonSpec.lineWidthMaxPixels = lineWidthMaxPixels;
  if (lineWidthScale !== undefined) jsonSpec.lineWidthScale = lineWidthScale;

  // === PATH/TRAIL WIDTH (TripsLayer, PathLayer) ===
  if (widthMinPixels !== undefined) {
    jsonSpec.widthMinPixels = widthMinPixels;
    // Also set for GeoJsonLayer compatibility
    if (!lineWidthMinPixels) {
      jsonSpec.lineWidthMinPixels = widthMinPixels;
    }
  }
  if (widthMaxPixels !== undefined) {
    jsonSpec.widthMaxPixels = widthMaxPixels;
    if (!lineWidthMaxPixels) {
      jsonSpec.lineWidthMaxPixels = widthMaxPixels;
    }
  }
  if (widthScale !== undefined) {
    jsonSpec.widthScale = widthScale;
    if (!lineWidthScale) {
      jsonSpec.lineWidthScale = widthScale;
    }
  }

  // === POINT/CIRCLE RADIUS ===
  if (pointRadius !== undefined) {
    jsonSpec.getRadius = pointRadius;
    jsonSpec.getPointRadius = pointRadius; // VectorTileLayer
  }
  if (radiusMinPixels !== undefined) {
    jsonSpec.radiusMinPixels = radiusMinPixels;
  }
  if (radiusMaxPixels !== undefined) {
    jsonSpec.radiusMaxPixels = radiusMaxPixels;
  }
  if (radiusScale !== undefined) {
    jsonSpec.radiusScale = radiusScale;
  }

  // === VECTOR TILE LAYER SPECIFIC ===
  if (pointRadiusMinPixels !== undefined) {
    jsonSpec.pointRadiusMinPixels = pointRadiusMinPixels;
    if (!radiusMinPixels) {
      jsonSpec.radiusMinPixels = pointRadiusMinPixels;
    }
  }
  if (pointRadiusMaxPixels !== undefined) {
    jsonSpec.pointRadiusMaxPixels = pointRadiusMaxPixels;
    if (!radiusMaxPixels) {
      jsonSpec.radiusMaxPixels = pointRadiusMaxPixels;
    }
  }
  if (pointRadiusScale !== undefined) {
    jsonSpec.pointRadiusScale = pointRadiusScale;
    if (!radiusScale) {
      jsonSpec.radiusScale = pointRadiusScale;
    }
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

  // === TEXT PROPERTIES ===
  if (fontSize !== undefined) jsonSpec.fontSize = fontSize;
  if (fontFamily !== undefined) jsonSpec.fontFamily = fontFamily;
  if (fontWeight !== undefined) jsonSpec.fontWeight = fontWeight;

  // === ICON PROPERTIES ===
  if (iconSize !== undefined) jsonSpec.iconSize = iconSize;
  if (iconSizeScale !== undefined) jsonSpec.iconSizeScale = iconSizeScale;
  if (iconSizeMinPixels !== undefined) jsonSpec.iconSizeMinPixels = iconSizeMinPixels;
  if (iconSizeMaxPixels !== undefined) jsonSpec.iconSizeMaxPixels = iconSizeMaxPixels;

  return jsonSpec;
}

/**
 * Execute a layer style update spec using JSONConverter.
 * Maps tool parameters to deck.gl layer properties and resolves all @@ references.
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
export function executeLayerStyleSpec(spec: Record<string, any>): {
  layerId: string;
  props: Record<string, any>;
} {
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
 * @example
 * const spec = createLayerStyleSpec('my-layer', {
 *   fillColor: 'Red',
 *   opacity: 0.5,
 *   lineWidthMinPixels: 3
 * });
 * const result = executeLayerStyleSpec(spec);
 */
export function createLayerStyleSpec(
  layerId: string,
  styleParams: Record<string, any>
): Record<string, any> {
  return {
    layerId,
    ...styleParams,
  };
}

/**
 * Execute a full deck.gl JSON spec using JSONConverter.
 * Use this when you have a complete deck.gl configuration object.
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
export function executeFullSpec(fullSpec: Record<string, any>): any {
  const converter = getJsonConverter();
  return converter.convert(fullSpec);
}

/**
 * Execute a layer add spec using JSONConverter.
 * Creates a new layer instance from a JSON specification.
 *
 * @example
 * const layer = executeAddLayerSpec({
 *   '@@type': 'VectorTileLayer',
 *   id: 'new-points',
 *   data: {
 *     '@@function': 'cartoVectorTileSource',
 *     connectionName: 'carto_dw',
 *     tableName: 'carto-demo-data.demo_tables.airports'
 *   },
 *   getFillColor: '@@#Blue',
 *   getLineColor: [255, 255, 255, 200],
 *   getPointRadius: 100
 * });
 */
export function executeAddLayerSpec(layerSpec: Record<string, any>): any {
  // Ensure the spec has @@type for layer instantiation
  if (!layerSpec['@@type']) {
    throw new Error('Layer spec must include @@type property for layer class');
  }

  const converter = getJsonConverter();

  // Convert the layer spec directly
  const resolvedLayer = converter.convert(layerSpec);

  return resolvedLayer;
}

/**
 * Filter properties preserving user overrides.
 * Prevents OpenAI defaults from overwriting existing customizations.
 */
export function filterPropsPreservingOverrides(
  newProps: Record<string, any>,
  existingOverrides: Record<string, any>
): Record<string, any> {
  const alwaysApply = ['getFillColor', 'getColor', 'getLineColor', 'getPointColor'];
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(newProps)) {
    // Colors always applied (what user wants to change)
    if (alwaysApply.includes(key)) {
      filtered[key] = value;
      continue;
    }

    // Check if this looks like a default value
    const isLikelyDefault = OPENAI_DEFAULT_VALUES[key] === value;

    // Preserve existing user modifications if new value looks like default
    if (isLikelyDefault && existingOverrides[key] !== undefined &&
        existingOverrides[key] !== OPENAI_DEFAULT_VALUES[key]) {
      console.log(`[jsonSpecExecutor] Preserving existing "${key}": ${existingOverrides[key]}`);
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
}

// Re-export JSONConverter utilities for direct use
export { getJsonConverter, convertLayerStyle, resolveColor, resolveValue };