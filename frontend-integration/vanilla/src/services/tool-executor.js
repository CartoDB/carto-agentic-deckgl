/**
 * Tool Executor
 *
 * Unified executor for the set-deck-state tool.
 * Port of Angular's ConsolidatedExecutorsService.
 */

import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { mergeLayerSpecs, validateLayerColumns } from '../utils/layer-merge.js';

export class ToolExecutor {
  constructor(deckState) {
    this._deckState = deckState;
    this._executors = this._createExecutors();
  }

  async execute(toolName, params) {
    const executor = this._executors[toolName];
    if (!executor) {
      return { success: false, message: `Unknown tool: ${toolName}` };
    }

    try {
      return await Promise.resolve(executor(params));
    } catch (error) {
      return {
        success: false,
        message: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  _createExecutors() {
    return {
      [TOOL_NAMES.SET_DECK_STATE]: (params) => {
        const updatedParts = [];
        try {
          // Step 1: Update view state
          if (params.initialViewState) {
            const vs = params.initialViewState;
            this._deckState.setInitialViewState({
              latitude: vs.latitude,
              longitude: vs.longitude,
              zoom: vs.zoom,
              pitch: vs.pitch ?? 0,
              bearing: vs.bearing ?? 0,
              transitionDuration: vs.transitionDuration,
            });
            updatedParts.push('viewState');
          }

          // Step 2: Update basemap
          if (params.mapStyle) {
            this._deckState.setBasemap(params.mapStyle);
            updatedParts.push('basemap');
          }

          // Step 3: Process deck config
          const hasDeckConfigFields =
            'layers' in params ||
            'removeLayerIds' in params ||
            'layerOrder' in params ||
            'widgets' in params ||
            'effects' in params;

          if (hasDeckConfigFields) {
            const currentSpec = this._deckState.getDeckSpec();

            // Process layer removals FIRST
            let workingLayers = currentSpec.layers ?? [];
            if (params.removeLayerIds && params.removeLayerIds.length > 0) {
              const idsToRemove = new Set(params.removeLayerIds);
              workingLayers = workingLayers.filter(
                (layer) => !idsToRemove.has(layer['id'])
              );
            }

            // Determine final layers
            let finalLayers;
            const hasLayersProperty = 'layers' in params;
            const layersValue = params.layers;
            const isLayersArray = Array.isArray(layersValue);
            const isLayersEmpty = isLayersArray && layersValue.length === 0;

            if (hasLayersProperty) {
              if (isLayersEmpty) {
                finalLayers = [];
              } else if (isLayersArray && layersValue.length > 0) {
                finalLayers = mergeLayerSpecs(workingLayers, layersValue);
              } else {
                finalLayers = workingLayers;
              }
            } else {
              finalLayers = workingLayers;
            }

            // Apply layer ordering
            if (params.layerOrder && params.layerOrder.length > 0) {
              const layerMap = new Map(finalLayers.map((l) => [l['id'], l]));
              const orderedLayers = [];

              for (const id of params.layerOrder) {
                const layer = layerMap.get(id);
                if (layer) {
                  orderedLayers.push(layer);
                  layerMap.delete(id);
                }
              }

              for (const layer of layerMap.values()) {
                orderedLayers.push(layer);
              }

              finalLayers = orderedLayers;
            }

            // Determine final widgets
            let finalWidgets;
            if ('widgets' in params) {
              if (params.widgets && params.widgets.length === 0) {
                finalWidgets = [];
              } else if (params.widgets) {
                finalWidgets = params.widgets;
              } else {
                finalWidgets = currentSpec.widgets ?? [];
              }
            } else {
              finalWidgets = currentSpec.widgets ?? [];
            }

            // Determine final effects
            let finalEffects;
            if ('effects' in params) {
              if (params.effects && params.effects.length === 0) {
                finalEffects = [];
              } else if (params.effects) {
                finalEffects = params.effects;
              } else {
                finalEffects = currentSpec.effects ?? [];
              }
            } else {
              finalEffects = currentSpec.effects ?? [];
            }

            const config = {
              layers: finalLayers,
              widgets: finalWidgets,
              effects: finalEffects,
            };

            // Validate columns
            for (const layer of config.layers) {
              validateLayerColumns(layer);
            }

            this._deckState.setDeckLayers(config);

            // Track active layer
            if (finalLayers.length > 0) {
              const lastLayerId = finalLayers[finalLayers.length - 1]['id'];
              if (lastLayerId) {
                this._deckState.setActiveLayerId(lastLayerId);
              }
            } else {
              this._deckState.setActiveLayerId(undefined);
            }

            updatedParts.push(
              `${config.layers.length} layer(s), ${config.widgets.length} widget(s), ${config.effects.length} effect(s)`
            );
          }

          return {
            success: true,
            message: `Updated: ${updatedParts.join(', ')}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set deck state: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    };
  }
}
