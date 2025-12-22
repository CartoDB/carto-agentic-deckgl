// backend/src/services/custom-tools.ts
import { z } from 'zod';

/**
 * Custom backend tools following the same structure as CARTO tools
 * Each tool has: name, description, and schema (Zod schema)
 *
 * IMPORTANT LIMITATION:
 * When using Gemini via CARTO LiteLLM, custom tools with execute functions
 * may not work due to API response format incompatibility. The Gemini API
 * returns "text: null" when calling tools, which causes Vercel AI SDK validation
 * errors. Custom tools are still defined and sent to the AI, but execution fails.
 *
 * Workarounds:
 * 1. Use OpenAI API directly (recommended for custom tools)
 * 2. Contact CARTO about standard OpenAI-compatible response format
 * 3. Remove execute functions and handle tool calls on the frontend
 * 4. Accept that custom backend tools won't work with current setup
 * 5. Improve system prompt to be more specific about when to call tools
 */

export const weatherTool = {
  name: 'weather',
  description: 'Get the current weather in a specific location',
  schema: z.object({
    location: z.string().describe('The location to get the weather for (city name or address)'),
  }),
  execute: async ({ location }: { location: string }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
    condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
    humidity: 40 + Math.floor(Math.random() * 40),
  }),
};

// Helper to coerce values from strings (OpenAI sometimes sends all values as strings)
const coerceNumber = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  }
  return val;
};

const coerceBoolean = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
};

const coerceColor = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
};

// Color schema: accepts either color name string or RGBA array
const colorSchema = z.preprocess(
  coerceColor,
  z.union([
    z.string().min(1).describe('Color name (red, blue, green, yellow, orange, purple, pink, cyan, white, black, gray)'),
    z.array(z.number()).min(3).max(4).describe('RGBA array [r,g,b] or [r,g,b,a], values 0-255'),
  ]).optional()
);

// Number schema that coerces strings to numbers
const optionalNumber = (min?: number, max?: number) => z.preprocess(
  coerceNumber,
  (() => {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema.optional();
  })()
);

// Boolean schema that coerces strings to booleans
const optionalBoolean = z.preprocess(
  coerceBoolean,
  z.boolean().optional()
);

/**
 * Toggle layer visibility tool - show or hide layers
 * Uses @deck.gl/json JSONConverter pattern for consistent handling
 */
export const toggleLayerTool = {
  name: 'toggle-layer',
  description: `Show or hide a map layer. Use this tool when user asks to:
- "hide the subway" → { layerId: "subway", visible: false }
- "show traffic" → { layerId: "traffic-before", visible: true }
- "turn off the congestion zone" → { layerId: "congestion-zone", visible: false }
- "display regional improvement" → { layerId: "regional-improvement", visible: true }

IMPORTANT: Use "layerId" parameter (not "layerName").

Available layer IDs: congestion-zone, traffic-before, traffic-after, regional-improvement, subway, google-3d.

This tool ONLY changes visibility. For other style changes (colors, width, opacity), use update-layer-style instead.`,
  schema: z.object({
    // Accept both layerId and layerName (AI sometimes uses wrong name)
    layerId: z.string().optional().describe('The layer ID to show/hide'),
    layerName: z.string().optional().describe('Alias for layerId (deprecated, use layerId)'),
    visible: z.preprocess(
      coerceBoolean,
      z.boolean().describe('true to show the layer, false to hide it')
    ),
  }).transform((data) => ({
    // Normalize: use layerId if provided, otherwise fall back to layerName
    layerId: data.layerId || data.layerName || '',
    visible: data.visible,
  })).refine((data) => data.layerId.length > 0, {
    message: 'Either layerId or layerName must be provided',
    path: ['layerId'],
  }),
  // No execute function = frontend-executed tool
};

/**
 * Reset visualization tool - resets layers to original state and optionally resets view
 */
export const resetVisualizationTool = {
  name: 'reset-visualization',
  description: `Reset the visualization to its original state. Use this when user asks to "reset", "restore defaults", "go back to original", or "undo changes".

This tool resets:
- All layer styles to their original colors, widths, and properties
- Optionally resets the view state (camera position, zoom, pitch, bearing)
- Optionally navigates to a specific slide

Use this tool instead of trying to set properties to "default" values.`,
  schema: z.object({
    resetLayers: optionalBoolean
      .describe('Reset all layer styles to original (default: true)'),
    resetViewState: optionalBoolean
      .describe('Reset camera/view to original position (default: false)'),
    targetSlide: optionalNumber(0)
      .describe('Navigate to specific slide number (0-indexed) after reset'),
  }),
  // No execute function = frontend-executed tool
};

/**
 * Update layer style tool - frontend-executed (no execute function)
 * Uses @deck.gl/json JSONConverter to resolve style properties
 * Supports all major deck.gl layer types: GeoJsonLayer, TripsLayer, PathLayer, ScatterplotLayer, etc.
 */
export const updateLayerStyleTool = {
  name: 'update-layer-style',
  description: `Update visual styling of a map layer. Uses @deck.gl/json standard with layer.clone() for state preservation - only specified properties are updated.

IMPORTANT: Do NOT use "default" as a value. If user wants to reset styles, use the reset-visualization tool instead.

VISIBILITY RULES:
- To HIDE a layer: use visible: false (e.g., "hide subway" → { layerId: "subway", visible: false })
- To SHOW a layer: use visible: true (e.g., "show subway" → { layerId: "subway", visible: true })
- This is the ONLY tool for hiding/showing layers - there is no separate toggle-layer or hide-layer tool

COLOR SELECTION RULES (CRITICAL - follow exactly):
- If user mentions "line", "lines", "stroke", "border", "outline", "edge", or "trail" → ONLY set lineColor, do NOT set fillColor
- If user mentions "fill", "background", "interior", or "inside" → ONLY set fillColor, do NOT set lineColor
- If user request is ambiguous (e.g., "make it red", "change color") → set BOTH fillColor and lineColor
- NEVER add a color property that wasn't implied by user's words

PROPERTY USAGE BY LAYER TYPE:
- GeoJsonLayer (polygons): fillColor, lineColor, lineWidth, lineWidthMinPixels, opacity, stroked, filled, extruded, elevation, visible
- TripsLayer (trails): lineColor, widthMinPixels, trailLength, opacity, fadeTrail, visible
- PathLayer (lines): lineColor, widthMinPixels, widthMaxPixels, opacity, capRounded, jointRounded, visible
- ScatterplotLayer (points): fillColor, lineColor, pointRadius, radiusMinPixels, radiusMaxPixels, stroked, filled, visible

Only include properties that need to change - omit properties that should keep their current values (they are preserved via layer.clone()).
Colors: names (red, blue, green, yellow, orange, purple, pink, cyan, white, black, gray) or RGBA arrays [r,g,b,a].
Available layer IDs: congestion-zone, traffic-before, traffic-after, regional-improvement, subway.`,
  schema: z.object({
    // Required
    layerId: z.string().describe('The layer ID to update'),

    // === COLOR PROPERTIES ===
    fillColor: colorSchema
      .describe('Fill color for polygons/points - name or RGBA array'),
    lineColor: colorSchema
      .describe('Line/stroke/trail color - name or RGBA array'),

    // === OPACITY & VISIBILITY ===
    opacity: optionalNumber(0, 1)
      .describe('Layer opacity from 0 (transparent) to 1 (opaque)'),
    visible: optionalBoolean
      .describe('Layer visibility (true/false)'),

    // === LINE/STROKE WIDTH (GeoJsonLayer) ===
    lineWidth: optionalNumber(0)
      .describe('Line width in meters (GeoJsonLayer getLineWidth)'),
    lineWidthMinPixels: optionalNumber(0)
      .describe('Minimum line width in pixels - prevents lines from becoming too thin'),
    lineWidthMaxPixels: optionalNumber(0)
      .describe('Maximum line width in pixels - prevents lines from becoming too thick'),

    // === PATH/TRAIL WIDTH (TripsLayer, PathLayer) ===
    widthMinPixels: optionalNumber(0)
      .describe('Minimum path/trail width in pixels (TripsLayer, PathLayer)'),
    widthMaxPixels: optionalNumber(0)
      .describe('Maximum path/trail width in pixels (TripsLayer, PathLayer)'),
    widthScale: optionalNumber(0)
      .describe('Width multiplier for all paths/trails'),

    // === POINT/CIRCLE RADIUS (ScatterplotLayer, GeoJsonLayer points) ===
    pointRadius: optionalNumber(0)
      .describe('Point/circle radius in meters'),
    radiusMinPixels: optionalNumber(0)
      .describe('Minimum point radius in pixels'),
    radiusMaxPixels: optionalNumber(0)
      .describe('Maximum point radius in pixels'),
    radiusScale: optionalNumber(0)
      .describe('Radius multiplier for all points'),

    // === BOOLEAN STYLE FLAGS ===
    stroked: optionalBoolean
      .describe('Whether to draw stroke/outline around polygons and points'),
    filled: optionalBoolean
      .describe('Whether to draw filled polygons and points'),

    // === TRAIL PROPERTIES (TripsLayer) ===
    trailLength: optionalNumber(0)
      .describe('Trail length - how long it takes for path to fade out (TripsLayer)'),
    fadeTrail: optionalBoolean
      .describe('Whether trail fades out (TripsLayer) - if false, trailLength has no effect'),

    // === PATH STYLE (PathLayer, GeoJsonLayer lines) ===
    capRounded: optionalBoolean
      .describe('Round line caps (true) or square caps (false)'),
    jointRounded: optionalBoolean
      .describe('Round line joints (true) or miter joints (false)'),

    // === ELEVATION/3D PROPERTIES ===
    elevation: optionalNumber(0)
      .describe('Extrusion height in meters (for extruded polygons)'),
    elevationScale: optionalNumber(0)
      .describe('Elevation multiplier'),
    extruded: optionalBoolean
      .describe('Whether to extrude polygons into 3D'),
    wireframe: optionalBoolean
      .describe('Whether to show wireframe for extruded polygons'),
  }),
  // No execute function = frontend-executed tool
};

// Export all custom tools as an object
export const customTools = {
  weather: weatherTool,
  'toggle-layer': toggleLayerTool,
  'reset-visualization': resetVisualizationTool,
  'update-layer-style': updateLayerStyleTool,
} as const;

// Type for custom tool names
export type CustomToolName = keyof typeof customTools;

// Export tool names for easy access
export const getCustomToolNames = (): CustomToolName[] => {
  return Object.keys(customTools) as CustomToolName[];
};

// Helper to get a custom tool by name
export const getCustomTool = (toolName: string) => {
  return customTools[toolName as CustomToolName];
};
