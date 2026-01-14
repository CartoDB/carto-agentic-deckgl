import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Deck, FlyToInterpolator, Layer } from '@deck.gl/core';
import { BASEMAP, VectorTileLayer } from '@deck.gl/carto';
import { vectorTableSource } from '@carto/api-client';
import type { MapViewState } from '@deck.gl/core';
import type { DeckStateData, Basemap } from '../state/DeckState';
import { getJsonConverter } from '../config/deckJsonConfig';

export interface MapConfig {
  apiBaseUrl: string;
  accessToken: string;
  connectionName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MapInstance {
  deck: Deck<any>;
  map: maplibregl.Map;
  initialViewState: MapViewState;
}

export const INITIAL_VIEW_STATE: MapViewState = {
  latitude: 41.8097343,
  longitude: -110.5556199,
  zoom: 3,
  bearing: 0,
  pitch: 0
};

/**
 * Creates a synchronized deck.gl + MapLibre map instance
 */
export function createMap(
  mapContainer: string,
  canvasId: string,
  onViewStateChange?: (viewState: MapViewState) => void
): MapInstance {
  // Create MapLibre map first with initial position
  const map = new maplibregl.Map({
    container: mapContainer,
    style: BASEMAP.POSITRON,
    interactive: false,
    center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
    zoom: INITIAL_VIEW_STATE.zoom
  });

  // Create deck.gl instance with animation support
  const deck = new Deck({
    canvas: canvasId,
    width: '100%',
    height: '100%',
    initialViewState: INITIAL_VIEW_STATE,
    controller: true,
    onViewStateChange: ({ viewState }) => {
      // Sync MapLibre with deck.gl on every view state change
      const vs = viewState as MapViewState;
      map.jumpTo({
        center: [vs.longitude, vs.latitude],
        zoom: vs.zoom,
        bearing: vs.bearing ?? 0,
        pitch: vs.pitch ?? 0
      });
      onViewStateChange?.(vs);
      return viewState;
    },
    layers: [],
    // Enable animation support for transitions
    _animate: true
  } as ConstructorParameters<typeof Deck>[0]);

  // Trigger initial render when MapLibre loads
  map.on('load', () => {
    console.log('[Map] MapLibre loaded');
    deck.redraw('all');
  });

  return { deck, map, initialViewState: INITIAL_VIEW_STATE };
}

/**
 * Creates and initializes the CARTO POI data source
 */
export async function initDataSource(config: MapConfig) {
  return await vectorTableSource({
    apiBaseUrl: config.apiBaseUrl,
    accessToken: config.accessToken,
    connectionName: config.connectionName,
    tableName: 'carto-demo-data.demo_tables.osm_pois_usa'
  });
}

/**
 * Creates the POI layer using CARTO VectorTileLayer
 */
export function createPoiLayer(dataSource: Awaited<ReturnType<typeof vectorTableSource>>) {
  return new VectorTileLayer({
    id: 'pois',
    pickable: true,
    data: dataSource,
    opacity: 1,
    getFillColor: [3, 111, 226],
    getLineColor: [255, 255, 255],
    getPointRadius: 50,
    getLineWidth: 10,
    pointRadiusMinPixels: 1,
    lineWidthMinPixels: 0.3,
    visible: true
  });
}

/**
 * Schedule multiple redraws to ensure deck.gl updates are visible
 * This is a critical workaround for deck.gl rendering issues
 */
export function scheduleRedraws(deck: Deck): void {
  // Use 'all' as reason to force full redraw
  requestAnimationFrame(() => deck.redraw('all'));
  setTimeout(() => deck.redraw('all'), 50);
  setTimeout(() => deck.redraw('all'), 1100);
}

// ==================== CARTO CREDENTIALS ====================

const CARTO_CREDENTIALS = {
  accessToken: import.meta.env.VITE_API_ACCESS_TOKEN || '',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://gcp-us-east1.api.carto.com',
  connectionName: import.meta.env.VITE_CONNECTION_NAME || 'carto_dw',
};

/**
 * Basemap URL mapping
 */
const BASEMAP_URLS: Record<Basemap, string> = {
  'dark-matter': BASEMAP.DARK_MATTER,
  'positron': BASEMAP.POSITRON,
  'voyager': BASEMAP.VOYAGER,
};

/**
 * Inject CARTO credentials into layer data sources
 * This auto-fills accessToken, apiBaseUrl, and connectionName if not provided
 */
function injectCartoCredentials(layerJson: Record<string, unknown>): Record<string, unknown> {
  // Deep clone to avoid mutating original
  const layer = JSON.parse(JSON.stringify(layerJson));

  // If data uses a CARTO source function, inject credentials
  if (layer.data && typeof layer.data === 'object') {
    const data = layer.data as Record<string, unknown>;
    const funcName = data['@@function'] as string | undefined;

    if (funcName && funcName.toLowerCase().includes('source')) {
      if (!data.accessToken) {
        data.accessToken = CARTO_CREDENTIALS.accessToken;
      }
      if (!data.apiBaseUrl) {
        data.apiBaseUrl = CARTO_CREDENTIALS.apiBaseUrl;
      }
      if (!data.connectionName && !data.connection) {
        data.connectionName = CARTO_CREDENTIALS.connectionName;
      }
    }
  }

  return layer;
}

/**
 * Central rendering function - converts DeckStateData to rendered deck.gl layers
 *
 * This is the heart of the JSONConverter-based architecture:
 * 1. Takes DeckStateData with JSON layer specs
 * 2. Converts each layer using JSONConverter
 * 3. Sets the resulting layers on the deck instance
 *
 * @param deck - The deck.gl instance
 * @param map - The MapLibre instance (for basemap and view sync)
 * @param state - The complete deck state data
 * @param changedKeys - Which keys changed (for optimized updates)
 */
export function renderFromState(
  deck: Deck,
  map: maplibregl.Map,
  state: DeckStateData,
  changedKeys: string[]
): void {
  const jsonConverter = getJsonConverter();

  console.log('[renderFromState] Rendering state update:', changedKeys);

  // Update view state
  if (changedKeys.includes('viewState')) {
    const { longitude, latitude, zoom, pitch, bearing } = state.viewState;

    deck.setProps({
      initialViewState: {
        longitude,
        latitude,
        zoom,
        pitch: pitch ?? 0,
        bearing: bearing ?? 0,
        transitionDuration: 1000,
        transitionInterpolator: new FlyToInterpolator(),
      },
    });

    // Sync MapLibre with deck.gl
    map.jumpTo({
      center: [longitude, latitude],
      zoom: zoom,
      bearing: bearing ?? 0,
      pitch: pitch ?? 0,
    });

    scheduleRedraws(deck);
    console.log('[renderFromState] View state updated:', { longitude, latitude, zoom, pitch, bearing });
  }

  // Update basemap
  if (changedKeys.includes('basemap')) {
    const basemapUrl = BASEMAP_URLS[state.basemap];
    if (basemapUrl) {
      map.setStyle(basemapUrl);
      console.log('[renderFromState] Basemap updated:', state.basemap);
    }
  }

  // Update layers via JSONConverter
  if (changedKeys.includes('deckConfig')) {
    const layerSpecs = state.deckConfig.layers ?? [];
    console.log('[renderFromState] Converting', layerSpecs.length, 'layer specs');

    const convertedLayers: unknown[] = [];

    for (let index = 0; index < layerSpecs.length; index++) {
      const layerJson = layerSpecs[index];
      const layerId = (layerJson.id as string) || `layer-${index}`;

      try {
        // Ensure each layer has an ID
        const layerWithId = { ...layerJson, id: layerId };

        // Inject CARTO credentials into data sources
        const layerWithCredentials = injectCartoCredentials(layerWithId);

        // Convert JSON to deck.gl layer instance
        const converted = jsonConverter.convert(layerWithCredentials);

        if (converted) {
          // Debug: log accessor type for color properties
          const props = converted.props || converted;
          console.log('[renderFromState] Converted layer:', layerId, {
            getFillColor: typeof props.getFillColor,
            getFillColorValue: typeof props.getFillColor === 'function' ? '[function]' : props.getFillColor,
            getLineColor: typeof props.getLineColor,
          });
          convertedLayers.push(converted);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[renderFromState] Failed to convert layer:', layerId, errorMessage, layerJson);
      }
    }

    // Set all converted layers on deck
    deck.setProps({ layers: convertedLayers as Layer[] });
    scheduleRedraws(deck);
    console.log('[renderFromState] Set', convertedLayers.length, 'layers on deck');
  }
}

/**
 * Get current CARTO credentials
 */
export function getCartoCredentials() {
  return { ...CARTO_CREDENTIALS };
}
