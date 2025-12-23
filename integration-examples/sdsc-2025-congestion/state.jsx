import {useMediaQuery} from '@material-ui/core';
import React, {useState, createContext, useCallback, useContext, useEffect} from 'react';
import {LinearInterpolator} from '@deck.gl/core';
import FlyToInterpolator from './layers/fly-to-interpolator.js';
import {Easing} from '@tweenjs/tween.js';

import slides from './slides';
import {createGoogle3DLayer} from './layers/google-3d';
import {fetchRemoteLayers} from './layers/remote';
import { CongestionZoneMaskLayer, CongestionZoneLayer } from './layers/congestion-zone';
import { TrafficBeforeLayer, TrafficAfterLayer } from './layers/traffic';
import { RegionalImprovementLayer } from './layers/regional-improvement';
import { SubwayLayer, SubwayShadowLayer } from './layers/subway';

const hash = window.location.hash;
let currentSlide = hash !== '' ? parseInt(hash.slice(1)) : 0;
if (isNaN(currentSlide) || !slides[currentSlide]) {
  currentSlide = 0;
}

const {view} = slides[0];
const initAppState = {
  credits: '',
  currentSlide,
  viewState: {...view, position: [0, 0, view.height], zoom: view.zoom - 1}
};

const LIMITED_EXTENT = [-73.99, 40.74, -73.97, 40.77];
const FULL_EXTENT = [-74.02, 40.70, -73.95, 40.80];
const transitionInterpolator = new LinearInterpolator(['bearing', 'longitude', 'latitude']);
export const AppStateContext = createContext(initAppState);

export const AppStateStore = ({children}) => {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('md'));
  const [credits, setCredits] = useState(initAppState.credits);
  const [currentSlide, setCurrentSlide] = useState(initAppState.currentSlide);
  const [filterValue, setFilterValue] = useState(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);
  const [viewState, setViewState] = useState(initAppState.viewState);
  const [loadRemoteLayers, setLoadRemoteLayers] = useState(false);
  const [time, setTime] = useState(0);
  const [layerOverrides, setLayerOverrides] = useState({});

  const Google3DLayer = createGoogle3DLayer(setCredits);

  // Animation loop for traffic trips
  useEffect(() => {
    const loopLength = 1700; // Animation loop length
    let animationId;

    const animate = () => {
      setTime(t => (t + 1) % loopLength);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const [allLayers, setAllLayers] = useState([]);
  const [layers, setLayers] = useState([]);

  const orbit = useCallback(previousTransition => {
    setViewState((viewState) => ({
      ...viewState,
      bearing: viewState.bearing + 120,
      transitionDuration: previousTransition ? 20000 : 25000, // TODO should match gradients with easing
      transitionEasing: previousTransition ? x => x : Easing.Quadratic.In,
      transitionInterpolator,
      onTransitionEnd: orbit
    }));
  }, []);

  const updateViewState = function (viewState, shouldOrbit) {
    if(currentSlide) setLoadRemoteLayers(true);
    setViewState({
      transitionDuration: 5000,
      ...viewState,
      transitionEasing: Easing.Quadratic.InOut,
      transitionInterpolator: new FlyToInterpolator({curve: 1.1}),
      onTransitionEnd: () => {
        setLoadRemoteLayers(true);
        if (shouldOrbit) {
          orbit();
        }
      }
    });
  };

  const [remoteLayers, setRemoteLayers] = useState([]);
  const [dynamicLayers, setDynamicLayers] = useState([]);

  useEffect(() => {
    // Defer load of remote layers until initial zoom in completes
    if (!loadRemoteLayers) return;
    fetchRemoteLayers().then(layers => {
      setRemoteLayers(layers);
    })
  }, [loadRemoteLayers]);

  // Combine local, remote, and dynamic layers
  useEffect(() => {
    setAllLayers([
      Google3DLayer,
      CongestionZoneMaskLayer,
      CongestionZoneLayer,
      // Shift timestamp to avoid empty map at start
      TrafficBeforeLayer.clone({ currentTime: time + 100 }),
      TrafficAfterLayer.clone({ currentTime: time + 100 }),
      RegionalImprovementLayer,
      SubwayLayer,
      SubwayShadowLayer,
      ...remoteLayers,
      ...dynamicLayers
    ]);
  }, [time, remoteLayers, dynamicLayers]);

  // Update layers when allLayers, currentSlide, or layerOverrides changes
  useEffect(
    () => {
      const {layers: visibleLayers} = slides[currentSlide];

      // Get IDs of dynamic layers (always visible unless overridden)
      const dynamicLayerIds = dynamicLayers.map(l => l.id);

      const baseLayers = allLayers.map(l => {
        // Dynamic layers are visible by default, slide layers follow slide config
        const isDynamic = dynamicLayerIds.includes(l.id);
        const visible = isDynamic ? true : visibleLayers.indexOf(l.id) !== -1;
        const props = {visible};

        // For slide layers: limit to single zoom level to avoid flashing (due to fade in transition)
        // and to limit data use on mobile
        // For dynamic layers: allow full zoom range
        if (!isDynamic) {
          props.minZoom = 12;
          props.maxZoom = 12;
          props.extent = isDesktop ? FULL_EXTENT : LIMITED_EXTENT;
        }

        // Apply layer style overrides from AI tools
        const overrides = layerOverrides[l.id] || {};
        Object.assign(props, overrides);

        return visible ? l.clone(props) : null;
      }).filter(Boolean);

      setLayers(baseLayers);
    },
    [currentSlide, isDesktop, allLayers, layerOverrides, dynamicLayers]
  );

  // Update view when currentSlide changes
  useEffect(
    () => {
      const {view, orbit: shouldOrbit} = slides[currentSlide];

      if (view && view.longitude !== undefined) {
        updateViewState({latitude: 0, longitude: 0, zoom: 0, bearing: 0, pitch: 0, position: [0, 0, view.height || 200], ...view}, shouldOrbit);
      }
    },
    [currentSlide]
  );
  useEffect(
    () => {
      setLayers(layers => layers.map(l => {
        const props = {};
        if (filterValue !== null && l && l.id !== 'google-3d') {
          props.filterRange = [filterValue - 0.00001, 10000];
        }
        props.highlightedFeatureId = hoveredFeatureId;

        return l && l.clone(props);
      }));
    },
    [filterValue, hoveredFeatureId]
  );

  // goToSlide - bounds-checked slide navigation for AI tools
  const goToSlide = useCallback((index) => {
    const validIndex = Math.max(0, Math.min(index, slides.length - 1));
    setCurrentSlide(validIndex);
  }, []);

  // updateLayerStyle - update layer visual styling for AI tools
  const updateLayerStyle = useCallback((layerId, styleProps) => {
    setLayerOverrides(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], ...styleProps }
    }));
  }, []);

  // resetLayerStyles - reset all layer styles to original for AI tools
  const resetLayerStyles = useCallback(() => {
    setLayerOverrides({});
  }, []);

  // addLayer - dynamically add a new layer (for AI tools)
  const addLayer = useCallback((layerSpec) => {
    // layerSpec should be a deck.gl JSON spec with @@type
    // Convert spec to actual layer instance using JSONConverter
    console.log('[State] addLayer called with layerSpec:', layerSpec);
    try {
      // Dynamically import JSONConverter
      import('./config/deckJsonConfig.js').then(async ({ getJsonConverter }) => {
        const converter = getJsonConverter();
        console.log('[State] About to convert spec:', { layers: [layerSpec] });
        const converted = converter.convert({ layers: [layerSpec] });
        console.log('[State] Conversion result:', converted);

        if (converted.layers && converted.layers[0]) {
          const newLayer = converted.layers[0];
          const isCartoLayer = newLayer.constructor.name === 'VectorTileLayer' ||
                               newLayer.constructor.name === 'RasterTileLayer';

          console.log('[State] New layer instance:', newLayer);
          console.log('[State] New layer props:', newLayer.props);
          console.log('[State] Is CARTO layer:', isCartoLayer);

          setDynamicLayers(prev => [...prev, newLayer]);
          console.log('[State] Added dynamic layer:', newLayer.id);

          // If CARTO layer, retry with exponential backoff to handle async table creation
          if (isCartoLayer) {
            console.log('[State] CARTO layer detected, scheduling retries for async table creation');

            // Retry with exponential backoff: 500ms, 1s, 2s, 4s
            const retryDelays = [500, 1000, 2000, 4000];

            for (const delay of retryDelays) {
              await new Promise(resolve => setTimeout(resolve, delay));

              // Force layer update by recreating it
              setDynamicLayers((prev) => {
                const filtered = prev.filter(l => l.id !== newLayer.id);
                return [...filtered, newLayer.clone()];
              });

              console.log(`[State] Retried CARTO layer after ${delay}ms`);
            }
          }
        } else {
          console.error('[State] No layers in conversion result');
        }
      });
    } catch (error) {
      console.error('[State] Failed to add layer:', error);
    }
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        next: () => {
          setCurrentSlide(currentSlide => Math.min(currentSlide + 1, slides.length - 1));
        },
        prev: () => {
          setCurrentSlide(currentSlide => Math.max(currentSlide - 1, 0));
        },
        reset: () => {
          setCurrentSlide(0);
        },
        goToSlide,
        credits,
        setFilterValue,
        filterValue,
        setHoveredFeatureId,
        currentSlide,
        layers,
        viewState,
        updateViewState,
        updateLayerStyle,
        resetLayerStyles,
        addLayer,
        slidesNumber: slides.length
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const AppStateContextConsumer = AppStateContext.Consumer;

export function useAppState() {
  return useContext(AppStateContext);
}
