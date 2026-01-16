/**
 * Deck Map Service
 *
 * Manages deck.gl and MapLibre instances.
 * Uses renderFromState pattern with JSONConverter for layer rendering.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { Deck, FlyToInterpolator, Layer } from '@deck.gl/core';
import { log as lumaLog } from '@luma.gl/core';
import { BASEMAP } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';
import { DeckStateService, DeckStateData, Basemap, DEFAULT_VIEW_STATE } from '../state/deck-state.service';
import { getJsonConverter } from '../config/deck-json-config';
import { environment } from '../../environments/environment';

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * Basemap URL mapping
 */
const BASEMAP_URLS: Record<Basemap, string> = {
  'dark-matter': BASEMAP.DARK_MATTER,
  'positron': BASEMAP.POSITRON,
  'voyager': BASEMAP.VOYAGER,
};

@Injectable({
  providedIn: 'root',
})
export class DeckMapService implements OnDestroy {
  private deck: Deck<any> | null = null;
  private map: maplibregl.Map | null = null;
  private stateSubscription: Subscription | null = null;

  // Observable for view state changes (for UI updates like zoom level)
  private viewStateSubject = new Subject<ViewState>();
  public viewStateChange$ = this.viewStateSubject.asObservable();

  constructor(private deckState: DeckStateService) {}

  ngOnDestroy(): void {
    this.stateSubscription?.unsubscribe();
    this.destroy();
  }

  /**
   * Initialize deck.gl and MapLibre instances
   */
  async initialize(
    containerId: string,
    canvasId: string
  ): Promise<{ deck: Deck; map: maplibregl.Map }> {
    const initialViewState = this.deckState.getViewState();

    // Create MapLibre map
    this.map = new maplibregl.Map({
      container: containerId,
      style: BASEMAP_URLS[this.deckState.getBasemap()],
      interactive: false,
      center: [initialViewState.longitude, initialViewState.latitude],
      zoom: initialViewState.zoom,
    });

    await new Promise<void>((resolve) => {
      this.map!.on('load', () => {
        console.log('[DeckMapService] MapLibre loaded');
        resolve();
      });
    });

    // Suppress verbose luma.gl logging (ShaderFactory debug messages)
    lumaLog.level = 0;

    // Create deck.gl instance
    this.deck = new Deck({
      canvas: canvasId,
      initialViewState: {
        ...initialViewState,
        transitionDuration: 0,
      },
      controller: true,
      layers: [],
      onViewStateChange: ({ viewState: vs }) => {
        const viewState = vs as unknown as ViewState;
        if (this.map) {
          this.map.jumpTo({
            center: [viewState.longitude, viewState.latitude],
            zoom: viewState.zoom,
            bearing: viewState.bearing,
            pitch: viewState.pitch,
          });
        }
        // Emit view state changes for UI
        this.viewStateSubject.next({
          longitude: viewState.longitude,
          latitude: viewState.latitude,
          zoom: viewState.zoom,
          pitch: viewState.pitch,
          bearing: viewState.bearing,
        });
      },
      _animate: true,
    } as ConstructorParameters<typeof Deck>[0]);

    // Emit initial view state
    this.viewStateSubject.next({
      longitude: initialViewState.longitude ?? DEFAULT_VIEW_STATE.longitude!,
      latitude: initialViewState.latitude ?? DEFAULT_VIEW_STATE.latitude!,
      zoom: initialViewState.zoom ?? DEFAULT_VIEW_STATE.zoom!,
      pitch: initialViewState.pitch ?? 0,
      bearing: initialViewState.bearing ?? 0,
    });

    // Subscribe to state changes and render
    this.stateSubscription = this.deckState.state$.subscribe(({ state, changedKeys }) => {
      if (changedKeys.length > 0) {
        this.renderFromState(state, changedKeys);
      }
    });

    console.log('[DeckMapService] Initialized');
    return { deck: this.deck, map: this.map };
  }

  /**
   * Render from state - central rendering function
   * Converts DeckStateData to rendered deck.gl layers via JSONConverter
   */
  private renderFromState(state: DeckStateData, changedKeys: string[]): void {
    if (!this.deck || !this.map) {
      console.warn('[DeckMapService] Not initialized');
      return;
    }

    const jsonConverter = getJsonConverter();
    console.log('[DeckMapService] Rendering state update:', changedKeys);

    // Update view state
    if (changedKeys.includes('viewState')) {
      const { longitude, latitude, zoom, pitch, bearing } = state.viewState;

      this.deck.setProps({
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

      this.map.jumpTo({
        center: [longitude, latitude],
        zoom: zoom,
        bearing: bearing ?? 0,
        pitch: pitch ?? 0,
      });

      this.scheduleRedraws();
      console.log('[DeckMapService] View state updated:', { longitude, latitude, zoom, pitch, bearing });
    }

    // Update basemap
    if (changedKeys.includes('basemap')) {
      const basemapUrl = BASEMAP_URLS[state.basemap];
      if (basemapUrl) {
        this.map.setStyle(basemapUrl);
        console.log('[DeckMapService] Basemap updated:', state.basemap);
      }
    }

    // Update layers via JSONConverter
    if (changedKeys.includes('deckConfig')) {
      const layerSpecs = state.deckConfig.layers ?? [];
      console.log('[DeckMapService] Converting', layerSpecs.length, 'layer specs');

      const convertedLayers: unknown[] = [];

      for (let index = 0; index < layerSpecs.length; index++) {
        const layerJson = layerSpecs[index];
        const layerId = (layerJson['id'] as string) || `layer-${index}`;

        try {
          // Ensure each layer has an ID
          const layerWithId = { ...layerJson, id: layerId };

          // Inject CARTO credentials into data sources
          const layerWithCredentials = this.injectCartoCredentials(layerWithId);

          // Convert JSON to deck.gl layer instance
          const converted = jsonConverter.convert(layerWithCredentials);

          if (converted) {
            convertedLayers.push(converted);
            console.log('[DeckMapService] Converted layer:', layerId);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('[DeckMapService] Failed to convert layer:', layerId, errorMessage);
        }
      }

      // Set all converted layers on deck
      this.deck.setProps({ layers: convertedLayers as Layer[] });
      this.scheduleRedraws();
      console.log('[DeckMapService] Set', convertedLayers.length, 'layers on deck');
    }
  }

  /**
   * Inject CARTO credentials into layer data sources
   */
  private injectCartoCredentials(layerJson: Record<string, unknown>): Record<string, unknown> {
    const layer = JSON.parse(JSON.stringify(layerJson));

    if (layer['data'] && typeof layer['data'] === 'object') {
      const data = layer['data'] as Record<string, unknown>;
      const funcName = data['@@function'] as string | undefined;

      if (funcName && funcName.toLowerCase().includes('source')) {
        if (!data['accessToken']) {
          data['accessToken'] = environment.accessToken;
        }
        if (!data['apiBaseUrl']) {
          data['apiBaseUrl'] = environment.apiBaseUrl;
        }
        if (!data['connectionName'] && !data['connection']) {
          data['connectionName'] = environment.connectionName;
        }
      }
    }

    return layer;
  }

  /**
   * Schedule multiple redraws to ensure updates are visible
   */
  private scheduleRedraws(): void {
    if (!this.deck) return;

    const deck = this.deck;
    requestAnimationFrame(() => deck.redraw('all' as any));
    setTimeout(() => deck.redraw('all' as any), 50);
    setTimeout(() => deck.redraw('all' as any), 1100);
  }

  /**
   * Force a redraw
   */
  redraw(): void {
    this.scheduleRedraws();
  }

  getDeck(): Deck | null {
    return this.deck;
  }

  getMap(): maplibregl.Map | null {
    return this.map;
  }

  destroy(): void {
    this.stateSubscription?.unsubscribe();
    this.stateSubscription = null;

    if (this.deck) {
      this.deck.finalize();
      this.deck = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
