import type {
  DeckGLJsonSpec,
} from '../schemas/deckgl-json';

/**
 * Spec Generator Utilities
 *
 * Utility functions for working with @deck.gl/json specifications.
 * The consolidated tools (set-deck-state) accept raw deck.gl JSON,
 * so most spec generation is now handled by the AI directly.
 */

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge multiple DeckGLJsonSpecs into one
 */
export function mergeSpecs(...specs: DeckGLJsonSpec[]): DeckGLJsonSpec {
  const result: DeckGLJsonSpec = {};

  for (const spec of specs) {
    // Merge view state (later specs override earlier)
    if (spec.initialViewState) {
      result.initialViewState = {
        ...result.initialViewState,
        ...spec.initialViewState,
      };
    }

    // Merge layers (concatenate)
    if (spec.layers) {
      result.layers = [...(result.layers ?? []), ...spec.layers];
    }

    // Merge layer operations (concatenate)
    if (spec.layerOperations) {
      result.layerOperations = [
        ...(result.layerOperations ?? []),
        ...spec.layerOperations,
      ];
    }

    // Merge map style (later overrides)
    if (spec.mapStyle) {
      result.mapStyle = spec.mapStyle;
    }

    // Merge controller (later overrides)
    if (spec.controller !== undefined) {
      result.controller = spec.controller;
    }
  }

  return result;
}

/**
 * Check if a spec contains view state changes
 */
export function hasViewStateChanges(spec: DeckGLJsonSpec): boolean {
  return spec.initialViewState !== undefined;
}

/**
 * Check if a spec contains layer changes
 */
export function hasLayerChanges(spec: DeckGLJsonSpec): boolean {
  return (
    (spec.layers !== undefined && spec.layers.length > 0) ||
    (spec.layerOperations !== undefined && spec.layerOperations.length > 0)
  );
}

/**
 * Extract layer IDs affected by a spec
 */
export function getAffectedLayerIds(spec: DeckGLJsonSpec): string[] {
  const ids = new Set<string>();

  spec.layers?.forEach((layer) => ids.add(layer.id));
  spec.layerOperations?.forEach((op) => ids.add(op.layerId));

  return Array.from(ids);
}
