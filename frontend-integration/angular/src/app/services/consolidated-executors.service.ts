/**
 * Consolidated Tool Executors Service
 *
 * Unified executor pattern using JSONConverter as the central engine.
 * All deck.gl state (viewState, basemap, layers, widgets, effects) is
 * managed through a single set-deck-state tool.
 *
 * Architecture:
 * - Executor updates DeckStateService (centralized state)
 * - DeckStateService notifies listeners on change
 * - DeckMapService.renderFromState() converts JSON → deck.gl layers
 */

import { Injectable } from '@angular/core';
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { DeckStateService, Basemap, LayerSpec } from '../state/deck-state.service';
import { mergeLayerSpecs, validateLayerColumns } from '../utils/layer-merge.utils';

// ==================== TYPES ====================

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

// ==================== PARAMETER TYPES ====================

interface SetDeckStateParams {
  initialViewState?: {
    latitude: number;
    longitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
    transitionDuration?: number;
  };
  mapStyle?: Basemap;
  layers?: LayerSpec[];
  widgets?: Record<string, unknown>[];
  effects?: Record<string, unknown>[];
  layerOrder?: string[];
  removeLayerIds?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class ConsolidatedExecutorsService {
  private executors: Record<string, ToolExecutor> = {};

  constructor(private deckState: DeckStateService) {
    this.executors = this.createExecutors();
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    const executor = this.executors[toolName];
    if (!executor) {
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
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

  private createExecutors(): Record<string, ToolExecutor> {
    return {
      // ==================== SET DECK STATE (unified) ====================
      [TOOL_NAMES.SET_DECK_STATE]: (params: unknown): ToolResult => {
        const paramsObj = params as SetDeckStateParams;
        const updatedParts: string[] = [];
        try {
          // Step 1: Update initialViewState if provided
          if (paramsObj.initialViewState) {
            const vs = paramsObj.initialViewState;
            this.deckState.setInitialViewState({
              latitude: vs.latitude,
              longitude: vs.longitude,
              zoom: vs.zoom,
              pitch: vs.pitch ?? 0,
              bearing: vs.bearing ?? 0,
              transitionDuration: vs.transitionDuration,
            });
            updatedParts.push('viewState');
          }

          // Step 2: Update basemap if provided
          if (paramsObj.mapStyle) {
            this.deckState.setBasemap(paramsObj.mapStyle);
            updatedParts.push('basemap');
          }

          // Step 3: Process layers/widgets/effects if any deck config fields are present
          const hasDeckConfigFields =
            'layers' in paramsObj ||
            'removeLayerIds' in paramsObj ||
            'layerOrder' in paramsObj ||
            'widgets' in paramsObj ||
            'effects' in paramsObj;

          if (hasDeckConfigFields) {
            const currentSpec = this.deckState.getDeckSpec();
            const currentConfig = {
              layers: currentSpec.layers,
              widgets: currentSpec.widgets,
              effects: currentSpec.effects
            };

            // Process layer removals FIRST
            let workingLayers = currentConfig.layers ?? [];
            if (paramsObj.removeLayerIds && paramsObj.removeLayerIds.length > 0) {
              const idsToRemove = new Set(paramsObj.removeLayerIds);
              workingLayers = workingLayers.filter(
                (layer) => !idsToRemove.has(layer['id'] as string),
              );
            }

            // Determine final layers based on explicit presence
            let finalLayers: LayerSpec[];
            const hasLayersProperty = 'layers' in paramsObj;
            const layersValue = paramsObj.layers;
            const isLayersArray = Array.isArray(layersValue);
            const isLayersEmpty = isLayersArray && layersValue.length === 0;

            if (hasLayersProperty) {
              if (isLayersEmpty) {
                // Empty array explicitly provided → replace (remove all)
                finalLayers = [];
              } else if (isLayersArray && layersValue.length > 0) {
                // Non-empty array provided → merge with working layers (after removals)
                finalLayers = mergeLayerSpecs(workingLayers, layersValue);
              } else {
                // layers is explicitly undefined or null → keep working layers
                finalLayers = workingLayers;
              }
            } else {
              // layers not provided → use working layers (after removals)
              finalLayers = workingLayers;
            }

            // Apply layer ordering if specified
            const { layerOrder } = paramsObj;
            if (layerOrder && layerOrder.length > 0) {
              const layerMap = new Map(finalLayers.map((l) => [l['id'] as string, l]));
              const orderedLayers: LayerSpec[] = [];

              for (const id of layerOrder) {
                const layer = layerMap.get(id);
                if (layer) {
                  orderedLayers.push(layer);
                  layerMap.delete(id);
                }
              }

              // Append remaining layers not in layerOrder
              for (const layer of layerMap.values()) {
                orderedLayers.push(layer);
              }

              finalLayers = orderedLayers;
            }

            // Determine final widgets
            let finalWidgets: Record<string, unknown>[];
            if ('widgets' in paramsObj) {
              if (paramsObj.widgets && paramsObj.widgets.length === 0) {
                finalWidgets = [];
              } else if (paramsObj.widgets) {
                finalWidgets = paramsObj.widgets;
              } else {
                finalWidgets = currentConfig.widgets ?? [];
              }
            } else {
              finalWidgets = currentConfig.widgets ?? [];
            }

            // Determine final effects
            let finalEffects: Record<string, unknown>[];
            if ('effects' in paramsObj) {
              if (paramsObj.effects && paramsObj.effects.length === 0) {
                finalEffects = [];
              } else if (paramsObj.effects) {
                finalEffects = paramsObj.effects;
              } else {
                finalEffects = currentConfig.effects ?? [];
              }
            } else {
              finalEffects = currentConfig.effects ?? [];
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

            this.deckState.setDeckLayers(config);

            // Track active layer
            if (finalLayers.length > 0) {
              const lastLayerId = finalLayers[finalLayers.length - 1]['id'] as string;
              if (lastLayerId) {
                this.deckState.setActiveLayerId(lastLayerId);
              }
            } else {
              this.deckState.setActiveLayerId(undefined);
            }

            updatedParts.push(
              `${config.layers.length} layer(s), ${config.widgets.length} widget(s), ${config.effects.length} effect(s)`,
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
