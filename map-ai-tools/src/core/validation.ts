import { ToolDefinition } from './types';

/**
 * Validate parameters against tool schema
 */
export function validateParameters(
  _toolName: string,
  params: any,
  definition: ToolDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = definition.function.parameters;
  const required = schema.required || [];

  // Check required parameters
  for (const requiredParam of required) {
    if (!(requiredParam in params)) {
      errors.push(`Missing required parameter: ${requiredParam}`);
    }
  }

  // Validate parameter types (basic validation)
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramSchema = schema.properties[paramName];
    if (!paramSchema) {
      errors.push(`Unknown parameter: ${paramName}`);
      continue;
    }

    // Type validation
    if (paramSchema.type) {
      const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
      if (paramSchema.type !== actualType) {
        errors.push(
          `Invalid type for ${paramName}: expected ${paramSchema.type}, got ${actualType}`
        );
      }
    }

    // Enum validation
    if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
      errors.push(
        `Invalid value for ${paramName}: must be one of [${paramSchema.enum.join(', ')}]`
      );
    }

    // Number range validation
    if (typeof paramValue === 'number') {
      if (paramSchema.minimum !== undefined && paramValue < paramSchema.minimum) {
        errors.push(`${paramName} must be >= ${paramSchema.minimum}`);
      }
      if (paramSchema.maximum !== undefined && paramValue > paramSchema.maximum) {
        errors.push(`${paramName} must be <= ${paramSchema.maximum}`);
      }
    }

    // Array validation
    if (Array.isArray(paramValue)) {
      if (paramSchema.minItems && paramValue.length < paramSchema.minItems) {
        errors.push(`${paramName} must have at least ${paramSchema.minItems} items`);
      }
      if (paramSchema.maxItems && paramValue.length > paramSchema.maxItems) {
        errors.push(`${paramName} must have at most ${paramSchema.maxItems} items`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
