/**
 * DeckState Context
 *
 * Centralized state management for deck.gl map.
 * Replaces Angular's DeckStateService with React Context + useReducer.
 */

import React, { createContext, useReducer, useRef, useCallback, type ReactNode } from 'react';
import type { LayerSpec } from '../utils/layer-merge';

export type Basemap = 'dark-matter' | 'positron' | 'voyager';

export interface DeckConfig {
  layers: LayerSpec[];
  widgets: Record<string, unknown>[];
  effects: Record<string, unknown>[];
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface DeckStateData {
  viewState: ViewState;
  deckConfig: DeckConfig;
  basemap: Basemap;
  activeLayerId?: string;
  transitionDuration: number;
}

const DEFAULT_VIEW_STATE: ViewState = {
  latitude: 41.8097343,
  longitude: -110.5556199,
  zoom: 3,
  bearing: 0,
  pitch: 0,
};

const DEFAULT_DECK_CONFIG: DeckConfig = {
  layers: [],
  widgets: [],
  effects: [],
};

// Actions
type DeckStateAction =
  | { type: 'SET_VIEW_STATE'; payload: Partial<ViewState> & { transitionDuration?: number } }
  | { type: 'SET_DECK_CONFIG'; payload: DeckConfig }
  | { type: 'SET_LAYERS'; payload: LayerSpec[] }
  | { type: 'SET_BASEMAP'; payload: Basemap }
  | { type: 'SET_ACTIVE_LAYER_ID'; payload: string | undefined }
  | { type: 'CLEAR_CHAT_LAYERS'; payload: Set<string> };

function deckStateReducer(state: DeckStateData, action: DeckStateAction): DeckStateData {
  switch (action.type) {
    case 'SET_VIEW_STATE': {
      const { transitionDuration, ...viewStatePartial } = action.payload;
      return {
        ...state,
        viewState: { ...state.viewState, ...viewStatePartial },
        transitionDuration: transitionDuration ?? 1000,
      };
    }
    case 'SET_DECK_CONFIG':
      return { ...state, deckConfig: action.payload };
    case 'SET_LAYERS':
      return {
        ...state,
        deckConfig: { ...state.deckConfig, layers: action.payload },
      };
    case 'SET_BASEMAP':
      return { ...state, basemap: action.payload };
    case 'SET_ACTIVE_LAYER_ID':
      return { ...state, activeLayerId: action.payload };
    case 'CLEAR_CHAT_LAYERS': {
      const initialLayerIds = action.payload;
      const filteredLayers = state.deckConfig.layers.filter((layer) =>
        initialLayerIds.has(layer['id'] as string)
      );
      return {
        ...state,
        deckConfig: { ...state.deckConfig, layers: filteredLayers },
        activeLayerId:
          state.activeLayerId && !initialLayerIds.has(state.activeLayerId)
            ? undefined
            : state.activeLayerId,
      };
    }
    default:
      return state;
  }
}

// Context value type
export interface DeckStateContextValue {
  state: DeckStateData;
  setViewState: (partial: Partial<ViewState> & { transitionDuration?: number }) => void;
  updateCurrentViewState: (vs: Partial<ViewState>) => void;
  setDeckConfig: (config: DeckConfig) => void;
  setLayers: (layers: LayerSpec[]) => void;
  setBasemap: (basemap: Basemap) => void;
  setActiveLayerId: (id: string | undefined) => void;
  getViewState: () => ViewState;
  getDeckConfig: () => DeckConfig;
  getLayerCenter: (layerId: string) => { longitude: number; latitude: number; zoom: number } | undefined;
  clearChatGeneratedLayers: () => void;
  setInitialLayerIds: (ids: string[]) => void;
}

export const DeckStateContext = createContext<DeckStateContextValue | null>(null);

export function DeckStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(deckStateReducer, {
    viewState: { ...DEFAULT_VIEW_STATE },
    deckConfig: { ...DEFAULT_DECK_CONFIG },
    basemap: 'positron' as Basemap,
    activeLayerId: undefined,
    transitionDuration: 1000,
  });

  // Use refs for mutable data that doesn't need re-renders
  const layerCentersRef = useRef(new Map<string, { longitude: number; latitude: number; zoom: number }>());
  const initialLayerIdsRef = useRef(new Set<string>());
  // Track actual view state from user interaction (no re-renders)
  const currentViewStateRef = useRef<ViewState>({ ...DEFAULT_VIEW_STATE });
  // Keep a mutable ref for current state to avoid stale closure issues
  const stateRef = useRef(state);
  stateRef.current = state;

  const setViewState = useCallback(
    (partial: Partial<ViewState> & { transitionDuration?: number }) => {
      const { transitionDuration: _, ...viewStatePartial } = partial;
      currentViewStateRef.current = { ...currentViewStateRef.current, ...viewStatePartial };
      dispatch({ type: 'SET_VIEW_STATE', payload: partial });
    },
    []
  );

  // Update current view state ref only (for user drag tracking, no re-render)
  const updateCurrentViewState = useCallback(
    (vs: Partial<ViewState>) => {
      currentViewStateRef.current = { ...currentViewStateRef.current, ...vs };
    },
    []
  );

  const setDeckConfig = useCallback(
    (config: DeckConfig) => {
      // Capture center for new layers using actual current position
      const currentState = stateRef.current;
      const currentVS = currentViewStateRef.current;
      const existingLayerIds = new Set(
        currentState.deckConfig.layers.map((l) => l['id'] as string)
      );
      const newLayers = config.layers ?? [];
      for (const layer of newLayers) {
        const layerId = layer['id'] as string;
        if (layerId && !existingLayerIds.has(layerId) && !layerCentersRef.current.has(layerId)) {
          layerCentersRef.current.set(layerId, {
            longitude: currentVS.longitude ?? 0,
            latitude: currentVS.latitude ?? 0,
            zoom: currentVS.zoom ?? 12,
          });
        }
      }
      dispatch({ type: 'SET_DECK_CONFIG', payload: config });
    },
    []
  );

  const setLayers = useCallback(
    (layers: LayerSpec[]) => {
      // Capture center for new layers using actual current position
      const currentState = stateRef.current;
      const currentVS = currentViewStateRef.current;
      const existingLayerIds = new Set(
        currentState.deckConfig.layers.map((l) => l['id'] as string)
      );
      for (const layer of layers) {
        const layerId = layer['id'] as string;
        if (layerId && !existingLayerIds.has(layerId) && !layerCentersRef.current.has(layerId)) {
          layerCentersRef.current.set(layerId, {
            longitude: currentVS.longitude ?? 0,
            latitude: currentVS.latitude ?? 0,
            zoom: currentVS.zoom ?? 12,
          });
        }
      }
      dispatch({ type: 'SET_LAYERS', payload: layers });
    },
    []
  );

  const setBasemap = useCallback((basemap: Basemap) => {
    dispatch({ type: 'SET_BASEMAP', payload: basemap });
  }, []);

  const setActiveLayerId = useCallback((id: string | undefined) => {
    dispatch({ type: 'SET_ACTIVE_LAYER_ID', payload: id });
  }, []);

  const getViewState = useCallback(() => ({ ...currentViewStateRef.current }), []);

  const getDeckConfig = useCallback(() => {
    const config = stateRef.current.deckConfig;
    return {
      layers: [...config.layers],
      widgets: [...config.widgets],
      effects: [...config.effects],
    };
  }, []);

  const getLayerCenter = useCallback(
    (layerId: string) => layerCentersRef.current.get(layerId),
    []
  );

  const clearChatGeneratedLayers = useCallback(() => {
    // Clean up layer centers for removed layers
    const currentLayers = stateRef.current.deckConfig.layers;
    const removedLayerIds = currentLayers
      .filter((layer) => !initialLayerIdsRef.current.has(layer['id'] as string))
      .map((layer) => layer['id'] as string);
    for (const layerId of removedLayerIds) {
      layerCentersRef.current.delete(layerId);
    }
    dispatch({ type: 'CLEAR_CHAT_LAYERS', payload: initialLayerIdsRef.current });
  }, []);

  const setInitialLayerIds = useCallback((ids: string[]) => {
    initialLayerIdsRef.current = new Set(ids);
  }, []);

  const contextValue: DeckStateContextValue = {
    state,
    setViewState,
    updateCurrentViewState,
    setDeckConfig,
    setLayers,
    setBasemap,
    setActiveLayerId,
    getViewState,
    getDeckConfig,
    getLayerCenter,
    clearChatGeneratedLayers,
    setInitialLayerIds,
  };

  return (
    <DeckStateContext.Provider value={contextValue}>{children}</DeckStateContext.Provider>
  );
}

export { DEFAULT_VIEW_STATE };
