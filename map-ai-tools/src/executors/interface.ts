/**
 * Standard request interface for tool execution
 */
export interface ToolRequest {
  toolName: string;
  params: Record<string, unknown>;
}

/**
 * Standard error interface for tool responses
 */
export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard response interface for tool execution
 */
export interface ToolResponse<T = unknown> {
  toolName: string;
  data?: T;
  message?: string;
  error?: ToolError;
}

/**
 * Parsed tool response structure
 */
export interface ParsedToolResponse<T = unknown> {
  toolName: string;
  data: T | undefined;
  error: ToolError | undefined;
  message: string | undefined;
}

/**
 * Type-specific response interfaces for built-in tools
 */
export interface FlyToResponse {
  lat: number;
  lng: number;
  zoom: number;
}

export interface ZoomMapResponse {
  direction: 'in' | 'out';
  levels: number;
  newZoom: number;
}

export interface ToggleLayerResponse {
  layerId: string;
  visible: boolean;
}

export interface SetPointColorResponse {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface ColorFeaturesByPropertyResponse {
  layerId: string;
  property: string;
  operator: string;
  value: string;
  color: [number, number, number, number];
}

export interface QueryFeaturesResponse {
  count: number;
  total: number;
  sampleNames?: string[];
}

export interface FilterFeaturesResponse {
  filteredCount: number;
  totalCount: number;
}

export interface SizeFeaturesResponse {
  property: string;
  rulesApplied: number;
}

export interface AggregateFeaturesResponse {
  groupBy: string;
  total: number;
  groups: Array<{ value: string; count: number }>;
}
