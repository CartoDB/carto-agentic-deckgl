import { useEffect, useRef } from 'react';
import { Deck } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: -95.7129,
  latitude: 37.0902,
  zoom: 4,
  pitch: 0,
  bearing: 0
};

export const MapView = ({ onMapInit }) => {
  const mapRef = useRef(null);
  const deckRef = useRef(null);

  useEffect(() => {
    // Create MapLibre map
    const map = new maplibregl.Map({
      container: 'map-container',
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    mapRef.current = map;

    // Get the canvas element
    const canvas = document.getElementById('deck-canvas');

    // Create deck.gl instance
    const deck = new Deck({
      canvas: canvas,
      width: '100%',
      height: '100%',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      onViewStateChange: ({ viewState }) => {
        // Sync MapLibre with deck.gl
        if (mapRef.current) {
          mapRef.current.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing,
            pitch: viewState.pitch
          });
        }
        return viewState;
      },
      layers: [],
      _animate: true
    });

    deckRef.current = deck;

    // Wait for MapLibre to load before loading airports
    map.on('load', async () => {
      console.log('✓ MapLibre loaded');
      deck.redraw(true);

      // Load airports data
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

        deck.setProps({ layers: [pointsLayer] });
        deck.redraw(true);
        console.log('✓ Points layer loaded with', data.features.length, 'points');

        // Notify parent component that deck and map are ready
        if (onMapInit) {
          onMapInit({ deck, map });
        }
      } catch (error) {
        console.error('Error loading GeoJSON:', error);
      }
    });

    return () => {
      if (deckRef.current) {
        deckRef.current.finalize();
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [onMapInit]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map-container" style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <canvas
        id="deck-canvas"
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'auto' }}
      />
    </div>
  );
};
