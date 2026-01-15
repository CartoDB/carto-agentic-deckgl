import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { Deck, type Layer } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

const INITIAL_VIEW_STATE = {
  longitude: -95.7129,
  latitude: 37.0902,
  zoom: 4,
  pitch: 0,
  bearing: 0
};

export interface MapInstances {
  deck: Deck;
  map: maplibregl.Map;
}

export function useDeckMap(containerId: string): {
  deck: Ref<Deck | null>;
  map: Ref<maplibregl.Map | null>;
  layers: Ref<Layer[]>;
} {
  const deck = ref<Deck | null>(null);
  const map = ref<maplibregl.Map | null>(null);
  const layers = ref<Layer[]>([]);

  onMounted(async () => {
    // Create MapLibre map
    map.value = new maplibregl.Map({
      container: containerId,
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    map.value.on('load', async () => {
      console.log('✓ MapLibre loaded');
      await loadAirports();

      // Create deck.gl instance
      deck.value = new Deck({
        canvas: `${containerId}-canvas`,
        initialViewState: INITIAL_VIEW_STATE,
        controller: true,
        layers: layers.value,
        onViewStateChange: ({ viewState }) => {
          if (map.value) {
            map.value.jumpTo({
              center: [viewState.longitude, viewState.latitude],
              zoom: viewState.zoom,
              bearing: viewState.bearing,
              pitch: viewState.pitch
            });
          }
        }
      });
    });
  });

  const loadAirports = async (): Promise<void> => {
    try {
      const response = await fetch('/data/airports.geojson');
      const data = await response.json();

      const pointsLayer = new GeoJsonLayer({
        id: 'points-layer',
        data: data,
        pickable: true,
        filled: true,
        pointType: 'circle',
        getFillColor: [200, 0, 80, 180],
        getPointRadius: 8,
        pointRadiusMinPixels: 4,
        pointRadiusMaxPixels: 100,
        visible: true,
        opacity: 1
      });

      layers.value = [pointsLayer];
      if (deck.value) {
        deck.value.setProps({ layers: layers.value });
      }
      console.log('✓ Points layer loaded with', data.features.length, 'points');
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  };

  onUnmounted(() => {
    if (deck.value) {
      deck.value.finalize();
    }
    if (map.value) {
      map.value.remove();
    }
  });

  return { deck, map, layers };
}
