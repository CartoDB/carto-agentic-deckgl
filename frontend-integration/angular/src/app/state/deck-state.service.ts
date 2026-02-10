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
import { LOCATION_PIN_LAYER_ID } from '../config/location-pin.config';

/**
 * Location pin coordinates
 */
export interface PinLocation {
  longitude: number;
  latitude: number;
}

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
  private pinLocationsSubject = new BehaviorSubject<PinLocation[]>([]);

  // Track initial layer IDs to distinguish from chat-generated layers
  private initialLayerIds: Set<string> = new Set();

  // Track layer centers (captured when layer is first added)
  private layerCenters = new Map<string, { longitude: number; latitude: number; zoom: number }>();

  // Public observables
  public viewState$ = this.viewStateSubject.asObservable();
  public deckConfig$ = this.deckConfigSubject.asObservable();
  public basemap$ = this.basemapSubject.asObservable();
  public activeLayerId$ = this.activeLayerIdSubject.asObservable();
  public pinLocations$ = this.pinLocationsSubject.asObservable();

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

  getPinLocations(): PinLocation[] {
    return [...this.pinLocationsSubject.value];
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
   * Ensure Location Pin layer is always at the end of the layers array
   * This ensures the location marker is always visible on top of other layers
   */
  private ensureLocationPinOnTop(layers: LayerSpec[]): LayerSpec[] {
    const locationPinIndex = layers.findIndex(layer => (layer['id'] as string) === LOCATION_PIN_LAYER_ID);
    
    if (locationPinIndex === -1) {
      // Location Pin layer not found, return as-is
      return layers;
    }
    
    if (locationPinIndex === layers.length - 1) {
      // Already at the end, return as-is
      return layers;
    }
    
    // Move Location Pin layer to the end
    const locationPinLayer = layers[locationPinIndex];
    const otherLayers = layers.filter((_, index) => index !== locationPinIndex);
    return [...otherLayers, locationPinLayer];
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

    // Ensure Location Pin layer is always at the end
    const orderedLayers = this.ensureLocationPinOnTop(newLayers);

    this.deckConfigSubject.next({
      layers: orderedLayers,
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

    // Ensure Location Pin layer is always at the end
    const orderedLayers = this.ensureLocationPinOnTop(layers);

    this.deckConfigSubject.next({
      ...current,
      layers: orderedLayers
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
   * Add a pin location to the collection
   */
  addPinLocation(location: PinLocation): void {
    const current = this.pinLocationsSubject.value;
    this.pinLocationsSubject.next([...current, location]);
    this.notifyChange(['pinLocations']);
  }

  /**
   * Clear all pin locations
   */
  clearPinLocations(): void {
    this.pinLocationsSubject.next([]);
    this.notifyChange(['pinLocations']);
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
    this.layerCenters.clear();
    this.notifyChange(['viewState', 'deckConfig', 'basemap', 'activeLayerId']);
  }

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
    // Clear pin locations since they are chat-generated elements
    this.pinLocationsSubject.next([]);
  }

  // ==================== PRIVATE ====================

  private notifyChange(changedKeys: string[]): void {
    this.changedKeysSubject.next(changedKeys);
  }
}
