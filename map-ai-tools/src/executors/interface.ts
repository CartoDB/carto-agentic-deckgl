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
