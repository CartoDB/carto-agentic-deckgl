/**
 * Geo-Extended Cube Schema Types
 * Based on Cube.dev format with geo-specific extensions
 * Extended for Business Location use case
 */

export interface GeoCubeConfig {
  geometry_column: string;
  geometry_type: 'point' | 'line' | 'polygon' | 'h3' | 'quadbin';
  srid?: number;
  initial_view?: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  };
}

export interface GeoVizHint {
  style: 'colorContinuous' | 'colorBins' | 'colorCategories';
  palette?: string;
  domain?: number[];
  categories?: string[];
  recommended?: boolean;
}

export interface GeoDimension {
  name: string;
  sql: string;
  type: 'string' | 'number' | 'time' | 'boolean' | 'geometry';
  title?: string;
  description?: string;
  primary_key?: boolean;
  geo_viz?: GeoVizHint;
}

export interface GeoMeasure {
  name: string;
  sql: string;
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'number';
  title?: string;
  description?: string;
}

export interface GeoJoin {
  name: string;
  relationship: 'one_to_one' | 'one_to_many' | 'many_to_one';
  sql: string;
}

export interface GeoCube {
  name: string;
  sql_table: string;
  title?: string;
  description?: string;
  data_source?: string;
  geo: GeoCubeConfig;
  dimensions: GeoDimension[];
  measures?: GeoMeasure[];
  joins?: GeoJoin[];
}

/**
 * Business Type configuration for location analysis
 */
export interface BusinessType {
  id: string;
  name: string;
  icon?: string;
  relevant_pois?: string[];
  demographic_factors?: string[];
  description?: string;
}

/**
 * Demographic option for analysis
 */
export interface DemographicOption {
  id: string;
  name: string;
  description?: string;
  cube_dimension?: string;
}

/**
 * Proximity priority for POI weighting
 */
export interface ProximityPriority {
  id: string;
  name: string;
  poi_category?: string;
  default_weight?: number;
  description?: string;
}

/**
 * Extended Semantic Layer with business context
 */
export interface SemanticLayer {
  name: string;
  description: string;
  welcome_message: string;
  cubes: GeoCube[];

  // Business location extensions
  business_types?: BusinessType[];
  demographic_options?: DemographicOption[];
  proximity_priorities?: ProximityPriority[];
}
