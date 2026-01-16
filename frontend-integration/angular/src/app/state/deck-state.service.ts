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
export interface StateChange {
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
   */
  setDeckConfig(config: DeckConfig): void {
    this.deckConfigSubject.next({
      layers: config.layers ?? [],
      widgets: config.widgets ?? [],
      effects: config.effects ?? []
    });
    this.notifyChange(['deckConfig']);
  }

  /**
   * Update only the layers, preserving widgets and effects
   */
  setLayers(layers: LayerSpec[]): void {
    const current = this.deckConfigSubject.value;
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

  /**
   * Batch update multiple state properties at once
   */
  batchUpdate(updates: {
    viewState?: Partial<MapViewState>;
    deckConfig?: DeckConfig;
    basemap?: Basemap;
  }): void {
    const changedKeys: string[] = [];

    if (updates.viewState) {
      const current = this.viewStateSubject.value;
      this.viewStateSubject.next({ ...current, ...updates.viewState });
      changedKeys.push('viewState');
    }

    if (updates.deckConfig) {
      this.deckConfigSubject.next({
        layers: updates.deckConfig.layers ?? [],
        widgets: updates.deckConfig.widgets ?? [],
        effects: updates.deckConfig.effects ?? []
      });
      changedKeys.push('deckConfig');
    }

    if (updates.basemap !== undefined) {
      this.basemapSubject.next(updates.basemap);
      changedKeys.push('basemap');
    }

    if (changedKeys.length > 0) {
      this.notifyChange(changedKeys);
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Get a layer by ID from the current config
   */
  getLayerById(layerId: string): LayerSpec | undefined {
    return this.deckConfigSubject.value.layers.find(layer => layer['id'] === layerId);
  }

  /**
   * Check if a layer exists
   */
  hasLayer(layerId: string): boolean {
    return this.deckConfigSubject.value.layers.some(layer => layer['id'] === layerId);
  }

  /**
   * Get all layer IDs
   */
  getLayerIds(): string[] {
    return this.deckConfigSubject.value.layers
      .map(layer => layer['id'] as string)
      .filter(Boolean);
  }

  /**
   * Reset to initial state
   */
  reset(initialState?: Partial<DeckStateData>): void {
    this.viewStateSubject.next(initialState?.viewState ?? { ...DEFAULT_VIEW_STATE });
    this.deckConfigSubject.next(initialState?.deckConfig ?? { ...DEFAULT_DECK_CONFIG });
    this.basemapSubject.next(initialState?.basemap ?? 'positron');
    this.activeLayerIdSubject.next(initialState?.activeLayerId);
    this.notifyChange(['viewState', 'deckConfig', 'basemap', 'activeLayerId']);
  }

  // ==================== PRIVATE ====================

  private notifyChange(changedKeys: string[]): void {
    this.changedKeysSubject.next(changedKeys);
  }
}
