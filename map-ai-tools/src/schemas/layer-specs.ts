import * as z from 'zod';
import {
  colorArraySchema,
  accessorValueSchema,
  functionRefSchema,
  layerSpecBaseSchema,
} from './deckgl-json';

/**
 * Layer-Specific Schemas
 *
 * These schemas define the specific configurations for each supported
 * deck.gl layer type in @deck.gl/json format.
 */

// ============================================================================
// GeoJsonLayer Schema
// ============================================================================

/**
 * GeoJsonLayer specification schema
 */
export const geoJsonLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('GeoJsonLayer'),
  data: z.union([
    z.string(), // URL to GeoJSON
    z.object({
      type: z.literal('FeatureCollection'),
      features: z.array(z.unknown()),
    }), // Inline GeoJSON
    functionRefSchema, // @@function reference
  ]),

  // Point rendering
  pointType: z.enum(['circle', 'icon', 'text']).default('circle').optional(),
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  getPointRadius: accessorValueSchema.optional(),
  pointRadiusMinPixels: z.number().min(0).default(2).optional(),
  pointRadiusMaxPixels: z.number().min(0).default(100).optional(),
  pointRadiusScale: z.number().min(0).default(1).optional(),

  // Line/stroke rendering
  stroked: z.boolean().default(true).optional(),
  getLineWidth: accessorValueSchema.optional(),
  lineWidthMinPixels: z.number().min(0).default(1).optional(),
  lineWidthMaxPixels: z.number().min(0).default(10).optional(),
  lineWidthScale: z.number().min(0).default(1).optional(),

  // Fill rendering
  filled: z.boolean().default(true).optional(),

  // Extrusion (3D)
  extruded: z.boolean().default(false).optional(),
  wireframe: z.boolean().default(false).optional(),
  getElevation: accessorValueSchema.optional(),
  elevationScale: z.number().min(0).default(1).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getFillColor: z.unknown().optional(),
      getLineColor: z.unknown().optional(),
      getPointRadius: z.unknown().optional(),
      getLineWidth: z.unknown().optional(),
      getElevation: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type GeoJsonLayerSpec = z.infer<typeof geoJsonLayerSpecSchema>;

// ============================================================================
// RasterTileLayer Schema (CARTO)
// ============================================================================

/**
 * CARTO rasterSource configuration
 */
export const rasterSourceConfigSchema = z.object({
  type: z.literal('rasterSource').optional(),
  connectionName: z.string(),
  tableName: z.string(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

/**
 * RasterTileLayer specification schema (for CARTO raster data)
 */
export const rasterTileLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('RasterTileLayer'),
  data: z.union([
    functionRefSchema, // @@function/rasterSource({...})
    rasterSourceConfigSchema,
  ]),

  // Raster rendering
  getFillColor: accessorValueSchema.optional(),

  // Tile configuration
  tileSize: z.number().default(256).optional(),
  maxZoom: z.number().default(19).optional(),
  minZoom: z.number().default(0).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getFillColor: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type RasterTileLayerSpec = z.infer<typeof rasterTileLayerSpecSchema>;

// ============================================================================
// ScatterplotLayer Schema
// ============================================================================

/**
 * ScatterplotLayer specification schema
 */
export const scatterplotLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('ScatterplotLayer'),
  data: z.union([z.string(), z.array(z.unknown()), functionRefSchema]),

  // Position
  getPosition: accessorValueSchema,

  // Radius
  getRadius: accessorValueSchema.optional(),
  radiusScale: z.number().min(0).default(1).optional(),
  radiusMinPixels: z.number().min(0).default(0).optional(),
  radiusMaxPixels: z.number().min(0).default(100).optional(),
  radiusUnits: z.enum(['pixels', 'meters']).default('meters').optional(),

  // Colors
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  lineWidthMinPixels: z.number().min(0).default(0).optional(),
  lineWidthMaxPixels: z.number().min(0).default(10).optional(),
  stroked: z.boolean().default(false).optional(),
  filled: z.boolean().default(true).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Billboard
  billboard: z.boolean().default(false).optional(),
  antialiasing: z.boolean().default(true).optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getPosition: z.unknown().optional(),
      getRadius: z.unknown().optional(),
      getFillColor: z.unknown().optional(),
      getLineColor: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type ScatterplotLayerSpec = z.infer<typeof scatterplotLayerSpecSchema>;

// ============================================================================
// ArcLayer Schema
// ============================================================================

/**
 * ArcLayer specification schema
 */
export const arcLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('ArcLayer'),
  data: z.union([z.string(), z.array(z.unknown()), functionRefSchema]),

  // Positions
  getSourcePosition: accessorValueSchema,
  getTargetPosition: accessorValueSchema,

  // Colors
  getSourceColor: accessorValueSchema.optional(),
  getTargetColor: accessorValueSchema.optional(),

  // Width
  getWidth: accessorValueSchema.optional(),
  widthMinPixels: z.number().min(0).default(0).optional(),
  widthMaxPixels: z.number().min(0).default(100).optional(),
  widthScale: z.number().min(0).default(1).optional(),
  widthUnits: z.enum(['pixels', 'meters']).default('pixels').optional(),

  // Height/tilt
  getHeight: accessorValueSchema.optional(),
  getTilt: accessorValueSchema.optional(),
  greatCircle: z.boolean().default(false).optional(),
  numSegments: z.number().min(1).default(50).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getSourcePosition: z.unknown().optional(),
      getTargetPosition: z.unknown().optional(),
      getSourceColor: z.unknown().optional(),
      getTargetColor: z.unknown().optional(),
      getWidth: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type ArcLayerSpec = z.infer<typeof arcLayerSpecSchema>;

// ============================================================================
// HexagonLayer Schema
// ============================================================================

/**
 * HexagonLayer specification schema (aggregation layer)
 */
export const hexagonLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('HexagonLayer'),
  data: z.union([z.string(), z.array(z.unknown()), functionRefSchema]),

  // Position
  getPosition: accessorValueSchema,

  // Aggregation
  radius: z.number().min(1).default(1000).optional(),
  coverage: z.number().min(0).max(1).default(1).optional(),
  upperPercentile: z.number().min(0).max(100).default(100).optional(),
  lowerPercentile: z.number().min(0).max(100).default(0).optional(),
  elevationRange: z.tuple([z.number(), z.number()]).default([0, 1000]).optional(),
  elevationScale: z.number().min(0).default(1).optional(),

  // Colors
  colorRange: z.array(colorArraySchema).optional(),
  colorDomain: z.tuple([z.number(), z.number()]).optional(),

  // Extrusion
  extruded: z.boolean().default(false).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getPosition: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type HexagonLayerSpec = z.infer<typeof hexagonLayerSpecSchema>;

// ============================================================================
// VectorTileLayer Schema (CARTO)
// ============================================================================

/**
 * CARTO vectorTableSource configuration
 */
export const vectorTableSourceConfigSchema = z.object({
  type: z.literal('vectorTableSource').optional(),
  connectionName: z.string(),
  tableName: z.string(),
  columns: z.array(z.string()).optional(),
  spatialDataColumn: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

/**
 * VectorTileLayer specification schema (for CARTO vector data)
 */
export const vectorTileLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('VectorTileLayer'),
  data: z.union([functionRefSchema, vectorTableSourceConfigSchema]),

  // Rendering
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  getLineWidth: accessorValueSchema.optional(),
  getPointRadius: accessorValueSchema.optional(),
  pointRadiusMinPixels: z.number().min(0).optional(),
  pointRadiusMaxPixels: z.number().min(0).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getFillColor: z.unknown().optional(),
      getLineColor: z.unknown().optional(),
      getLineWidth: z.unknown().optional(),
      getPointRadius: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type VectorTileLayerSpec = z.infer<typeof vectorTileLayerSpecSchema>;

// ============================================================================
// H3TileLayer Schema (CARTO Spatial Index)
// ============================================================================

/**
 * CARTO h3TableSource configuration
 * Used for H3 spatial index aggregation from a table
 */
export const h3TableSourceConfigSchema = z.object({
  type: z.literal('h3TableSource').optional(),
  connectionName: z.string().optional(),
  tableName: z.string().describe('The CARTO table name containing H3 indexed data'),
  aggregationExp: z.string().describe('SQL aggregation expression (e.g., "SUM(population) as value")'),
  aggregationResLevel: z.number().min(0).max(15).optional().describe('H3 resolution level (0-15, auto if not specified)'),
  columns: z.array(z.string()).optional(),
  spatialDataColumn: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

export type H3TableSourceConfig = z.infer<typeof h3TableSourceConfigSchema>;

/**
 * CARTO h3QuerySource configuration
 * Used for H3 spatial index aggregation from a SQL query
 */
export const h3QuerySourceConfigSchema = z.object({
  type: z.literal('h3QuerySource').optional(),
  connectionName: z.string().optional(),
  sqlQuery: z.string().describe('SQL query returning H3 indexed data'),
  aggregationExp: z.string().describe('SQL aggregation expression (e.g., "AVG(temperature) as value")'),
  aggregationResLevel: z.number().min(0).max(15).optional().describe('H3 resolution level (0-15, auto if not specified)'),
  spatialDataColumn: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

export type H3QuerySourceConfig = z.infer<typeof h3QuerySourceConfigSchema>;

/**
 * H3TileLayer specification schema (for CARTO H3 spatial index data)
 *
 * H3TileLayer renders data aggregated into H3 hexagonal cells.
 * Requires aggregationExp to define how data is aggregated within each cell.
 *
 * @see https://deck.gl/docs/api-reference/carto/h3-tile-layer
 */
export const h3TileLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('H3TileLayer'),
  data: z.union([
    functionRefSchema, // @@function/h3TableSource({...}) or h3QuerySource({...})
    h3TableSourceConfigSchema,
    h3QuerySourceConfigSchema,
  ]),

  // Rendering
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  getLineWidth: accessorValueSchema.optional(),
  getElevation: accessorValueSchema.optional(),

  // Extrusion (3D)
  extruded: z.boolean().default(false).optional(),
  elevationScale: z.number().min(0).default(1).optional(),

  // Line styling
  stroked: z.boolean().default(true).optional(),
  lineWidthMinPixels: z.number().min(0).default(1).optional(),
  lineWidthMaxPixels: z.number().min(0).optional(),

  // Coverage
  coverage: z.number().min(0).max(1).default(1).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getFillColor: z.unknown().optional(),
      getLineColor: z.unknown().optional(),
      getLineWidth: z.unknown().optional(),
      getElevation: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type H3TileLayerSpec = z.infer<typeof h3TileLayerSpecSchema>;

// ============================================================================
// QuadbinTileLayer Schema (CARTO Spatial Index)
// ============================================================================

/**
 * CARTO quadbinTableSource configuration
 * Used for Quadbin spatial index aggregation from a table
 */
export const quadbinTableSourceConfigSchema = z.object({
  type: z.literal('quadbinTableSource').optional(),
  connectionName: z.string().optional(),
  tableName: z.string().describe('The CARTO table name containing Quadbin indexed data'),
  aggregationExp: z.string().describe('SQL aggregation expression (e.g., "SUM(population) as value")'),
  aggregationResLevel: z.number().min(0).max(26).optional().describe('Quadbin resolution level (0-26, auto if not specified)'),
  columns: z.array(z.string()).optional(),
  spatialDataColumn: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

export type QuadbinTableSourceConfig = z.infer<typeof quadbinTableSourceConfigSchema>;

/**
 * CARTO quadbinQuerySource configuration
 * Used for Quadbin spatial index aggregation from a SQL query
 */
export const quadbinQuerySourceConfigSchema = z.object({
  type: z.literal('quadbinQuerySource').optional(),
  connectionName: z.string().optional(),
  sqlQuery: z.string().describe('SQL query returning Quadbin indexed data'),
  aggregationExp: z.string().describe('SQL aggregation expression (e.g., "AVG(temperature) as value")'),
  aggregationResLevel: z.number().min(0).max(26).optional().describe('Quadbin resolution level (0-26, auto if not specified)'),
  spatialDataColumn: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  accessToken: z.string().optional(),
});

export type QuadbinQuerySourceConfig = z.infer<typeof quadbinQuerySourceConfigSchema>;

/**
 * QuadbinTileLayer specification schema (for CARTO Quadbin spatial index data)
 *
 * QuadbinTileLayer renders data aggregated into Quadbin square cells (Bing Maps tile system).
 * Requires aggregationExp to define how data is aggregated within each cell.
 *
 * @see https://deck.gl/docs/api-reference/carto/quadbin-tile-layer
 */
export const quadbinTileLayerSpecSchema = layerSpecBaseSchema.extend({
  '@@type': z.literal('QuadbinTileLayer'),
  data: z.union([
    functionRefSchema, // @@function/quadbinTableSource({...}) or quadbinQuerySource({...})
    quadbinTableSourceConfigSchema,
    quadbinQuerySourceConfigSchema,
  ]),

  // Rendering
  getFillColor: accessorValueSchema.optional(),
  getLineColor: accessorValueSchema.optional(),
  getLineWidth: accessorValueSchema.optional(),
  getElevation: accessorValueSchema.optional(),

  // Extrusion (3D)
  extruded: z.boolean().default(false).optional(),
  elevationScale: z.number().min(0).default(1).optional(),

  // Line styling
  stroked: z.boolean().default(true).optional(),
  lineWidthMinPixels: z.number().min(0).default(1).optional(),
  lineWidthMaxPixels: z.number().min(0).optional(),

  // Interaction
  pickable: z.boolean().default(true).optional(),
  autoHighlight: z.boolean().default(false).optional(),
  highlightColor: colorArraySchema.optional(),

  // Update triggers
  updateTriggers: z
    .object({
      getFillColor: z.unknown().optional(),
      getLineColor: z.unknown().optional(),
      getLineWidth: z.unknown().optional(),
      getElevation: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
});

export type QuadbinTileLayerSpec = z.infer<typeof quadbinTileLayerSpecSchema>;

// ============================================================================
// Supported Layer Types
// ============================================================================

/**
 * All supported layer types
 */
export const supportedLayerTypes = [
  'GeoJsonLayer',
  'RasterTileLayer',
  'ScatterplotLayer',
  'ArcLayer',
  'HexagonLayer',
  'VectorTileLayer',
  'H3TileLayer',
  'QuadbinTileLayer',
] as const;

export type SupportedLayerType = (typeof supportedLayerTypes)[number];

/**
 * Schema for layer type enum
 */
export const layerTypeSchema = z.enum(supportedLayerTypes);

/**
 * Get the schema for a specific layer type
 */
export function getLayerSpecSchema(layerType: SupportedLayerType) {
  switch (layerType) {
    case 'GeoJsonLayer':
      return geoJsonLayerSpecSchema;
    case 'RasterTileLayer':
      return rasterTileLayerSpecSchema;
    case 'ScatterplotLayer':
      return scatterplotLayerSpecSchema;
    case 'ArcLayer':
      return arcLayerSpecSchema;
    case 'HexagonLayer':
      return hexagonLayerSpecSchema;
    case 'VectorTileLayer':
      return vectorTileLayerSpecSchema;
    case 'H3TileLayer':
      return h3TileLayerSpecSchema;
    case 'QuadbinTileLayer':
      return quadbinTileLayerSpecSchema;
    default:
      throw new Error(`Unsupported layer type: ${layerType}`);
  }
}

/**
 * Union schema of all layer specs
 */
export const anyLayerSpecSchema = z.discriminatedUnion('@@type', [
  geoJsonLayerSpecSchema,
  rasterTileLayerSpecSchema,
  scatterplotLayerSpecSchema,
  arcLayerSpecSchema,
  hexagonLayerSpecSchema,
  vectorTileLayerSpecSchema,
  h3TileLayerSpecSchema,
  quadbinTileLayerSpecSchema,
]);

export type AnyLayerSpec = z.infer<typeof anyLayerSpecSchema>;
