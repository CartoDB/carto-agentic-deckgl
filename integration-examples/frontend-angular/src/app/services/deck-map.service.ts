import { Injectable } from '@angular/core';
import { Deck } from '@deck.gl/core';
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

@Injectable({
  providedIn: 'root'
})
export class DeckMapService {
  private deck: Deck | null = null;
  private map: maplibregl.Map | null = null;
  private layers: any[] = [];

  constructor() {}

  async initialize(containerId: string, canvasId: string): Promise<{ deck: Deck; map: maplibregl.Map }> {
    // Create MapLibre map
    this.map = new maplibregl.Map({
      container: containerId,
      style: BASEMAP.VOYAGER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom
    });

    await new Promise((resolve) => {
      this.map!.on('load', async () => {
        console.log('✓ MapLibre loaded');
        await this.loadAirports();
        resolve(null);
      });
    });

    // Create deck.gl instance
    this.deck = new Deck({
      canvas: canvasId,
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      layers: this.layers,
      onViewStateChange: ({ viewState }) => {
        if (this.map) {
          this.map.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing,
            pitch: viewState.pitch
          });
        }
      }
    });

    return { deck: this.deck, map: this.map };
  }

  private async loadAirports(): Promise<void> {
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

      this.layers = [pointsLayer];
      if (this.deck) {
        this.deck.setProps({ layers: this.layers });
      }
      console.log('✓ Points layer loaded with', data.features.length, 'points');
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
    }
  }

  getDeck(): Deck | null {
    return this.deck;
  }

  getMap(): maplibregl.Map | null {
    return this.map;
  }

  destroy(): void {
    if (this.deck) {
      this.deck.finalize();
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
