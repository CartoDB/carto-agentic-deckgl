/**
 * Consolidated Tool Executors Service
 *
 * Simplified executor pattern using JSONConverter as the central engine.
 * Angular equivalent of Vanilla's consolidated-executors.ts
 *
 * Architecture:
 * - Executors update DeckStateService (centralized state)
 * - DeckStateService notifies listeners on change
 * - DeckMapService.renderFromState() converts JSON → deck.gl layers
 */

import { Injectable } from '@angular/core';
import { TOOL_NAMES } from '@carto/maps-ai-tools';
import { DeckStateService, Basemap, LayerSpec } from '../state/deck-state.service';
import {
  LOCATION_PIN_LAYER_ID,
  createLocationPinLayerSpec
} from '../config/location-pin.config';
import { mergeLayerSpecs, validateLayerColumns } from '../utils/layer-merge.utils';

// ==================== TYPES ====================

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

export type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

// ==================== PARAMETER TYPES ====================

interface SetMapViewParams {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
}

interface SetBasemapParams {
  basemap: Basemap;
}

interface SetDeckStateParams {
  layers?: LayerSpec[];
  widgets?: Record<string, unknown>[];
  effects?: Record<string, unknown>[];
  layerOrder?: string[];
  removeLayerIds?: string[];
}

@Injectable({
  providedIn: 'root'
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
        message: `Unknown tool: ${toolName}`
      };
    }

    try {
      return await Promise.resolve(executor(params));
    } catch (error) {
      return {
        success: false,
        message: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Object.keys(this.executors);
  }

  /**
   * Check if a tool exists
   */
  hasExecutor(toolName: string): boolean {
    return toolName in this.executors;
  }

  private createExecutors(): Record<string, ToolExecutor> {
    return {
      // ==================== SET MAP VIEW ====================
      [TOOL_NAMES.SET_MAP_VIEW]: (params: unknown): ToolResult => {
        const { latitude, longitude, zoom, pitch, bearing } = params as SetMapViewParams;

        try {
          // Update view state
          this.deckState.setViewState({
            latitude,
            longitude,
            zoom,
            pitch: pitch ?? 0,
            bearing: bearing ?? 0,
          });

          // Add new pin to collection (accumulates all pins)
          this.deckState.addPinLocation({ longitude, latitude });

          // Get all pin locations and create layer with all of them
          const allPinLocations = this.deckState.getPinLocations();
          const pinLayerSpec = createLocationPinLayerSpec(allPinLocations);
          const currentLayers = this.deckState.getLayers();

          // Check if pin layer already exists
          const existingPinIndex = currentLayers.findIndex(
            layer => layer['id'] === LOCATION_PIN_LAYER_ID
          );

          let updatedLayers: LayerSpec[];
          if (existingPinIndex >= 0) {
            // Update existing pin layer with all pins
            updatedLayers = [...currentLayers];
            updatedLayers[existingPinIndex] = pinLayerSpec;
          } else {
            // Add new pin layer
            updatedLayers = [...currentLayers, pinLayerSpec];
          }

          this.deckState.setLayers(updatedLayers);

          return {
            success: true,
            message: `Map view updated to ${latitude.toFixed(4)}, ${longitude.toFixed(4)} (zoom ${zoom})`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set map view: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },

      // ==================== SET BASEMAP ====================
      [TOOL_NAMES.SET_BASEMAP]: (params: unknown): ToolResult => {
        const { basemap } = params as SetBasemapParams;

        try {
          this.deckState.setBasemap(basemap);

          return {
            success: true,
            message: `Basemap changed to ${basemap}`,
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set basemap: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },

      // ==================== SET DECK STATE ====================
      [TOOL_NAMES.SET_DECK_STATE]: (params: unknown): ToolResult => {
        const paramsObj = params as SetDeckStateParams & { layers?: LayerSpec[]; widgets?: Record<string, unknown>[]; effects?: Record<string, unknown>[] };
        const { layers, widgets, effects, removeLayerIds } = paramsObj;

        try {
          const currentConfig = this.deckState.getDeckConfig();

          // Step 1: Process layer removals FIRST
          let workingLayers = currentConfig.layers ?? [];
          if (removeLayerIds && removeLayerIds.length > 0) {
            const idsToRemove = new Set(removeLayerIds);
            workingLayers = workingLayers.filter(
              layer => !idsToRemove.has(layer['id'] as string)
            );
          }

          // Step 2: Determine final layers based on explicit presence
          let finalLayers: LayerSpec[];
          const hasLayersProperty = 'layers' in paramsObj;
          const layersValue = paramsObj.layers;
          const isLayersArray = Array.isArray(layersValue);
          const isLayersEmpty = isLayersArray && layersValue.length === 0;

          if (hasLayersProperty) {
            // layers was explicitly provided
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
            const layerMap = new Map(finalLayers.map(l => [l['id'] as string, l]));
            const orderedLayers: LayerSpec[] = [];

            // Add layers in specified order
            for (const id of layerOrder) {
              const layer = layerMap.get(id);
              if (layer) {
                orderedLayers.push(layer);
                layerMap.delete(id);
              }
            }

            // Append remaining layers not in layerOrder (preserves their relative order)
            for (const layer of layerMap.values()) {
              orderedLayers.push(layer);
            }

            finalLayers = orderedLayers;
          }

          // Determine final widgets based on explicit presence
          let finalWidgets: Record<string, unknown>[];
          if ('widgets' in paramsObj) {
            // widgets was explicitly provided
            if (paramsObj.widgets && paramsObj.widgets.length === 0) {
              // Empty array explicitly provided → replace (remove all)
              finalWidgets = [];
            } else if (paramsObj.widgets) {
              // Non-empty array provided → replace
              finalWidgets = paramsObj.widgets;
            } else {
              // widgets is explicitly undefined → keep existing
              finalWidgets = currentConfig.widgets ?? [];
            }
          } else {
            // widgets not provided → keep existing
            finalWidgets = currentConfig.widgets ?? [];
          }

          // Determine final effects based on explicit presence
          let finalEffects: Record<string, unknown>[];
          if ('effects' in paramsObj) {
            // effects was explicitly provided
            if (paramsObj.effects && paramsObj.effects.length === 0) {
              // Empty array explicitly provided → replace (remove all)
              finalEffects = [];
            } else if (paramsObj.effects) {
              // Non-empty array provided → replace
              finalEffects = paramsObj.effects;
            } else {
              // effects is explicitly undefined → keep existing
              finalEffects = currentConfig.effects ?? [];
            }
          } else {
            // effects not provided → keep existing
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

          this.deckState.setDeckConfig(config);

          // Track active layer
          if (finalLayers.length > 0) {
            const lastLayerId = finalLayers[finalLayers.length - 1]['id'] as string;
            if (lastLayerId) {
              this.deckState.setActiveLayerId(lastLayerId);
            }
          } else {
            // Clear active layer when all layers are removed
            this.deckState.setActiveLayerId(undefined);
          }

          return {
            success: true,
            message: `Config updated: ${config.layers.length} layer(s), ${config.widgets.length} widget(s), ${config.effects.length} effect(s)`,
            data: {
              layerCount: config.layers.length,
              widgetCount: config.widgets.length,
              effectCount: config.effects.length,
              layerIds: config.layers.map(l => l['id']),
            },
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
