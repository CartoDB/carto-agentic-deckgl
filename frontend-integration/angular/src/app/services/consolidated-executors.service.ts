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
import { DeckStateService, Basemap, LayerSpec } from '../state/deck-state.service';
import { environment } from '../../environments/environment';

// ==================== TYPES ====================

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

export type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

// ==================== PARAMETER TYPES ====================

interface GeocodeParams {
  query: string;
}

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
}

interface TakeMapScreenshotParams {
  reason: string;
}

interface CartoQueryParams {
  sql: string;
  connectionName?: string;
  format?: 'geojson' | 'json';
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Merge layer specs: update existing by ID, add new ones, preserve others
 */
function mergeLayerSpecs(
  existing: LayerSpec[],
  incoming: LayerSpec[]
): LayerSpec[] {
  const layerMap = new Map<string, LayerSpec>();

  for (const layer of existing) {
    const id = layer['id'] as string;
    if (id) {
      layerMap.set(id, layer);
    }
  }

  for (const layer of incoming) {
    const id = layer['id'] as string;
    if (id) {
      const existingLayer = layerMap.get(id);
      if (existingLayer) {
        layerMap.set(id, deepMerge(existingLayer, layer));
      } else {
        layerMap.set(id, layer);
      }
    }
  }

  return Array.from(layerMap.values());
}

/**
 * Validate that styling columns are included in data.columns
 */
function validateLayerColumns(layer: LayerSpec): void {
  const fillColor = layer['getFillColor'] as string | undefined;
  const lineColor = layer['getLineColor'] as string | undefined;
  const pointRadius = layer['getPointRadius'] as string | undefined;
  const lineWidth = layer['getLineWidth'] as string | undefined;

  const accessorPattern = /properties\.(\w+)/g;
  const requiredColumns = new Set<string>();

  for (const accessor of [fillColor, lineColor, pointRadius, lineWidth]) {
    if (typeof accessor === 'string' && accessor.includes('@@=')) {
      let match;
      accessorPattern.lastIndex = 0;
      while ((match = accessorPattern.exec(accessor)) !== null) {
        requiredColumns.add(match[1]);
      }
    }
  }

  if (requiredColumns.size > 0) {
    const data = layer['data'] as Record<string, unknown> | undefined;
    const columns = (data?.['columns'] as string[]) || [];
    const missing = [...requiredColumns].filter(
      col => !columns.some(c => c.toLowerCase() === col.toLowerCase())
    );

    if (missing.length > 0) {
      console.warn(
        `[Executor] Layer "${layer['id']}" uses columns [${missing.join(', ')}] in accessors but they are not in data.columns.`
      );
    }
  }
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
      // ==================== GEOCODE ====================
      'geocode': async (params: unknown): Promise<ToolResult> => {
        const { query } = params as GeocodeParams;

        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
          const response = await fetch(url, {
            headers: { 'User-Agent': 'CARTO-Demo/1.0' },
          });

          if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.statusText}`);
          }

          const data = await response.json();

          if (!data.length) {
            return {
              success: false,
              message: `Location not found: ${query}`,
            };
          }

          return {
            success: true,
            message: `Found: ${data[0].display_name}`,
            data: {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon),
              display_name: data[0].display_name,
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Geocoding error: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },

      // ==================== SET MAP VIEW ====================
      'set-map-view': (params: unknown): ToolResult => {
        const { latitude, longitude, zoom, pitch, bearing } = params as SetMapViewParams;

        try {
          this.deckState.setViewState({
            latitude,
            longitude,
            zoom,
            pitch: pitch ?? 0,
            bearing: bearing ?? 0,
          });

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
      'set-basemap': (params: unknown): ToolResult => {
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
      'set-deck-state': (params: unknown): ToolResult => {
        const { layers, widgets, effects } = params as SetDeckStateParams;

        try {
          const currentConfig = this.deckState.getDeckConfig();

          // Merge layers
          const mergedLayers = mergeLayerSpecs(
            currentConfig.layers ?? [],
            layers ?? []
          );

          const config = {
            layers: mergedLayers,
            widgets: widgets ?? currentConfig.widgets ?? [],
            effects: effects ?? currentConfig.effects ?? [],
          };

          // Validate columns
          for (const layer of config.layers) {
            validateLayerColumns(layer);
          }

          this.deckState.setDeckConfig(config);

          // Track active layer
          if (layers && layers.length > 0) {
            const lastLayerId = layers[layers.length - 1]['id'] as string;
            if (lastLayerId) {
              this.deckState.setActiveLayerId(lastLayerId);
            }
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

      // ==================== TAKE MAP SCREENSHOT ====================
      'take-map-screenshot': async (params: unknown): Promise<ToolResult> => {
        const { reason } = params as TakeMapScreenshotParams;

        try {
          const canvas = document.getElementById('deck-canvas') as HTMLCanvasElement;
          if (!canvas) {
            return {
              success: false,
              message: 'Canvas not found',
            };
          }

          const dataUrl = canvas.toDataURL('image/png');

          return {
            success: true,
            message: 'Screenshot captured',
            data: {
              reason,
              dataUrl,
              timestamp: Date.now(),
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },

      // ==================== CARTO QUERY ====================
      'carto-query': async (params: unknown): Promise<ToolResult> => {
        const { sql, connectionName, format = 'geojson' } = params as CartoQueryParams;

        try {
          if (!environment.accessToken) {
            return {
              success: false,
              message: 'CARTO access token not configured',
            };
          }

          const connection = connectionName || environment.connectionName || 'carto_dw';
          const url = `${environment.apiBaseUrl}/v3/sql/${connection}/query`;

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${environment.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: sql }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Query failed: ${response.statusText} - ${errorText}`);
          }

          const data = await response.json();
          const rows = data.rows || data;

          if (format === 'geojson') {
            const features = rows.map((row: Record<string, unknown>) => {
              const { geom, geometry, the_geom, ...properties } = row;
              const geomValue = geom || geometry || the_geom;
              let parsedGeom = null;

              if (geomValue) {
                parsedGeom = typeof geomValue === 'string' ? JSON.parse(geomValue) : geomValue;
              }

              return {
                type: 'Feature',
                geometry: parsedGeom,
                properties,
              };
            });

            const geojson = {
              type: 'FeatureCollection',
              features,
            };

            return {
              success: true,
              message: `Query returned ${rows.length} features`,
              data: {
                geojson,
                rowCount: rows.length,
              },
            };
          }

          return {
            success: true,
            message: `Query returned ${rows.length} rows`,
            data: {
              rows,
              rowCount: rows.length,
            },
          };
        } catch (error) {
          return {
            success: false,
            message: `Query failed: ${error instanceof Error ? error.message : String(error)}`,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    };
  }
}
