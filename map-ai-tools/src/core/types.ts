import type { Deck } from '@deck.gl/core';
import { z } from 'zod';
import { tools } from '../definitions/tools';

/**
 * Deck.gl instance type re-export for convenience
 */
export type { Deck } from '@deck.gl/core';

// ============================================================================
// Zod-inferred parameter types (auto-generated from tool schemas)
// ============================================================================

/**
 * Parameters for fly-to tool
 */
export type FlyToParams = z.infer<typeof tools['fly-to']['schema']>;

/**
 * Parameters for zoom-map tool
 */
export type ZoomMapParams = z.infer<typeof tools['zoom-map']['schema']>;

/**
 * Parameters for toggle-layer tool
 */
export type ToggleLayerParams = z.infer<typeof tools['toggle-layer']['schema']>;

/**
 * Parameters for set-point-color tool
 */
export type SetPointColorParams = z.infer<typeof tools['set-point-color']['schema']>;

/**
 * Parameters for color-features-by-property tool
 */
export type ColorFeaturesByPropertyParams = z.infer<typeof tools['color-features-by-property']['schema']>;

/**
 * Parameters for query-features tool
 */
export type QueryFeaturesParams = z.infer<typeof tools['query-features']['schema']>;

/**
 * Parameters for filter-features-by-property tool
 */
export type FilterFeaturesByPropertyParams = z.infer<typeof tools['filter-features-by-property']['schema']>;

/**
 * Parameters for size-features-by-property tool
 */
export type SizeFeaturesByPropertyParams = z.infer<typeof tools['size-features-by-property']['schema']>;

/**
 * Parameters for aggregate-features tool
 */
export type AggregateFeaturesParams = z.infer<typeof tools['aggregate-features']['schema']>;

/**
 * Union type of all tool parameter types
 */
export type ToolParams =
  | FlyToParams
  | ZoomMapParams
  | ToggleLayerParams
  | SetPointColorParams
  | ColorFeaturesByPropertyParams
  | QueryFeaturesParams
  | FilterFeaturesByPropertyParams
  | SizeFeaturesByPropertyParams
  | AggregateFeaturesParams;

/**
 * OpenAI function calling tool definition
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Tool executor function signature
 */
export type ToolExecutor<TParams = any, TResult = any> = (
  params: TParams,
  context: ExecutionContext
) => Promise<ExecutionResult<TResult>> | ExecutionResult<TResult>;

/**
 * View state for deck.gl map
 */
export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
}

/**
 * MapLibre map instance type (using any to avoid dependency)
 */
export type MapInstance = any;

/**
 * Context passed to tool executors
 */
export interface ExecutionContext {
  deck: Deck;
  map?: MapInstance;
  metadata?: Record<string, any>;
}

/**
 * Result of tool execution
 */
export interface ExecutionResult<TData = any> {
  success: boolean;
  message?: string;
  data?: TData;
  error?: Error;
}

/**
 * Custom tool definition for extensions
 */
export interface CustomToolDefinition {
  name: string;
  definition: ToolDefinition;
  executor: ToolExecutor;
}

/**
 * Tool interceptors for hooks
 */
export interface ToolInterceptors {
  beforeExecute?: (toolName: string, params: any) => void | Promise<void>;
  afterExecute?: (toolName: string, result: ExecutionResult) => void | Promise<void>;
  onError?: (toolName: string, error: Error) => void | Promise<void>;
}

/**
 * Library configuration
 */
export interface MapToolsConfig {
  deck: Deck;
  map?: MapInstance;  // Optional MapLibre map instance for view sync
  tools?: string[];  // Tool names to include (default: all)
  customTools?: CustomToolDefinition[];
  toolInterceptors?: ToolInterceptors;
  metadata?: Record<string, any>;
}

/**
 * System prompt configuration
 */
export interface PromptConfig {
  additionalContext?: string;
  customInstructions?: string;
}
