import * as z from 'zod';
import { viewStateSpecSchema, layerSpecSchema } from './deckgl-json';
import { supportedLayerTypes } from './layer-specs';

/**
 * Initial State Schema
 *
 * This schema defines the structure for passing the initial map state
 * from the frontend to the AI tools. This enables the AI to understand
 * the current map context and make informed decisions.
 */

// ============================================================================
// Data Source Metadata Schema
// ============================================================================

/**
 * Data source type enum
 */
export const dataSourceTypeSchema = z.enum([
  'geojson', // GeoJSON file or inline data
  'carto-table', // CARTO table (vector)
  'carto-raster', // CARTO raster tileset
  'url', // External URL
  'inline', // Inline data
]);

export type DataSourceType = z.infer<typeof dataSourceTypeSchema>;

/**
 * Property metadata for a data source
 */
export const propertyMetadataSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
  sampleValues: z.array(z.unknown()).max(5).optional(),
  description: z.string().optional(),
});

export type PropertyMetadata = z.infer<typeof propertyMetadataSchema>;

/**
 * Data source metadata
 */
export const dataSourceMetadataSchema = z.object({
  id: z.string().describe('Unique identifier for this data source'),
  type: dataSourceTypeSchema.describe('Type of data source'),
  name: z.string().optional().describe('Human-readable name'),
  description: z.string().optional().describe('Description of the data'),
  properties: z.array(propertyMetadataSchema).optional().describe('Available properties in the data'),
  featureCount: z.number().optional().describe('Number of features (if applicable)'),
  bounds: z
    .object({
      minLng: z.number(),
      minLat: z.number(),
      maxLng: z.number(),
      maxLat: z.number(),
    })
    .optional()
    .describe('Geographic bounds of the data'),
  // CARTO-specific
  tableName: z.string().optional(),
  connectionName: z.string().optional(),
});

export type DataSourceMetadata = z.infer<typeof dataSourceMetadataSchema>;

// ============================================================================
// Layer State Metadata Schema
// ============================================================================

/**
 * Layer state metadata (simplified representation for AI context)
 */
export const layerStateMetadataSchema = z.object({
  id: z.string(),
  type: z.string().describe('Layer type (e.g., "GeoJsonLayer", "RasterTileLayer")'),
  name: z.string().optional().describe('Human-readable name'),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  dataSourceId: z.string().optional().describe('Reference to associated data source'),
  description: z.string().optional(),
  // Current styling
  fillColor: z.array(z.number()).optional(),
  lineColor: z.array(z.number()).optional(),
  // Filter state
  hasActiveFilter: z.boolean().optional(),
  filterDescription: z.string().optional(),
});

export type LayerStateMetadata = z.infer<typeof layerStateMetadataSchema>;

// ============================================================================
// Initial State Schema
// ============================================================================

/**
 * Complete initial state passed to AI tools
 */
export const initialStateSchema = z.object({
  /**
   * Current view state of the map
   */
  initialViewState: viewStateSpecSchema.describe('Current view state of the map'),

  /**
   * Current layers on the map (in @deck.gl/json format)
   * Used for JSONConverter when restoring state
   */
  layers: z.array(layerSpecSchema).optional().describe('Current layer configurations'),

  /**
   * Simplified layer metadata for AI context
   * Easier for AI to understand than full layer specs
   */
  layerStates: z.array(layerStateMetadataSchema).optional().describe('Layer states for AI context'),

  /**
   * Available data sources
   */
  dataSources: z.array(dataSourceMetadataSchema).optional().describe('Available data sources'),

  /**
   * Layer types that can be created
   */
  availableLayerTypes: z
    .array(z.enum(supportedLayerTypes))
    .default(['GeoJsonLayer', 'RasterTileLayer', 'ScatterplotLayer'])
    .describe('Layer types that can be created by AI'),

  /**
   * Current basemap style
   */
  mapStyle: z.string().optional().describe('Current basemap style URL'),

  /**
   * Application-specific metadata
   */
  metadata: z.record(z.string(), z.unknown()).optional().describe('Application-specific metadata'),
});

export type InitialState = z.infer<typeof initialStateSchema>;

// ============================================================================
// System Prompt Generator
// ============================================================================

/**
 * Generate a system prompt context string from initial state
 * This is used to provide AI with understanding of the current map state
 */
export function createSystemPromptWithState(initialState: InitialState): string {
  const sections: string[] = [];

  // View state section
  const vs = initialState.initialViewState;
  if (vs) {
    const viewInfo = [
      `Center: [${vs.longitude?.toFixed(4) ?? 'unknown'}, ${vs.latitude?.toFixed(4) ?? 'unknown'}]`,
      `Zoom: ${vs.zoom?.toFixed(1) ?? 'unknown'}`,
    ];
    if (vs.pitch && vs.pitch > 0) viewInfo.push(`Pitch: ${vs.pitch}°`);
    if (vs.bearing && vs.bearing !== 0) viewInfo.push(`Bearing: ${vs.bearing}°`);
    sections.push(`## Current View\n${viewInfo.join(' | ')}`);
  }

  // Layers section
  if (initialState.layerStates && initialState.layerStates.length > 0) {
    const layerLines = initialState.layerStates.map((layer) => {
      const status = layer.visible ? '✓' : '✗';
      const filterInfo = layer.hasActiveFilter ? ` [filtered: ${layer.filterDescription}]` : '';
      return `- ${status} **${layer.name || layer.id}** (${layer.type})${filterInfo}`;
    });
    sections.push(`## Layers\n${layerLines.join('\n')}`);
  }

  // Data sources section
  if (initialState.dataSources && initialState.dataSources.length > 0) {
    const sourceLines = initialState.dataSources.map((ds) => {
      const propInfo =
        ds.properties && ds.properties.length > 0
          ? `\n  Properties: ${ds.properties.map((p) => p.name).join(', ')}`
          : '';
      return `- **${ds.name || ds.id}** (${ds.type})${ds.description ? `: ${ds.description}` : ''}${propInfo}`;
    });
    sections.push(`## Data Sources\n${sourceLines.join('\n')}`);
  }

  // Available layer types
  if (initialState.availableLayerTypes && initialState.availableLayerTypes.length > 0) {
    sections.push(`## Available Layer Types\n${initialState.availableLayerTypes.join(', ')}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// State Serialization Helpers
// ============================================================================

/**
 * Create initial state from deck.gl instance
 * This is a helper type for frontend implementations
 */
export interface StateSerializationOptions {
  includeLayerSpecs?: boolean;
  includeDataSources?: boolean;
  maxPropertySamples?: number;
}

/**
 * Validate and parse initial state
 */
export function parseInitialState(data: unknown): InitialState {
  return initialStateSchema.parse(data);
}

/**
 * Validate initial state (returns validation result)
 */
export function validateInitialState(data: unknown) {
  return initialStateSchema.safeParse(data);
}

/**
 * Create a minimal initial state with just view and layers
 */
export function createMinimalInitialState(
  viewState: Partial<z.infer<typeof viewStateSpecSchema>>,
  layerStates: Array<Partial<z.infer<typeof layerStateMetadataSchema>>> = []
): InitialState {
  return {
    initialViewState: {
      longitude: viewState.longitude ?? 0,
      latitude: viewState.latitude ?? 0,
      zoom: viewState.zoom ?? 2,
      pitch: viewState.pitch ?? 0,
      bearing: viewState.bearing ?? 0,
    },
    layerStates: layerStates.map((l) => ({
      id: l.id ?? 'unknown',
      type: l.type ?? 'GeoJsonLayer',
      visible: l.visible ?? true,
      opacity: l.opacity ?? 1,
      ...l,
    })),
    availableLayerTypes: ['GeoJsonLayer', 'RasterTileLayer', 'ScatterplotLayer'],
  };
}
