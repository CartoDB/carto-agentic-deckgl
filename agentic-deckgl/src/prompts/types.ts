/**
 * Type definitions for prompt system
 */

/**
 * Configuration for a tool prompt
 */
export interface ToolPromptConfig {
  name: string;
  prompt: string;
  examples?: string[];
  notes?: string[];
}

/**
 * Map view state
 */
export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/**
 * Layer state information
 */
export interface LayerState {
  id: string;
  type?: string;
  visible?: boolean;
  [key: string]: unknown;
}

/**
 * Current map state for context injection
 */
export interface MapState {
  viewState?: MapViewState;
  initialViewState?: MapViewState;
  layers?: LayerState[];
  activeLayerId?: string;
}

/**
 * Priority weighting for proximity analysis
 */
export interface ProximityWeight {
  id?: string;
  name: string;
  weight: number; // 1-10 scale
}

/**
 * User context for business location analysis
 */
export interface UserContext {
  /**
   * Analysis type identifier (e.g., 'competitor', 'demographic')
   */
  analysisType?: string;

  /**
   * Human-readable analysis type name
   */
  analysisTypeName?: string;

  /**
   * Target country for analysis (default: United States)
   */
  country?: string;

  /**
   * Type of business being analyzed (POI category ID)
   */
  businessType?: string;

  /**
   * Human-readable business type / POI category name
   */
  businessTypeName?: string;

  /**
   * Search radius value
   */
  selectedRadius?: number;

  /**
   * Unit for the search radius
   */
  radiusUnit?: 'miles' | 'km';

  /**
   * Selected demographic factors to consider
   */
  demographics?: string[];

  /**
   * Weighted proximity priorities for POI analysis
   */
  proximityPriorities?: ProximityWeight[];

  /**
   * Optional: specific area/region of interest
   */
  targetArea?: {
    name?: string;
    bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  };

  /**
   * Selected location ID or 'custom'
   */
  selectedLocation?: string;

  /**
   * Human-readable location name
   */
  selectedLocationName?: string;

  /**
   * Custom location text entered by user
   */
  customLocation?: string;

  /**
   * Preset coordinates for the location (if available)
   */
  locationCoordinates?: { longitude: number; latitude: number };
}

/**
 * Options for building the system prompt
 */
export interface BuildSystemPromptOptions {
  /**
   * List of tool names available to the agent
   */
  toolNames: string[];

  /**
   * Initial/current map state for context
   */
  initialState?: MapState;

  /**
   * User context for business analysis
   */
  userContext?: UserContext;

  /**
   * Pre-rendered semantic context markdown (app-specific)
   */
  semanticContext?: string;

  /**
   * List of MCP tool names - enables MCP instructions if provided
   */
  mcpToolNames?: string[];

  /**
   * Additional prompt text to append (app-specific)
   */
  additionalPrompt?: string;
}
