/**
 * useDeckLayers Hook
 *
 * Converts JSON layer specs from DeckState into actual deck.gl Layer instances
 * using JSONConverter. Memoized to avoid unnecessary re-conversions.
 */

import { useMemo } from 'react';
import type { Layer } from '@deck.gl/core';
import { getJsonConverter } from '../config/deck-json-config';
import { environment } from '../config/environment';
import { useDeckState } from './useDeckState';

export function useDeckLayers(): Layer[] {
  const { state } = useDeckState();
  const layerSpecs = state.deckConfig.layers;

  return useMemo(() => {
    const jsonConverter = getJsonConverter();
    const convertedLayers: Layer[] = [];

    for (let index = 0; index < layerSpecs.length; index++) {
      const layerJson = layerSpecs[index];
      const layerId = (layerJson['id'] as string) || `layer-${index}`;

      try {
        const layerWithId = { ...layerJson, id: layerId };

        // Inject CARTO credentials
        const layerWithCredentials = injectCartoCredentials(layerWithId);

        const converted = jsonConverter.convert(layerWithCredentials);

        if (converted) {
          convertedLayers.push(converted as Layer);
          console.log('[useDeckLayers] Converted layer:', layerId);
        } else {
          console.error('[useDeckLayers] Failed to convert layer:', layerId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[useDeckLayers] Failed to convert layer:', layerId, errorMessage);
      }
    }

    return convertedLayers;
  }, [layerSpecs]);
}

function injectCartoCredentials(
  layerJson: Record<string, unknown>
): Record<string, unknown> {
  const layer = JSON.parse(JSON.stringify(layerJson));

  if (layer['data'] && typeof layer['data'] === 'object') {
    const data = layer['data'] as Record<string, unknown>;
    const funcName = data['@@function'] as string | undefined;

    if (funcName && funcName.toLowerCase().includes('source')) {
      data['accessToken'] = environment.accessToken;
      data['apiBaseUrl'] = environment.apiBaseUrl;
      data['connectionName'] = environment.connectionName;
    }
  }

  return layer;
}
