import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Deck } from '@deck.gl/core';
import { BASEMAP, VectorTileLayer } from '@deck.gl/carto';
import { vectorTableSource } from '@carto/api-client';
import type { MapViewState } from '@deck.gl/core';

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
