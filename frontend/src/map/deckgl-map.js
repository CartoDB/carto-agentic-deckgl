// frontend/src/map/deckgl-map.js
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';

export function createMap(container, canvasId) {
  // Initial view state (centered on US)
  const initialViewState = {
    longitude: -95.7129,
    latitude: 37.0902,
    zoom: 4,
    pitch: 0,
    bearing: 0
  };

  // Create MapLibre map with CARTO basemap
  const map = new maplibregl.Map({
    container: container,
    style: BASEMAP.VOYAGER,
    interactive: false,
    center: [initialViewState.longitude, initialViewState.latitude],
    zoom: initialViewState.zoom
  });

  // Get the canvas element
  const canvas = document.getElementById(canvasId);

  // Create deck.gl instance
  const deck = new Deck({
    canvas: canvas,
    width: '100%',
    height: '100%',
    initialViewState: initialViewState,
    controller: true,
    onViewStateChange: ({ viewState }) => {
      // Sync MapLibre with deck.gl
      map.jumpTo({
        center: [viewState.longitude, viewState.latitude],
        zoom: viewState.zoom,
        bearing: viewState.bearing,
        pitch: viewState.pitch
      });
      return viewState;
    },
    layers: [],
    // Force rendering on property changes
    _animate: true
  });

  // Wait for MapLibre to load before considering initialization complete
  map.on('load', () => {
    console.log('✓ MapLibre loaded');
    // Trigger an initial render
    deck.redraw(true);
  });

  return { deck, map, initialViewState };
}

export function createPointsLayer(data) {
  return new GeoJsonLayer({
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
    opacity: 1,
    onHover: info => {
      if (info.object) {
        console.log('Hover:', info.object.properties);
      }
    }
  });
}
