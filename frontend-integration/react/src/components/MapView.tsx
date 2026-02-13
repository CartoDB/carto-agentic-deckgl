import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DeckGL } from '@deck.gl/react';
import { Map } from 'react-map-gl/maplibre';
import { FlyToInterpolator } from '@deck.gl/core';
import { BASEMAP } from '@deck.gl/carto';
import { useDeckLayers } from '../hooks/useDeckLayers';
import { useDeckState } from '../hooks/useDeckState';
import { getTooltipContent } from '../utils/tooltip';
import type { PickingInfo } from '@deck.gl/core';
import type { Basemap } from '../contexts/DeckStateContext';
import './MapView.css';

const BASEMAP_URLS: Record<Basemap, string> = {
  'dark-matter': BASEMAP.DARK_MATTER,
  'positron': BASEMAP.POSITRON,
  'voyager': BASEMAP.VOYAGER,
};

interface MapViewProps {
  onViewStateChange?: (viewState: { zoom: number }) => void;
}

export function MapView({ onViewStateChange }: MapViewProps) {
  const deckState = useDeckState();
  const layers = useDeckLayers();
  const redrawTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const { viewState, basemap, transitionDuration } = deckState.state;

  // Compute initialViewState with transition properties (matches Angular/Vanilla pattern)
  const initialViewState = useMemo(() => ({
    ...viewState,
    transitionDuration,
    transitionInterpolator: new FlyToInterpolator(),
  }), [viewState, transitionDuration]);

  // Only update the ref (no context dispatch) on user drag — matches Angular/Vanilla behavior
  const handleViewStateChange = useCallback(
    ({ viewState: newViewState }: { viewState: Record<string, unknown> }) => {
      deckState.updateCurrentViewState(newViewState as { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number });
      onViewStateChange?.({ zoom: newViewState.zoom as number });
    },
    [deckState, onViewStateChange]
  );

  const getTooltip = useCallback((info: PickingInfo) => {
    return getTooltipContent(info);
  }, []);

  // Schedule redraws after layer updates
  useEffect(() => {
    redrawTimersRef.current.forEach(clearTimeout);
    redrawTimersRef.current = [];

    if (layers.length > 0) {
      const timers = [
        setTimeout(() => {
          requestAnimationFrame(() => { /* Force redraw */ });
        }, 50),
        setTimeout(() => {
          requestAnimationFrame(() => { /* Force redraw after transition */ });
        }, 1100),
      ];
      redrawTimersRef.current = timers;
    }

    return () => {
      redrawTimersRef.current.forEach(clearTimeout);
    };
  }, [layers]);

  return (
    <div className="map-view-container">
      <DeckGL
        initialViewState={initialViewState}
        onViewStateChange={handleViewStateChange}
        controller
        layers={layers}
        getTooltip={getTooltip}
      >
        <Map mapStyle={BASEMAP_URLS[basemap]} />
      </DeckGL>
    </div>
  );
}
