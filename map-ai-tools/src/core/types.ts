import type { Deck } from '@deck.gl/core';
import { z } from 'zod';
import { tools } from '../definitions/tools';

/**
 * Deck.gl instance type re-export for convenience
 */
export type { Deck } from '@deck.gl/core';

// ============================================================================
// Re-export @deck.gl/json spec types
// ============================================================================

export type {
  DeckGLJsonSpec,
  ViewStateSpec,
  LayerSpec,
  LayerOperation,
} from '../schemas/deckgl-json';

export type {
  InitialState,
  DataSourceMetadata,
  LayerStateMetadata,
} from '../schemas/initial-state';

export type {
  SupportedLayerType,
  AnyLayerSpec,
} from '../schemas/layer-specs';

// ============================================================================
// Zod-inferred parameter types (auto-generated from tool schemas)
// Consolidated tools only (3 tools)
// ============================================================================

/**
 * Parameters for set-map-view tool
 */
export type SetMapViewParams = z.infer<typeof tools['set-map-view']['schema']>;

/**
 * Parameters for set-basemap tool
 */
export type SetBasemapParams = z.infer<typeof tools['set-basemap']['schema']>;

/**
 * Parameters for set-deck-state tool
 */
export type SetDeckStateParams = z.infer<typeof tools['set-deck-state']['schema']>;

/**
 * Union type of all tool parameter types
 */
export type ToolParams =
  | SetMapViewParams
  | SetBasemapParams
  | SetDeckStateParams

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
