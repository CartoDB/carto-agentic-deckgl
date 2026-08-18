/**
 * Semantic Model Module (Apache Ossie)
 *
 * Exports semantic model types, loader functions, CARTO extension helpers,
 * and utilities for integrating data context into AI prompts.
 */

// Type exports
export type {
  SemanticModel,
  SemanticModelBody,
  OssieDocument,
  Dataset,
  Field,
  Metric,
  Relationship,
  CustomExtension,
  AiContext,
  Datatype,
  CartoSpatialData,
  CartoVisualizationHint,
  CartoSpatialRelationship,
  CartoModelExtension,
  WelcomeChip,
} from './schema.js';

// Schema exports (for external validation)
// `ossieDocumentSchema` validates the on-disk/wire format; `semanticModelSchema`
// is the internal already-merged single-model shape.
export { ossieDocumentSchema, semanticModelSchema } from './schema.js';

// Loader and renderer exports
export {
  loadSemanticModel,
  renderSemanticModelAsMarkdown,
  clearSemanticModelCache,
  getInitialViewState,
  getWelcomeMessage,
  getWelcomeChips,
} from './loader.js';

// CARTO extension helper exports
export {
  getCartoExtension,
  getDatasetSpatialData,
  getFieldVisualizationHint,
  getModelCartoConfig,
  getMetricGroup,
} from './loader.js';
