/**
 * Barrel export for deck.gl utilities
 */

export { scheduleRedraws, REDRAW_PRESETS } from './redraw';

export {
  createPropertyMatcher,
  createColorAccessorFromFilters,
  filterFeatures,
  countMatchingFeatures,
  FILTER_OPERATORS,
} from './propertyMatcher';

export {
  findLayerById,
  resolveLayerId,
  updateLayer,
  cloneLayerWithProps,
  syncMapLibreView,
  layerExists,
  getLayerData,
} from './layerUtils';
