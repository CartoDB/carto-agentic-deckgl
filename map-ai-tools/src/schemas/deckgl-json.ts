import * as z from 'zod';

/**
 * @deck.gl/json Zod Schemas
 *
 * These schemas define the structure of @deck.gl/json-compatible specifications
 * that can be converted by JSONConverter into deck.gl props.
 *
 * @deck.gl/json special prefixes:
 * - @@type: Class instantiation (e.g., "@@type": "GeoJsonLayer")
 * - @@function: Function reference (e.g., "@@function": "rasterSource")
 * - @@=: Inline expression (e.g., "@@=[lng, lat]")
 * - @@#: Constant/enum reference (e.g., "@@#FlyToInterpolator")
 */

// ============================================================================
// Primitive Schemas
// ============================================================================

/**
 * RGBA color array [r, g, b] or [r, g, b, a]
 */
export const colorArraySchema = z.union([
  z.tuple([z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
]);

/**
 * Accessor value - can be static or use @deck.gl/json prefixes
 * Examples:
 * - Static: [255, 0, 0]
 * - Function: "@@function/getColorByProperty('region', {...})"
 * - Expression: "@@=[color / 255, 200, 20]"
 */
export const accessorValueSchema = z.union([
  z.number(),
  z.array(z.number()),
  z.string().startsWith('@@'),
  z.record(z.string(), z.unknown()),
]);

/**
 * Reference to a constant or interpolator
 * Example: "@@#FlyToInterpolator"
 */
export const constantRefSchema = z.string().regex(/^@@#\w+$/);

/**
 * Reference to a function
 * Example: "@@function/rasterSource({...})"
 */
export const functionRefSchema = z.string().regex(/^@@function\/.+$/);

/**
 * Inline expression
 * Example: "@@=[lng, lat]"
 */
export const expressionSchema = z.string().regex(/^@@=.+$/);

// ============================================================================
// View State Schema
// ============================================================================

/**
 * ViewState specification for @deck.gl/json
 */
export const viewStateSpecSchema = z.object({
  longitude: z.number().min(-180).max(180).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  zoom: z.number().min(0).max(24).optional(),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().min(-180).max(180).optional(),
  transitionDuration: z.number().min(0).optional(),
  transitionInterpolator: z.union([constantRefSchema, z.string()]).optional(),
  transitionEasing: z.union([functionRefSchema, z.string()]).optional(),
});

export type ViewStateSpec = z.infer<typeof viewStateSpecSchema>;

// ============================================================================
// Layer Specification Schema
// ============================================================================

/**
 * Base layer specification with @@type
 */
export const layerSpecBaseSchema = z.object({
  '@@type': z.string().describe('Layer class name (e.g., "GeoJsonLayer", "RasterTileLayer")'),
  id: z.string().describe('Unique layer identifier'),
  visible: z.boolean().default(true).optional(),
  opacity: z.number().min(0).max(1).default(1).optional(),
});

/**
 * Extended layer specification with common properties
 */
export const layerSpecSchema = layerSpecBaseSchema.extend({
  data: z.union([
    z.string(), // URL or function reference
    z.array(z.unknown()), // Inline data
    z.record(z.string(), z.unknown()), // GeoJSON or config object
    functionRefSchema, // @@function reference for CARTO sources
  ]).optional(),
  pickable: z.boolean().optional(),
  autoHighlight: z.boolean().optional(),
  highlightColor: colorArraySchema.optional(),

  // Accessor properties - can be static or use @@ prefixes
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  getPointRadius: accessorValueSchema.optional(),
  getLineWidth: accessorValueSchema.optional(),
  getElevation: accessorValueSchema.optional(),
  getPosition: accessorValueSchema.optional(),
  getText: accessorValueSchema.optional(),
  getIcon: accessorValueSchema.optional(),

  // Point/radius properties
  pointRadiusMinPixels: z.number().optional(),
  pointRadiusMaxPixels: z.number().optional(),
  pointRadiusScale: z.number().optional(),
  radiusMinPixels: z.number().optional(),
  radiusMaxPixels: z.number().optional(),

  // Line properties
  lineWidthMinPixels: z.number().optional(),
  lineWidthMaxPixels: z.number().optional(),
  lineWidthScale: z.number().optional(),

  // GeoJSON-specific
  pointType: z.string().optional(),
  stroked: z.boolean().optional(),
  filled: z.boolean().optional(),
  extruded: z.boolean().optional(),
  wireframe: z.boolean().optional(),

  // Update triggers for accessor changes
  updateTriggers: z.record(z.string(), z.unknown()).optional(),

  // Allow additional properties for specific layer types
}).passthrough();

export type LayerSpec = z.infer<typeof layerSpecSchema>;

// ============================================================================
// Layer Operations Schema
// ============================================================================

/**
 * Layer operation types
 */
export const layerOperationTypeSchema = z.enum(['add', 'update', 'remove']);

/**
 * Layer operation specification
 */
export const layerOperationSchema = z.object({
  operation: layerOperationTypeSchema,
  layerId: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export type LayerOperation = z.infer<typeof layerOperationSchema>;

// ============================================================================
// DeckGL JSON Spec Schema
// ============================================================================

/**
 * Complete @deck.gl/json specification
 * This is the output format for all tools
 */
export const deckGLJsonSpecSchema = z.object({
  /**
   * View state changes (optional)
   * Used by fly-to, zoom-map, and view manipulation tools
   */
  initialViewState: viewStateSpecSchema.optional(),

  /**
   * Layer definitions (optional)
   * Used when adding new layers
   */
  layers: z.array(layerSpecSchema).optional(),

  /**
   * Layer operations (optional)
   * Used for update/remove operations on existing layers
   */
  layerOperations: z.array(layerOperationSchema).optional(),

  /**
   * Map style URL (optional)
   * Used for changing the basemap style
   */
  mapStyle: z.string().optional(),

  /**
   * Controller configuration (optional)
   */
  controller: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
});

export type DeckGLJsonSpec = z.infer<typeof deckGLJsonSpecSchema>;

// ============================================================================
// Query Response Schemas (for non-spec tools)
// ============================================================================

/**
 * Query features response (not a spec, returns data)
 */
export const queryFeaturesResponseSchema = z.object({
  count: z.number(),
  total: z.number(),
  sampleNames: z.array(z.string()).optional(),
});

export type QueryFeaturesResponse = z.infer<typeof queryFeaturesResponseSchema>;

/**
 * Aggregate features response (not a spec, returns data)
 */
export const aggregateFeaturesResponseSchema = z.object({
  groupBy: z.string(),
  total: z.number(),
  groups: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
    })
  ),
});

export type AggregateFeaturesResponse = z.infer<typeof aggregateFeaturesResponseSchema>;

/**
 * Get layer config response (not a spec, returns data)
 */
export const getLayerConfigResponseSchema = z.object({
  layerId: z.string(),
  layerType: z.string(),
  visible: z.boolean(),
  opacity: z.number(),
  props: z.record(z.string(), z.unknown()),
});

export type GetLayerConfigResponse = z.infer<typeof getLayerConfigResponseSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is a @deck.gl/json special prefix
 */
export function isSpecialPrefix(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('@@');
}

/**
 * Check if a value is a function reference
 */
export function isFunctionRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('@@function');
}

/**
 * Check if a value is a constant reference
 */
export function isConstantRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('@@#');
}

/**
 * Check if a value is an expression
 */
export function isExpression(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('@@=');
}

/**
 * Create a function reference string
 * @param funcName - Function name
 * @param args - Arguments as JSON string
 */
export function createFunctionRef(funcName: string, args?: Record<string, unknown>): string {
  if (args) {
    return `@@function/${funcName}(${JSON.stringify(args)})`;
  }
  return `@@function/${funcName}`;
}

/**
 * Create a constant reference string
 * @param constantName - Constant name
 */
export function createConstantRef(constantName: string): string {
  return `@@#${constantName}`;
}

/**
 * Create an expression string
 * @param expression - Expression
 */
export function createExpression(expression: string): string {
  return `@@=${expression}`;
}
