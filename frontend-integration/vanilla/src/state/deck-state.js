/**
 * DeckState
 *
 * Centralized state management for deck.gl map.
 * Port of Angular's DeckStateService using EventEmitter instead of RxJS.
 */

import { EventEmitter } from './event-emitter.js';

export const DEFAULT_VIEW_STATE = {
  latitude: 41.8097343,
  longitude: -110.5556199,
  zoom: 3,
  bearing: 0,
  pitch: 0,
};

const DEFAULT_DECK_CONFIG = {
  layers: [],
  widgets: [],
  effects: [],
};

export class DeckState extends EventEmitter {
  constructor() {
    super();
    this._viewState = { ...DEFAULT_VIEW_STATE };
    this._deckConfig = { ...DEFAULT_DECK_CONFIG, layers: [], widgets: [], effects: [] };
    this._basemap = 'positron';
    this._activeLayerId = undefined;
    this._transitionDuration = 1000;

    // Track initial layer IDs to distinguish from chat-generated layers
    this._initialLayerIds = new Set();

    // Track layer centers (captured when layer is first added)
    this._layerCenters = new Map();
  }

  // ==================== GETTERS ====================

  getViewState() {
    return { ...this._viewState };
  }

  getDeckConfig() {
    return {
      layers: [...this._deckConfig.layers],
      widgets: [...this._deckConfig.widgets],
      effects: [...this._deckConfig.effects],
    };
  }

  getBasemap() {
    return this._basemap;
  }

  getActiveLayerId() {
    return this._activeLayerId;
  }

  getState() {
    return {
      viewState: this.getViewState(),
      deckConfig: this.getDeckConfig(),
      basemap: this.getBasemap(),
      activeLayerId: this.getActiveLayerId(),
      transitionDuration: this._transitionDuration,
    };
  }

  getLayers() {
    return [...this._deckConfig.layers];
  }

  getLayerCenter(layerId) {
    return this._layerCenters.get(layerId);
  }

  // ==================== SETTERS ====================

  setViewState(partial) {
    const { transitionDuration, ...viewStatePartial } = partial;
    if (transitionDuration !== undefined) {
      this._transitionDuration = transitionDuration;
    } else {
      this._transitionDuration = 1000;
    }
    this._viewState = { ...this._viewState, ...viewStatePartial };
    this._notifyChange(['viewState']);
  }

  setDeckConfig(config) {
    const existingLayerIds = new Set(this._deckConfig.layers.map((l) => l['id']));

    // Capture center for new layers based on current viewState
    const newLayers = config.layers ?? [];
    for (const layer of newLayers) {
      const layerId = layer['id'];
      if (layerId && !existingLayerIds.has(layerId) && !this._layerCenters.has(layerId)) {
        this._layerCenters.set(layerId, {
          longitude: this._viewState.longitude ?? 0,
          latitude: this._viewState.latitude ?? 0,
          zoom: this._viewState.zoom ?? 12,
        });
      }
    }

    this._deckConfig = {
      layers: newLayers,
      widgets: config.widgets ?? [],
      effects: config.effects ?? [],
    };
    this._notifyChange(['deckConfig']);
  }

  setLayers(layers) {
    const existingLayerIds = new Set(this._deckConfig.layers.map((l) => l['id']));

    // Capture center for new layers
    for (const layer of layers) {
      const layerId = layer['id'];
      if (layerId && !existingLayerIds.has(layerId) && !this._layerCenters.has(layerId)) {
        this._layerCenters.set(layerId, {
          longitude: this._viewState.longitude ?? 0,
          latitude: this._viewState.latitude ?? 0,
          zoom: this._viewState.zoom ?? 12,
        });
      }
    }

    this._deckConfig = {
      ...this._deckConfig,
      layers,
    };
    this._notifyChange(['deckConfig']);
  }

  setBasemap(basemap) {
    this._basemap = basemap;
    this._notifyChange(['basemap']);
  }

  setActiveLayerId(layerId) {
    this._activeLayerId = layerId;
    this._notifyChange(['activeLayerId']);
  }

  // ==================== UTILITIES ====================

  setInitialLayerIds(ids) {
    this._initialLayerIds = new Set(ids);
  }

  clearChatGeneratedLayers() {
    const currentLayers = this.getLayers();
    const initialLayers = currentLayers.filter((layer) =>
      this._initialLayerIds.has(layer['id'])
    );

    // Clear layer centers for removed layers
    const removedLayerIds = currentLayers
      .filter((layer) => !this._initialLayerIds.has(layer['id']))
      .map((layer) => layer['id']);
    for (const layerId of removedLayerIds) {
      this._layerCenters.delete(layerId);
    }

    this.setLayers(initialLayers);

    // Clear active layer if it was a chat-generated layer
    if (this._activeLayerId && !this._initialLayerIds.has(this._activeLayerId)) {
      this._activeLayerId = undefined;
    }
  }

  // ==================== PRIVATE ====================

  _notifyChange(changedKeys) {
    this.emit('change', {
      state: this.getState(),
      changedKeys,
    });
  }
}
