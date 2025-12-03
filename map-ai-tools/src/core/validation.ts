import { ToolDefinition } from './types';
import { tools, type ToolName, validateToolParams as zodValidate } from '../definitions/tools';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: unknown;
}

/**
 * Validate parameters using Zod schema (recommended)
 * Returns typed validation result with parsed data
 */
export function validateWithZod(toolName: string, params: unknown): ValidationResult {
  if (!(toolName in tools)) {
    return {
      valid: false,
      errors: [`Unknown tool: ${toolName}`]
    };
  }

  const result = zodValidate(toolName as ToolName, params);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      data: result.data
    };
  }

  // Extract error messages from Zod errors
  const errors = result.error.errors.map((err: { path: (string | number)[]; message: string }) => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  });

  return {
    valid: false,
    errors
  };
}

/**
 * Validate parameters against tool schema
 * @deprecated Use validateWithZod() for better type safety and validation
 */
export function validateParameters(
  toolName: string,
  params: any,
  _definition: ToolDefinition
): { valid: boolean; errors: string[] } {
  // Use Zod validation under the hood
  const result = validateWithZod(toolName, params);
  return {
    valid: result.valid,
    errors: result.errors
  };
}
