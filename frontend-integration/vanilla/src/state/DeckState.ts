import type { MapViewState } from '@deck.gl/core';

/**
 * Basemap style options
 */
export type Basemap = 'dark-matter' | 'positron' | 'voyager';

/**
 * Deck.gl configuration in JSON format
 * Layers, widgets, and effects use @@type, @@function prefixes for JSONConverter
 */
export interface DeckConfig {
  layers?: Record<string, unknown>[];
  widgets?: Record<string, unknown>[];
  effects?: Record<string, unknown>[];
}

/**
 * Complete deck state data
 */
export interface DeckStateData {
  viewState: MapViewState;
  deckConfig: DeckConfig;
  basemap: Basemap;
}

/**
 * Listener callback type - receives state and which keys changed
 */
type ChangeListener = (state: DeckStateData, changedKeys: string[]) => void;

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
 * Central state management class for Deck.gl map
 *
 * Replaces scattered state management with a single source of truth.
 * Notifies listeners when state changes so rendering can happen centrally.
 */
export class DeckState {
  private viewState: MapViewState;
  private deckConfig: DeckConfig;
  private basemap: Basemap;
  private listeners: Set<ChangeListener> = new Set();
  private isNotifying = false;

  constructor(initialState?: Partial<DeckStateData>) {
    this.viewState = initialState?.viewState ?? { ...DEFAULT_VIEW_STATE };
    this.deckConfig = initialState?.deckConfig ?? { layers: [], widgets: [], effects: [] };
    this.basemap = initialState?.basemap ?? 'positron';
  }

  // ==================== GETTERS ====================

  getViewState(): MapViewState {
    return { ...this.viewState };
  }

  getDeckConfig(): DeckConfig {
    return {
      layers: [...(this.deckConfig.layers ?? [])],
      widgets: [...(this.deckConfig.widgets ?? [])],
      effects: [...(this.deckConfig.effects ?? [])]
    };
  }

  getBasemap(): Basemap {
    return this.basemap;
  }

  getState(): DeckStateData {
    return {
      viewState: this.getViewState(),
      deckConfig: this.getDeckConfig(),
      basemap: this.basemap
    };
  }

  // ==================== SETTERS ====================

  /**
   * Update view state (partial update supported)
   */
  setViewState(partial: Partial<MapViewState>): void {
    this.viewState = { ...this.viewState, ...partial };
    this.notify(['viewState']);
  }

  /**
   * Set the complete deck configuration (layers, widgets, effects)
   * This replaces the entire config - include all layers you want to keep
   */
  setDeckConfig(config: DeckConfig): void {
    this.deckConfig = {
      layers: config.layers ?? [],
      widgets: config.widgets ?? [],
      effects: config.effects ?? []
    };
    this.notify(['deckConfig']);
  }

  /**
   * Update only the layers, preserving widgets and effects
   */
  setLayers(layers: Record<string, unknown>[]): void {
    this.deckConfig = {
      ...this.deckConfig,
      layers
    };
    this.notify(['deckConfig']);
  }

  /**
   * Set the basemap style
   */
  setBasemap(basemap: Basemap): void {
    this.basemap = basemap;
    this.notify(['basemap']);
  }

  /**
   * Batch update multiple state properties at once
   * Only notifies once with all changed keys
   */
  batchUpdate(updates: {
    viewState?: Partial<MapViewState>;
    deckConfig?: DeckConfig;
    basemap?: Basemap;
  }): void {
    const changedKeys: string[] = [];

    if (updates.viewState) {
      this.viewState = { ...this.viewState, ...updates.viewState };
      changedKeys.push('viewState');
    }

    if (updates.deckConfig) {
      this.deckConfig = {
        layers: updates.deckConfig.layers ?? [],
        widgets: updates.deckConfig.widgets ?? [],
        effects: updates.deckConfig.effects ?? []
      };
      changedKeys.push('deckConfig');
    }

    if (updates.basemap !== undefined) {
      this.basemap = updates.basemap;
      changedKeys.push('basemap');
    }

    if (changedKeys.length > 0) {
      this.notify(changedKeys);
    }
  }

  // ==================== SUBSCRIPTION ====================

  /**
   * Subscribe to state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notify(changedKeys: string[]): void {
    // Prevent recursive notifications
    if (this.isNotifying) {
      return;
    }

    this.isNotifying = true;
    const state = this.getState();

    try {
      this.listeners.forEach((listener) => {
        try {
          listener(state, changedKeys);
        } catch (error) {
          console.error('[DeckState] Listener error:', error);
        }
      });
    } finally {
      this.isNotifying = false;
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Get a layer by ID from the current config
   */
  getLayerById(layerId: string): Record<string, unknown> | undefined {
    return this.deckConfig.layers?.find((layer) => layer.id === layerId);
  }

  /**
   * Check if a layer exists
   */
  hasLayer(layerId: string): boolean {
    return this.deckConfig.layers?.some((layer) => layer.id === layerId) ?? false;
  }

  /**
   * Get all layer IDs
   */
  getLayerIds(): string[] {
    return (this.deckConfig.layers ?? [])
      .map((layer) => layer.id as string)
      .filter(Boolean);
  }

  /**
   * Reset to initial state
   */
  reset(initialState?: Partial<DeckStateData>): void {
    this.viewState = initialState?.viewState ?? { ...DEFAULT_VIEW_STATE };
    this.deckConfig = initialState?.deckConfig ?? { layers: [], widgets: [], effects: [] };
    this.basemap = initialState?.basemap ?? 'positron';
    this.notify(['viewState', 'deckConfig', 'basemap']);
  }
}
