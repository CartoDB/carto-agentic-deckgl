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

// ==================== MARKER CONSTANTS ====================

const MARKER_LAYER_ID = '__location-marker__';
const LOCATION_MARKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/></filter></defs><g filter="url(#shadow)"><path d="M24 4C16.268 4 10 10.268 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.732-6.268-14-14-14z" fill="#333333"/><path d="M24 4C16.268 4 10 10.268 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.732-6.268-14-14-14z" fill="none" stroke="#666666" stroke-width="1.5"/><circle cx="24" cy="18" r="6" fill="#FFFFFF"/></g></svg>';
const LOCATION_MARKER_SVG_DATA_URL = `data:image/svg+xml;base64,${btoa(LOCATION_MARKER_SVG)}`;

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

            // Ensure system layers (__ prefix) always render on top
            const userFinalLayers = finalLayers.filter(l => !((l['id'] as string) || '').startsWith('__'));
            const systemFinalLayers = finalLayers.filter(l => ((l['id'] as string) || '').startsWith('__'));
            finalLayers = [...userFinalLayers, ...systemFinalLayers];

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

            // Track active layer (skip system layers with __ prefix)
            if (finalLayers.length > 0) {
              const userLayers = finalLayers.filter(l => {
                const id = (l['id'] as string) || '';
                return !id.startsWith('__');
              });
              const lastUserLayerId = userLayers.length > 0
                ? (userLayers[userLayers.length - 1]['id'] as string) : undefined;
              if (lastUserLayerId) {
                this.deckState.setActiveLayerId(lastUserLayerId);
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

      // ==================== SET MARKER ====================
      [TOOL_NAMES.SET_MARKER]: (params: unknown): ToolResult => {
        const { latitude, longitude } = params as { latitude: number; longitude: number };
        try {
          const currentSpec = this.deckState.getDeckSpec();

          // Get existing marker layer and its data points (if any)
          const existingMarkerLayer = currentSpec.layers.find(
            (layer) => layer['id'] === MARKER_LAYER_ID
          );
          const existingData = (existingMarkerLayer?.['data'] as Array<{ coordinates: number[] }>) ?? [];

          // Skip if a marker already exists at approximately these coordinates (~1m precision)
          const COORDINATE_TOLERANCE = 0.00001;
          const alreadyExists = existingData.some(
            (d) =>
              Math.abs(d.coordinates[0] - longitude) < COORDINATE_TOLERANCE &&
              Math.abs(d.coordinates[1] - latitude) < COORDINATE_TOLERANCE
          );
          const updatedData = alreadyExists
            ? existingData
            : [...existingData, { coordinates: [longitude, latitude] }];

          const layersWithoutMarker = currentSpec.layers.filter(
            (layer) => layer['id'] !== MARKER_LAYER_ID
          );

          const markerLayer: LayerSpec = {
            '@@type': 'IconLayer',
            id: MARKER_LAYER_ID,
            data: updatedData,
            getPosition: '@@=coordinates',
            iconAtlas: LOCATION_MARKER_SVG_DATA_URL,
            iconMapping: {
              marker: { x: 0, y: 0, width: 48, height: 48, anchorY: 48 }
            },
            getIcon: '@@="marker"',
            getSize: 48,
            sizeScale: 1,
            pickable: false,
            visible: true,
          };

          const updatedLayers = [...layersWithoutMarker, markerLayer];
          this.deckState.setDeckLayers({
            layers: updatedLayers,
            widgets: currentSpec.widgets ?? [],
            effects: currentSpec.effects ?? [],
          });

          return { success: true, message: `Marker placed at [${latitude}, ${longitude}]. Total markers: ${updatedData.length}` };
        } catch (error) {
          return {
            success: false,
            message: `Failed to set marker: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    };
  }
}
