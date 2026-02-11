/**
 * Semantic Layer Module
 *
 * Exports semantic layer types, loader functions, and utilities
 * for integrating data context into AI prompts.
 */

// Type exports
export type {
  SemanticLayer,
  GeoCube,
  GeoDimension,
  GeoMeasure,
  GeoJoin,
  GeoCubeConfig,
  GeoVizHint,
  BusinessType,
  DemographicOption,
  ProximityPriority,
} from './schema.js';

// Loader function exports
export {
  loadSemanticLayer,
  renderSemanticLayerAsMarkdown,
  getPrimaryCube,
  getInitialViewState,
  getWelcomeMessage,
} from './loader.js';
