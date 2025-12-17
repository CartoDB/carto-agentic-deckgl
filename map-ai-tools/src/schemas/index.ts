/**
 * @deck.gl/json Schemas
 *
 * Export all Zod schemas for @deck.gl/json specification validation
 */

// Core @deck.gl/json schemas
export {
  // Primitive schemas
  colorArraySchema,
  accessorValueSchema,
  constantRefSchema,
  functionRefSchema,
  expressionSchema,
  // View state
  viewStateSpecSchema,
  type ViewStateSpec,
  // Layer specs
  layerSpecBaseSchema,
  layerSpecSchema,
  type LayerSpec,
  // Layer operations
  layerOperationTypeSchema,
  layerOperationSchema,
  type LayerOperation,
  // Main spec
  deckGLJsonSpecSchema,
  type DeckGLJsonSpec,
  // Query responses
  queryFeaturesResponseSchema,
  type QueryFeaturesResponse,
  aggregateFeaturesResponseSchema,
  type AggregateFeaturesResponse,
  getLayerConfigResponseSchema,
  type GetLayerConfigResponse,
  // Utility functions
  isSpecialPrefix,
  isFunctionRef,
  isConstantRef,
  isExpression,
  createFunctionRef,
  createConstantRef,
  createExpression,
} from './deckgl-json';

// Layer-specific schemas
export {
  // GeoJsonLayer
  geoJsonLayerSpecSchema,
  type GeoJsonLayerSpec,
  // RasterTileLayer
  rasterSourceConfigSchema,
  rasterTileLayerSpecSchema,
  type RasterTileLayerSpec,
  // ScatterplotLayer
  scatterplotLayerSpecSchema,
  type ScatterplotLayerSpec,
  // ArcLayer
  arcLayerSpecSchema,
  type ArcLayerSpec,
  // HexagonLayer
  hexagonLayerSpecSchema,
  type HexagonLayerSpec,
  // VectorTileLayer
  vectorTableSourceConfigSchema,
  vectorTileLayerSpecSchema,
  type VectorTileLayerSpec,
  // Utilities
  supportedLayerTypes,
  type SupportedLayerType,
  layerTypeSchema,
  getLayerSpecSchema,
  anyLayerSpecSchema,
  type AnyLayerSpec,
} from './layer-specs';

// Initial state schemas
export {
  // Data source metadata
  dataSourceTypeSchema,
  type DataSourceType,
  propertyMetadataSchema,
  type PropertyMetadata,
  dataSourceMetadataSchema,
  type DataSourceMetadata,
  // Layer state metadata
  layerStateMetadataSchema,
  type LayerStateMetadata,
  // Initial state
  initialStateSchema,
  type InitialState,
  // System prompt
  createSystemPromptWithState,
  // Helpers
  type StateSerializationOptions,
  parseInitialState,
  validateInitialState,
  createMinimalInitialState,
} from './initial-state';
