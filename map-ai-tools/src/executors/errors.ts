import { ToolError, ToolResponse } from './interface';

/**
 * Common error codes for tool operations
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  HTTP_ERROR: 'HTTP_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  LAYER_NOT_FOUND: 'LAYER_NOT_FOUND',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a standardized error object
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ToolError {
  return {
    code,
    message,
    details,
  };
}

/**
 * Format a successful tool response
 */
export function successResponse<T>(
  toolName: string,
  data: T,
  message?: string
): ToolResponse<T> {
  return {
    toolName,
    data,
    message,
  };
}

/**
 * Format an error tool response
 */
export function errorResponse(
  toolName: string,
  error: ToolError
): ToolResponse<never> {
  return {
    toolName,
    error,
  };
}

/**
 * Format a tool response with both data and optional message
 */
export function formatToolResponse<T = unknown>(
  toolName: string,
  response: Partial<ToolResponse<T>>
): ToolResponse<T> {
  return {
    toolName,
    data: response.data,
    message: response.message,
    error: response.error,
  };
}
