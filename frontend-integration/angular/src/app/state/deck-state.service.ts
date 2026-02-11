/**
 * DeckState Service
 *
 * Centralized state management for deck.gl map.
 * Angular service equivalent of Vanilla's DeckState class.
 *
 * All state changes go through this service, and subscribers are notified.
 * The deck-map service subscribes and calls renderFromState on changes.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import type { MapViewState } from '@deck.gl/core';

/**
 * Basemap style options
 */
export type Basemap = 'dark-matter' | 'positron' | 'voyager';

/**
 * Layer specification in JSON format for JSONConverter
 */
export type LayerSpec = Record<string, unknown>;

/**
 * Deck.gl configuration in JSON format
 */
export interface DeckConfig {
  layers: LayerSpec[];
  widgets: Record<string, unknown>[];
  effects: Record<string, unknown>[];
}

/**
 * Complete deck state data
 */
export interface DeckStateData {
  viewState: MapViewState;
  deckConfig: DeckConfig;
  basemap: Basemap;
  activeLayerId?: string;
}

/**
 * State change event with changed keys
 */
interface StateChange {
  state: DeckStateData;
  changedKeys: string[];
}

/**
 * Default initial view state
 */
export const DEFAULT_VIEW_STATE: MapViewState = {
  latitude: 41.8097343,
  longitude: -110.5556199,
  zoom: 3,
  bearing: 0,
  pitch: 0
};

/**
 * Default deck configuration
 */
const DEFAULT_DECK_CONFIG: DeckConfig = {
  layers: [],
  widgets: [],
  effects: []
};

@Injectable({
  providedIn: 'root'
})
export class DeckStateService {
  // Private state subjects
  private viewStateSubject = new BehaviorSubject<MapViewState>({ ...DEFAULT_VIEW_STATE });
  private deckConfigSubject = new BehaviorSubject<DeckConfig>({ ...DEFAULT_DECK_CONFIG });
  private basemapSubject = new BehaviorSubject<Basemap>('positron');
  private activeLayerIdSubject = new BehaviorSubject<string | undefined>(undefined);
  private changedKeysSubject = new BehaviorSubject<string[]>([]);

  // Track initial layer IDs to distinguish from chat-generated layers
  private initialLayerIds: Set<string> = new Set();

  // Track layer centers (captured when layer is first added)
  private layerCenters = new Map<string, { longitude: number; latitude: number; zoom: number }>();

  // Public observables
  public viewState$ = this.viewStateSubject.asObservable();
  public deckConfig$ = this.deckConfigSubject.asObservable();
  public basemap$ = this.basemapSubject.asObservable();
  public activeLayerId$ = this.activeLayerIdSubject.asObservable();

  /**
   * Combined state observable - emits whenever any state changes
   */
  public state$: Observable<StateChange> = combineLatest([
    this.viewStateSubject,
    this.deckConfigSubject,
    this.basemapSubject,
    this.activeLayerIdSubject,
    this.changedKeysSubject
  ]).pipe(
    map(([viewState, deckConfig, basemap, activeLayerId, changedKeys]) => ({
      state: {
        viewState,
        deckConfig,
        basemap,
        activeLayerId
      },
      changedKeys
    })),
    distinctUntilChanged((prev, curr) =>
      JSON.stringify(prev.state) === JSON.stringify(curr.state) &&
      JSON.stringify(prev.changedKeys) === JSON.stringify(curr.changedKeys)
    )
  );

  /**
   * Layers observable for components that only need layer info
   */
  public layers$: Observable<LayerSpec[]> = this.deckConfigSubject.pipe(
    map(config => config.layers),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );

  // ==================== GETTERS ====================

  getViewState(): MapViewState {
    return { ...this.viewStateSubject.value };
  }

  getDeckConfig(): DeckConfig {
    const config = this.deckConfigSubject.value;
    return {
      layers: [...config.layers],
      widgets: [...config.widgets],
      effects: [...config.effects]
    };
  }

  getBasemap(): Basemap {
    return this.basemapSubject.value;
  }

  getActiveLayerId(): string | undefined {
    return this.activeLayerIdSubject.value;
  }

  getState(): DeckStateData {
    return {
      viewState: this.getViewState(),
      deckConfig: this.getDeckConfig(),
      basemap: this.getBasemap(),
      activeLayerId: this.getActiveLayerId()
    };
  }

  getLayers(): LayerSpec[] {
    return [...this.deckConfigSubject.value.layers];
  }

  /**
   * Get the center coordinates for a layer (captured when layer was first added)
   */
  getLayerCenter(layerId: string): { longitude: number; latitude: number; zoom: number } | undefined {
    return this.layerCenters.get(layerId);
  }

  // ==================== SETTERS ====================

  /**
   * Update view state (partial update supported)
   */
  setViewState(partial: Partial<MapViewState>): void {
    const current = this.viewStateSubject.value;
    this.viewStateSubject.next({ ...current, ...partial });
    this.notifyChange(['viewState']);
  }

  /**
   * Set the complete deck configuration
   * Captures current viewState as center for newly added layers
   */
  setDeckConfig(config: DeckConfig): void {
    const current = this.deckConfigSubject.value;
    const existingLayerIds = new Set(current.layers.map(l => l['id'] as string));

    // Capture center for new layers based on current viewState
    const currentViewState = this.viewStateSubject.value;
    const newLayers = config.layers ?? [];
    for (const layer of newLayers) {
      const layerId = layer['id'] as string;
      if (layerId && !existingLayerIds.has(layerId) && !this.layerCenters.has(layerId)) {
        this.layerCenters.set(layerId, {
          longitude: currentViewState.longitude ?? 0,
          latitude: currentViewState.latitude ?? 0,
          zoom: currentViewState.zoom ?? 12
        });
      }
    }

    this.deckConfigSubject.next({
      layers: newLayers,
      widgets: config.widgets ?? [],
      effects: config.effects ?? []
    });
    this.notifyChange(['deckConfig']);
  }

  /**
   * Update only the layers, preserving widgets and effects
   * Captures current viewState as center for newly added layers
   */
  setLayers(layers: LayerSpec[]): void {
    const current = this.deckConfigSubject.value;
    const existingLayerIds = new Set(current.layers.map(l => l['id'] as string));

    // Capture center for new layers based on current viewState
    const currentViewState = this.viewStateSubject.value;
    for (const layer of layers) {
      const layerId = layer['id'] as string;
      if (layerId && !existingLayerIds.has(layerId) && !this.layerCenters.has(layerId)) {
        this.layerCenters.set(layerId, {
          longitude: currentViewState.longitude ?? 0,
          latitude: currentViewState.latitude ?? 0,
          zoom: currentViewState.zoom ?? 12
        });
      }
    }

    this.deckConfigSubject.next({
      ...current,
      layers
    });
    this.notifyChange(['deckConfig']);
  }

  /**
   * Set the basemap style
   */
  setBasemap(basemap: Basemap): void {
    this.basemapSubject.next(basemap);
    this.notifyChange(['basemap']);
  }

  /**
   * Set the active layer ID
   */
  setActiveLayerId(layerId: string): void {
    this.activeLayerIdSubject.next(layerId);
    this.notifyChange(['activeLayerId']);
  }

  // ==================== UTILITIES ====================

  /**
   * Set initial layer IDs to track which layers are not chat-generated
   */
  setInitialLayerIds(ids: string[]): void {
    this.initialLayerIds = new Set(ids);
  }

  /**
   * Clear all chat-generated layers, keeping only initial layers
   */
  clearChatGeneratedLayers(): void {
    const currentLayers = this.getLayers();
    const initialLayers = currentLayers.filter(
      layer => this.initialLayerIds.has(layer['id'] as string)
    );

    // Clear layer centers for removed layers
    const removedLayerIds = currentLayers
      .filter(layer => !this.initialLayerIds.has(layer['id'] as string))
      .map(layer => layer['id'] as string);
    for (const layerId of removedLayerIds) {
      this.layerCenters.delete(layerId);
    }

    this.setLayers(initialLayers);
    // Clear active layer if it was a chat-generated layer
    const activeLayerId = this.getActiveLayerId();
    if (activeLayerId && !this.initialLayerIds.has(activeLayerId)) {
      this.activeLayerIdSubject.next(undefined);
    }
  }

  // ==================== PRIVATE ====================

  private notifyChange(changedKeys: string[]): void {
    this.changedKeysSubject.next(changedKeys);
  }
}
