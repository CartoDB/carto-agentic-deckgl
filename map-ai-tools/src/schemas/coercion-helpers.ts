import * as z from 'zod';

/**
 * Schema coercion helpers for handling OpenAI API quirks
 * OpenAI sometimes sends all parameter values as strings, even for numbers and booleans.
 * These helpers coerce string values back to their proper types.
 */

/**
 * Coerce string values to numbers
 */
export const coerceNumber = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  }
  return val;
};

/**
 * Coerce string values to booleans
 */
export const coerceBoolean = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') return true;
    if (val.toLowerCase() === 'false') return false;
  }
  return val;
};

/**
 * Coerce color values (passthrough for now, but allows for future validation)
 */
export const coerceColor = (val: unknown) => {
  if (val === '' || val === null || val === undefined) return undefined;
  return val;
};

/**
 * Color schema: accepts either color name string or RGBA array
 */
export const colorSchema = z.preprocess(
  coerceColor,
  z.union([
    z.string().min(1).describe('Color name (red, blue, green, yellow, orange, purple, pink, cyan, white, black, gray)'),
    z.array(z.number()).min(3).max(4).describe('RGBA array [r,g,b] or [r,g,b,a], values 0-255'),
  ]).nullable().optional()
);

/**
 * Number schema that coerces strings to numbers with optional min/max validation
 */
export const optionalNumber = (min?: number, max?: number) => z.preprocess(
  coerceNumber,
  (() => {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema.nullable().optional();
  })()
);

/**
 * Boolean schema that coerces strings to booleans
 */
export const optionalBoolean = z.preprocess(
  coerceBoolean,
  z.boolean().nullable().optional()
);
