/**
 * useDeckProps Hook
 *
 * Converts the unified DeckSpec from state into actual deck.gl props
 * using JSONConverter.convert(fullSpec) — the official deck.gl pattern.
 *
 * This replaces the previous per-layer conversion approach (useDeckLayers)
 * with a single full-spec conversion that mirrors the deck.gl playground.
 */

import { useMemo } from 'react';
import { getJsonConverter } from '../config/deck-json-config';
import { environment } from '../config/environment';
import { useDeckState } from './useDeckState';

export function useDeckProps(): Record<string, unknown> {
  const { state } = useDeckState();
  const deckSpec = state.deckSpec;

  return useMemo(() => {
    const jsonConverter = getJsonConverter();

    // Inject credentials into layers (deep clone to avoid mutating state)
    const layers = (deckSpec.layers || []).map((layerJson, index) => {
      const layer = JSON.parse(JSON.stringify(layerJson));
      layer.id = layer.id || `layer-${index}`;
      return injectCartoCredentials(layer);
    });

    // Build the full spec (initialViewState is plain data — no class instances)
    const spec = {
      initialViewState: deckSpec.initialViewState,
      layers,
      widgets: deckSpec.widgets || [],
      effects: deckSpec.effects || [],
    };

    const converted = jsonConverter.convert(spec);
    if (converted) {
      console.log('[useDeckProps] Converted full spec:', {
        layers: layers.length,
        widgets: (deckSpec.widgets || []).length,
        effects: (deckSpec.effects || []).length,
      });
      return converted as Record<string, unknown>;
    }

    console.error('[useDeckProps] Failed to convert spec');
    return {};
  }, [deckSpec]);
}

function injectCartoCredentials(
  layerJson: Record<string, unknown>
): Record<string, unknown> {
  if (layerJson['data'] && typeof layerJson['data'] === 'object') {
    const data = layerJson['data'] as Record<string, unknown>;
    const funcName = data['@@function'] as string | undefined;

    if (funcName && funcName.toLowerCase().includes('source')) {
      data['accessToken'] = environment.accessToken;
      data['apiBaseUrl'] = environment.apiBaseUrl;
      data['connectionName'] = environment.connectionName;
    }
  }

  return layerJson;
}
