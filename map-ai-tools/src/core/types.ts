import type { Deck } from '@deck.gl/core';

/**
 * Deck.gl instance type re-export for convenience
 */
export type { Deck } from '@deck.gl/core';

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
 * Context passed to tool executors
 */
export interface ExecutionContext {
  deck: Deck;
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
