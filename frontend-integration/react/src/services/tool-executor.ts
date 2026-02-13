/**
 * Tool Executor Service
 *
 * Executes AI tool calls against DeckState.
 * Pure class with no React dependencies — used inside MapAIToolsContext.
 *
 * Ported from Angular's consolidated-executors.service.ts
 */

import { TOOL_NAMES } from '@carto/maps-ai-tools';
import type { LayerSpec } from '../utils/layer-merge';
import { mergeLayerSpecs, validateLayerColumns } from '../utils/layer-merge';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

export type Basemap = 'dark-matter' | 'positron' | 'voyager';

export interface DeckConfig {
  layers: LayerSpec[];
  widgets: Record<string, unknown>[];
  effects: Record<string, unknown>[];
}

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

export interface DeckStateActions {
  setViewState: (vs: {
    latitude: number;
    longitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
    transitionDuration?: number;
  }) => void;
  setBasemap: (basemap: Basemap) => void;
  setDeckConfig: (config: DeckConfig) => void;
  setActiveLayerId: (id: string | undefined) => void;
  getDeckConfig: () => DeckConfig;
}

export class ToolExecutor {
  private actions: DeckStateActions;

  constructor(actions: DeckStateActions) {
    this.actions = actions;
  }

  async execute(toolName: string, params: unknown): Promise<ToolResult> {
    if (toolName !== TOOL_NAMES.SET_DECK_STATE) {
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      };
    }

    try {
      return this.executeSetDeckState(params as SetDeckStateParams);
    } catch (error) {
      return {
        success: false,
        message: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private executeSetDeckState(paramsObj: SetDeckStateParams): ToolResult {
    const updatedParts: string[] = [];

    // Step 1: Update view state
    if (paramsObj.initialViewState) {
      const vs = paramsObj.initialViewState;
      this.actions.setViewState({
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
    if (paramsObj.mapStyle) {
      this.actions.setBasemap(paramsObj.mapStyle);
      updatedParts.push('basemap');
    }

    // Step 3: Process layers/widgets/effects
    const hasDeckConfigFields =
      'layers' in paramsObj ||
      'removeLayerIds' in paramsObj ||
      'layerOrder' in paramsObj ||
      'widgets' in paramsObj ||
      'effects' in paramsObj;

    if (hasDeckConfigFields) {
      const currentConfig = this.actions.getDeckConfig();

      // Process layer removals FIRST
      let workingLayers = currentConfig.layers ?? [];
      if (paramsObj.removeLayerIds && paramsObj.removeLayerIds.length > 0) {
        const idsToRemove = new Set(paramsObj.removeLayerIds);
        workingLayers = workingLayers.filter(
          (layer) => !idsToRemove.has(layer['id'] as string)
        );
      }

      // Determine final layers
      let finalLayers: LayerSpec[];
      const hasLayersProperty = 'layers' in paramsObj;
      const layersValue = paramsObj.layers;
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

      const config: DeckConfig = {
        layers: finalLayers,
        widgets: finalWidgets,
        effects: finalEffects,
      };

      for (const layer of config.layers) {
        validateLayerColumns(layer);
      }

      this.actions.setDeckConfig(config);

      // Track active layer
      if (finalLayers.length > 0) {
        const lastLayerId = finalLayers[finalLayers.length - 1]['id'] as string;
        if (lastLayerId) {
          this.actions.setActiveLayerId(lastLayerId);
        }
      } else {
        this.actions.setActiveLayerId(undefined);
      }

      updatedParts.push(
        `${config.layers.length} layer(s), ${config.widgets.length} widget(s), ${config.effects.length} effect(s)`
      );
    }

    return {
      success: true,
      message: `Updated: ${updatedParts.join(', ')}`,
    };
  }
}
