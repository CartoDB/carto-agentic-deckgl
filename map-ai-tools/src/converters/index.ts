/**
 * Spec Converters
 *
 * Export all spec generator functions for @deck.gl/json output
 */

export {
  // View state generators
  generateFlyToSpec,
  generateZoomSpec,
  generateViewStateSpec,
  type FlyToParams,
  type ZoomMapParams,
  type SetViewStateParams,
  // Layer operation generators
  generateToggleLayerSpec,
  generateSetPointColorSpec,
  generateColorByPropertySpec,
  generateFilterSpec,
  generateSizeByPropertySpec,
  type ToggleLayerParams,
  type SetPointColorParams,
  type ColorFeaturesByPropertyParams,
  type FilterFeaturesByPropertyParams,
  type SizeFeaturesByPropertyParams,
  // Layer management generators
  generateAddLayerSpec,
  generateAddRasterLayerSpec,
  generateAddVectorLayerSpec,
  generateRemoveLayerSpec,
  generateUpdateLayerPropsSpec,
  type AddLayerParams,
  type AddRasterLayerParams,
  type AddVectorLayerParams,
  type RemoveLayerParams,
  type UpdateLayerPropsParams,
  // Utilities
  mergeSpecs,
  hasViewStateChanges,
  hasLayerChanges,
  getAffectedLayerIds,
} from './spec-generator';
