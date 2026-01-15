/**
 * Property matching utilities for filtering and querying features
 * Centralizes the duplicated matching logic from QUERY_FEATURES and FILTER_FEATURES_BY_PROPERTY
 */

/**
 * Supported filter operators
 */
export const FILTER_OPERATORS = {
  ALL: 'all',
  EQUALS: 'equals',
  STARTS_WITH: 'startsWith',
  CONTAINS: 'contains',
  REGEX: 'regex',
};

/**
 * Create a filter function for matching feature properties
 *
 * @param {string} property - The property name to match against
 * @param {string} operator - The operator to use (equals, startsWith, contains, regex, all)
 * @param {string} value - The value to match
 * @returns {Function} A function that takes a feature and returns boolean
 */
export function createPropertyMatcher(property, operator, value) {
  return (feature) => {
    // 'all' operator matches everything
    if (operator === FILTER_OPERATORS.ALL) {
      return true;
    }

    const propValue = String(feature.properties[property] || '');

    switch (operator) {
      case FILTER_OPERATORS.EQUALS:
        return propValue === value;

      case FILTER_OPERATORS.STARTS_WITH:
        return propValue.startsWith(value);

      case FILTER_OPERATORS.CONTAINS:
        return propValue.includes(value);

      case FILTER_OPERATORS.REGEX:
        try {
          return new RegExp(value).test(propValue);
        } catch {
          // Invalid regex, return false
          return false;
        }

      default:
        return false;
    }
  };
}

/**
 * Create a color accessor function based on filter rules
 * Used for COLOR_FEATURES_BY_PROPERTY
 *
 * @param {Array} filters - Array of filter objects with {property, operator, value, color}
 * @param {Array} defaultColor - Default RGBA color array [r, g, b, a]
 * @returns {Function} A function that takes a feature and returns a color array
 */
export function createColorAccessorFromFilters(filters, defaultColor = [200, 0, 80, 180]) {
  return (feature) => {
    for (const filter of filters) {
      const matcher = createPropertyMatcher(filter.property, filter.operator, filter.value);
      if (matcher(feature)) {
        return filter.color;
      }
    }
    return defaultColor;
  };
}

/**
 * Filter features from a GeoJSON object using a matcher
 *
 * @param {Object} geojson - GeoJSON object with features array
 * @param {Function} matcher - Matcher function from createPropertyMatcher
 * @returns {Object} New GeoJSON object with filtered features
 */
export function filterFeatures(geojson, matcher) {
  if (!geojson || !geojson.features) {
    return geojson;
  }

  return {
    ...geojson,
    features: geojson.features.filter(matcher),
  };
}

/**
 * Count features matching a filter
 *
 * @param {Object} geojson - GeoJSON object with features array
 * @param {Function} matcher - Matcher function from createPropertyMatcher
 * @returns {Object} Object with count, total, and matching features
 */
export function countMatchingFeatures(geojson, matcher) {
  if (!geojson || !geojson.features) {
    return { count: 0, total: 0, matchingFeatures: [] };
  }

  const matchingFeatures = geojson.features.filter(matcher);

  return {
    count: matchingFeatures.length,
    total: geojson.features.length,
    matchingFeatures,
  };
}
