import { ToolRequest, ToolResponse, ToolError } from './interface';

/**
 * Options for the send function
 */
export interface SendOptions {
  baseUrl: string;
  endpoint?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Send a tool request to the backend
 * @param request - The tool request containing toolName and params
 * @param options - Configuration options for the request
 * @returns A promise resolving to the tool response
 */
export async function send<T = unknown>(
  request: ToolRequest,
  options: SendOptions
): Promise<ToolResponse<T>> {
  const { baseUrl, endpoint = '/api/chat', headers = {}, timeout = 30000 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        toolName: request.toolName,
        error: {
          code: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }

    const data = await response.json();

    return {
      toolName: request.toolName,
      data: data.data as T,
      message: data.message,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        toolName: request.toolName,
        error: {
          code: 'TIMEOUT_ERROR',
          message: `Request timed out after ${timeout}ms`,
        },
      };
    }

    return {
      toolName: request.toolName,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Create a tool request object
 */
export function createToolRequest(
  toolName: string,
  params: Record<string, unknown>
): ToolRequest {
  return { toolName, params };
}

/**
 * Parse a tool response into a standardized structure
 */
export function parseToolResponse<T = unknown>(
  response: ToolResponse<T> | Record<string, unknown>
): {
  toolName: string;
  data: T | undefined;
  error: ToolError | undefined;
  message: string | undefined;
} {
  // Handle both new format (toolName) and legacy format (tool_name)
  const toolName = (response as ToolResponse<T>).toolName ||
                   (response as Record<string, unknown>).tool_name as string ||
                   '';

  const error = (response as ToolResponse<T>).error;
  const data = error ? undefined : (response as ToolResponse<T>).data as T;
  const message = (response as ToolResponse<T>).message;

  return {
    toolName,
    data,
    error,
    message,
  };
}

/**
 * Type guard to check if a response is successful
 */
export function isSuccessResponse<T>(
  response: ToolResponse<T>
): response is ToolResponse<T> & { data: T } {
  return response.error === undefined && response.data !== undefined;
}

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse<T>(
  response: ToolResponse<T>
): response is ToolResponse<T> & { error: ToolError } {
  return response.error !== undefined;
}
