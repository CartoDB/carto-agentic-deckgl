import { describe, it, expect } from 'vitest';
import { coerceNumber, coerceBoolean, coerceColor } from '../../../src/schemas/coercion-helpers.js';

describe('coerceNumber', () => {
  it('passes through numbers', () => {
    expect(coerceNumber(42)).toBe(42);
    expect(coerceNumber(0)).toBe(0);
    expect(coerceNumber(-3.14)).toBe(-3.14);
  });

  it('converts string to number', () => {
    expect(coerceNumber('42')).toBe(42);
    expect(coerceNumber('3.14')).toBe(3.14);
  });

  it('returns undefined for empty/null/undefined', () => {
    expect(coerceNumber('')).toBeUndefined();
    expect(coerceNumber(null)).toBeUndefined();
    expect(coerceNumber(undefined)).toBeUndefined();
  });

  it('returns undefined for non-numeric strings', () => {
    expect(coerceNumber('abc')).toBeUndefined();
  });
});

describe('coerceBoolean', () => {
  it('passes through booleans', () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
  });

  it('converts string to boolean', () => {
    expect(coerceBoolean('true')).toBe(true);
    expect(coerceBoolean('false')).toBe(false);
    expect(coerceBoolean('TRUE')).toBe(true);
    expect(coerceBoolean('False')).toBe(false);
  });

  it('returns undefined for empty/null/undefined', () => {
    expect(coerceBoolean('')).toBeUndefined();
    expect(coerceBoolean(null)).toBeUndefined();
    expect(coerceBoolean(undefined)).toBeUndefined();
  });
});

describe('coerceColor', () => {
  it('passes through values', () => {
    expect(coerceColor('red')).toBe('red');
    expect(coerceColor([255, 0, 0])).toEqual([255, 0, 0]);
  });

  it('returns undefined for empty/null/undefined', () => {
    expect(coerceColor('')).toBeUndefined();
    expect(coerceColor(null)).toBeUndefined();
    expect(coerceColor(undefined)).toBeUndefined();
  });
});
