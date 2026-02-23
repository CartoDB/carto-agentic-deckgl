import { describe, it, expect } from 'vitest';
import { mergeLayerSpecs } from '../../../src/utils/layer-merge';

describe('mergeLayerSpecs', () => {
  it('adds new layers', () => {
    const existing = [{ id: 'a', color: 'red' }];
    const incoming = [{ id: 'b', color: 'blue' }];
    const result = mergeLayerSpecs(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ id: 'b', color: 'blue' });
  });

  it('deep merges existing layers by ID', () => {
    const existing = [{ id: 'a', data: { columns: ['x'], type: 'vector' } }];
    const incoming = [{ id: 'a', data: { columns: ['x', 'y'] } }];
    const result = mergeLayerSpecs(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'a',
      data: { columns: ['x', 'y'], type: 'vector' },
    });
  });

  it('preserves layers not in incoming', () => {
    const existing = [{ id: 'a', color: 'red' }, { id: 'b', color: 'blue' }];
    const incoming = [{ id: 'a', color: 'green' }];
    const result = mergeLayerSpecs(existing, incoming);
    expect(result).toHaveLength(2);
    expect(result[0].color).toBe('green');
    expect(result[1].color).toBe('blue');
  });
});
