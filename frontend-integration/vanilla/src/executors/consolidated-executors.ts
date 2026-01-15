/**
 * Consolidated Tool Executors
 *
 * Simplified executor pattern using JSONConverter as the central engine.
 * Replaces the 1800+ line tool-executors.ts with ~200 lines.
 *
 * Architecture:
 * - Executors update DeckState (centralized state)
 * - DeckState notifies listeners on change
 * - renderFromState() converts JSON → deck.gl layers
 *
 * This is the "Teach the agent Deck.gl" approach from simpleAgentMap.
 */

import type { DeckState, Basemap } from '../state/DeckState';
import type { ZoomControls, LayerToggle, ToolStatus, ChatContainer } from '../ui';
import { getCartoCredentials } from '../map/deckgl-map';

// ==================== TYPES ====================

export interface ToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

export type ToolExecutor = (params: unknown) => ToolResult | Promise<ToolResult>;

export interface ConsolidatedExecutorContext {
  deckState: DeckState;
  zoomControls: ZoomControls;
  layerToggle: LayerToggle;
  toolStatus: ToolStatus;
  chatContainer: ChatContainer;
  sendToolResult?: (result: {
    toolName: string;
    callId: string;
    success: boolean;
    message: string;
    error?: string;
  }) => void;
}

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
  layers?: Record<string, unknown>[];
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
 * Validate that styling columns are included in data.columns
 * Logs a warning if columns used in @@= accessors are missing from data.columns
 */
function validateLayerColumns(layer: Record<string, unknown>): void {
  const fillColor = layer.getFillColor as string | undefined;
  const lineColor = layer.getLineColor as string | undefined;
  const pointRadius = layer.getPointRadius as string | undefined;
  const lineWidth = layer.getLineWidth as string | undefined;

  // Check for @@= expressions that reference properties
  const accessorPattern = /properties\.(\w+)/g;
  const requiredColumns = new Set<string>();

  for (const accessor of [fillColor, lineColor, pointRadius, lineWidth]) {
    if (typeof accessor === 'string' && accessor.includes('@@=')) {
      let match;
      // Reset regex lastIndex for each string
      accessorPattern.lastIndex = 0;
      while ((match = accessorPattern.exec(accessor)) !== null) {
        requiredColumns.add(match[1]);
      }
    }
  }

  if (requiredColumns.size > 0) {
    const data = layer.data as Record<string, unknown> | undefined;
    const columns = (data?.columns as string[]) || [];
    const missing = [...requiredColumns].filter(
      (col) => !columns.some((c) => c.toLowerCase() === col.toLowerCase())
    );

    if (missing.length > 0) {
      console.warn(
        `[Executor] Layer "${layer.id}" uses columns [${missing.join(', ')}] in accessors but they are not in data.columns. ` +
        `Add them to data.columns for styling to work. Current columns: [${columns.join(', ')}]`
      );
    }
  }
}

// ==================== EXECUTOR FACTORY ====================

/**
 * Create consolidated tool executors
 *
 * Returns a map of tool name → executor function.
 * Each executor updates DeckState rather than directly manipulating deck.gl.
 */
export function createConsolidatedExecutors(
  context: ConsolidatedExecutorContext
): Record<string, ToolExecutor> {
  const { deckState, zoomControls, layerToggle } = context;

  return {
    // ==================== GEOCODE ====================
    /**
     * Geocode a place name to coordinates
     * Uses Nominatim (OpenStreetMap) geocoding service
     */
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
    /**
     * Set the map view to specific coordinates
     */
    'set-map-view': (params: unknown): ToolResult => {
      const { latitude, longitude, zoom, pitch, bearing } = params as SetMapViewParams;

      try {
        deckState.setViewState({
          latitude,
          longitude,
          zoom,
          pitch: pitch ?? 0,
          bearing: bearing ?? 0,
        });

        zoomControls.setZoomLevel(zoom);

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
    /**
     * Change the map basemap style
     */
    'set-basemap': (params: unknown): ToolResult => {
      const { basemap } = params as SetBasemapParams;

      try {
        deckState.setBasemap(basemap);

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
    /**
     * Set the complete Deck.gl visualization state
     *
     * This is the most powerful tool - accepts full Deck.gl JSON specs.
     * The agent generates JSON with @@type, @@function prefixes.
     * JSONConverter handles conversion to actual deck.gl layers.
     */
    'set-deck-state': (params: unknown): ToolResult => {
      const { layers, widgets, effects } = params as SetDeckStateParams;

      try {
        const config = {
          layers: layers ?? [],
          widgets: widgets ?? [],
          effects: effects ?? [],
        };

        // Validate that styling columns are included in data.columns
        for (const layer of config.layers) {
          validateLayerColumns(layer as Record<string, unknown>);
        }

        deckState.setDeckConfig(config);

        // Update layer toggle UI
        const layerInfo = config.layers.map((layer) => ({
          id: (layer.id as string) || 'unknown',
          name: (layer.id as string) || 'Unknown Layer',
          visible: layer.visible !== false,
          color: '#036fe2',
        }));
        layerToggle.setLayers(layerInfo);

        return {
          success: true,
          message: `Config updated: ${config.layers.length} layer(s), ${config.widgets.length} widget(s), ${config.effects.length} effect(s)`,
          data: {
            layerCount: config.layers.length,
            widgetCount: config.widgets.length,
            effectCount: config.effects.length,
            layerIds: config.layers.map((l) => l.id),
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
    /**
     * Capture a screenshot of the current map view
     */
    'take-map-screenshot': async (params: unknown): Promise<ToolResult> => {
      const { reason } = params as TakeMapScreenshotParams;

      try {
        // Get the deck canvas
        const canvas = document.getElementById('deck-canvas') as HTMLCanvasElement;
        if (!canvas) {
          return {
            success: false,
            message: 'Canvas not found',
          };
        }

        // Convert canvas to data URL
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
    /**
     * Execute a SQL query against CARTO Data Warehouse
     */
    'carto-query': async (params: unknown): Promise<ToolResult> => {
      const { sql, connectionName, format = 'geojson' } = params as CartoQueryParams;

      try {
        const credentials = getCartoCredentials();

        if (!credentials.accessToken) {
          return {
            success: false,
            message: 'CARTO access token not configured',
          };
        }

        const connection = connectionName || credentials.connectionName || 'carto_dw';
        const url = `${credentials.apiBaseUrl}/v3/sql/${connection}/query`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
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
          // Convert to GeoJSON
          const features = rows.map((row: Record<string, unknown>) => {
            const { geom, geometry, the_geom, ...properties } = row;
            const geomValue = geom || geometry || the_geom;
            let parsedGeom = null;

            if (geomValue) {
              parsedGeom =
                typeof geomValue === 'string' ? JSON.parse(geomValue) : geomValue;
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

        // Return raw JSON
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

// ==================== TOOL CALL HANDLER ====================

/**
 * Handle a tool call message from the server
 *
 * Parses the message, finds the executor, runs it, and returns the result.
 */
export async function handleToolCall(
  message: { tool?: string; toolName?: string; parameters?: unknown; data?: unknown; callId?: string },
  executors: Record<string, ToolExecutor>,
  context: ConsolidatedExecutorContext
): Promise<ToolResult> {
  // Extract tool name (handle different field names)
  const toolName = message.tool || message.toolName;
  const parameters = message.parameters || message.data || {};
  const callId = message.callId || '';

  if (!toolName) {
    const result: ToolResult = {
      success: false,
      message: 'No tool name provided',
    };
    context.sendToolResult?.({
      toolName: 'unknown',
      callId,
      success: false,
      message: result.message,
    });
    return result;
  }

  // Find the executor
  const executor = executors[toolName];
  if (!executor) {
    const result: ToolResult = {
      success: false,
      message: `Unknown tool: ${toolName}`,
    };
    context.sendToolResult?.({
      toolName,
      callId,
      success: false,
      message: result.message,
    });
    return result;
  }

  try {
    // Execute the tool
    context.toolStatus.showToolExecution(toolName);
    const result = await Promise.resolve(executor(parameters));

    // Update UI
    if (result.success) {
      context.toolStatus.showSuccess(result.message);
    } else {
      context.toolStatus.setError(result.message);
    }

    // Add to chat
    context.chatContainer.addToolCall({
      toolName,
      status: result.success ? 'success' : 'error',
      message: result.message,
    });

    // Send result back to server
    context.sendToolResult?.({
      toolName,
      callId,
      success: result.success,
      message: result.message,
      error: result.error?.message,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: ToolResult = {
      success: false,
      message: `Execution error: ${errorMessage}`,
      error: error instanceof Error ? error : new Error(errorMessage),
    };

    context.toolStatus.setError(result.message);
    context.chatContainer.addToolCall({
      toolName,
      status: 'error',
      message: result.message,
    });
    context.sendToolResult?.({
      toolName,
      callId,
      success: false,
      message: result.message,
      error: errorMessage,
    });

    return result;
  }
}

/**
 * Get consolidated tool names
 */
export function getConsolidatedToolNames(): string[] {
  return [
    'geocode',
    'set-map-view',
    'set-basemap',
    'set-deck-state',
    'take-map-screenshot',
    'carto-query',
  ];
}
