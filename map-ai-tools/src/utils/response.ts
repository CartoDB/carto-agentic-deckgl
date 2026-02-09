// Import type definitions from canonical location
import type { ToolError, ToolResponse, ParsedToolResponse } from '../executors/interface';

// Re-export for convenience
export type { ToolError, ToolResponse, ParsedToolResponse };

/**
 * Legacy tool response interface (internal - for backwards compatibility parsing)
 * Not exported - used only for runtime type checking of old format responses
 */
interface LegacyToolResponse<T = unknown> {
  success: boolean;
  tool_name: string;
  data?: T;
  message?: string;
  error?: ToolError;
}

/**
 * Parse a tool response for easier consumption
 * Supports both new format (toolName) and legacy format (tool_name)
 *
 * @param response The tool response to parse
 * @returns Parsed response with separated data and error
 *
 * @example
 * ```typescript
 * const { toolName, data, error, message } = parseToolResponse(response);
 * if (error) {
 *   console.error(error.message);
 * } else {
 *   executeToolAction(toolName, data);
 * }
 * ```
 */
export function parseToolResponse<T>(
  response: ToolResponse<T> | LegacyToolResponse<T> | Record<string, unknown>
): ParsedToolResponse<T> {
  // Support both new format (toolName) and legacy format (tool_name)
  const toolName = (response as ToolResponse<T>).toolName ||
                   (response as LegacyToolResponse<T>).tool_name ||
                   (response as Record<string, unknown>).tool_name as string ||
                   '';

  // Check for error - in legacy format, success: false means error
  // In new format, presence of error field means error
  const hasError = (response as ToolResponse<T>).error !== undefined ||
                   ((response as LegacyToolResponse<T>).success === false);

  const error = hasError ? (response as ToolResponse<T>).error : undefined;
  const data = hasError ? undefined : (response as ToolResponse<T>).data as T;
  const message = (response as ToolResponse<T>).message;

  return {
    toolName,
    data,
    error,
    message,
  };
}

/**
 * Check if a response indicates success
 */
export function isSuccessResponse<T>(
  response: ToolResponse<T> | LegacyToolResponse<T>
): boolean {
  // New format: success if no error
  if ((response as ToolResponse<T>).toolName !== undefined) {
    return (response as ToolResponse<T>).error === undefined;
  }
  // Legacy format: check success field
  return (response as LegacyToolResponse<T>).success === true;
}

/**
 * Check if a response indicates an error
 */
export function isErrorResponse<T>(
  response: ToolResponse<T> | LegacyToolResponse<T>
): boolean {
  // New format: error if error field present
  if ((response as ToolResponse<T>).toolName !== undefined) {
    return (response as ToolResponse<T>).error !== undefined;
  }
  // Legacy format: check success field
  return (response as LegacyToolResponse<T>).success === false;
}
