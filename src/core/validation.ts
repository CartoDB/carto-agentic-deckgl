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

  // Extract error messages from Zod issues
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return {
    valid: false,
    errors
  };
}
