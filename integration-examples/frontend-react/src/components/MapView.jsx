import { useEffect, useRef, useState, useCallback } from 'react';
import { Deck } from '@deck.gl/core';
import { QuadbinTileLayer, quadbinQuerySource, BASEMAP, colorBins } from '@deck.gl/carto';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// View state centered on Spain
const INITIAL_VIEW_STATE = {
  latitude: 39.3262345,
  longitude: -4.8380649,
  zoom: 5,
  pitch: 45,
  bearing: -20,
  minZoom: 3.5,
  maxZoom: 15
};

// CARTO configuration from environment variables
const CARTO_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://gcp-us-east1.api.carto.com',
  accessToken: import.meta.env.VITE_API_ACCESS_TOKEN || '',
  connectionName: 'carto_dw'
};

// Check if CARTO credentials are configured
const hasCartoCredentials = () => {
  return !!CARTO_CONFIG.accessToken;
};

/**
 * Fetch available variables from CARTO metadata API
 */
const fetchVariables = async () => {
  try {
    const response = await fetch(
      'https://public.carto.com/api/v4/data/observatory/metadata/datasets/cdb_spatial_fea_94e6b1f/variables?minimal=false'
    );
    const data = await response.json();
    // Filter to only FLOAT type variables
    return data.filter((v) => v.db_type === 'FLOAT');
  } catch (error) {
    console.error('Error fetching variables:', error);
    return [];
  }
};

/**
 * Create QuadbinTileLayer for Spain spatial features
 */
const createQuadbinLayer = async (aggregationExp) => {
  if (!hasCartoCredentials()) {
    console.warn('CARTO credentials not configured. Set VITE_API_ACCESS_TOKEN in .env');
    return null;
  }

  console.log('Creating quadbin layer with aggregation:', aggregationExp);

  try {
    const source = await quadbinQuerySource({
      ...CARTO_CONFIG,
      aggregationExp: `${aggregationExp} as value`,
      aggregationResLevel: 8,
      sqlQuery: `SELECT * FROM cartobq.public_account.derived_spatialfeatures_esp_quadbin15_v1_yearly_v2`
    });

    console.log('Quadbin source created:', source);

    return new QuadbinTileLayer({
      id: 'quadbin-layer',
      data: source,
      opacity: 0.8,
      pickable: true,
      extruded: true,
      getFillColor: colorBins({
        attr: 'value',
        domain: [0, 100, 1000, 10000, 100000, 1000000],
        colors: 'PinkYl'
      }),
      getElevation: (d) => d.properties.value,
      lineWidthMinPixels: 0.5,
      getLineWidth: 0.5,
      getLineColor: [255, 255, 255, 100]
    });
  } catch (error) {
    console.error('Error creating quadbin layer:', error);
    return null;
  }
};

export const MapView = ({ onMapInit, onViewStateChange }) => {
  const mapRef = useRef(null);
  const deckRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const [variables, setVariables] = useState([]);
  const [selectedVariable, setSelectedVariable] = useState('population');
  const [aggregationExp, setAggregationExp] = useState('SUM(population)');

  // Render layers function - updates the deck with new layer
  const renderLayers = useCallback(async (variable, aggExp) => {
    if (!deckRef.current || !mapLoadedRef.current) {
      console.log('Deck or map not ready yet');
      return;
    }

    console.log('Rendering layer with:', variable, aggExp);

    const layer = await createQuadbinLayer(aggExp);
    if (layer) {
      deckRef.current.setProps({
        layers: [layer],
        getTooltip: ({ object }) =>
          object && {
            html: `Hex ID: ${object.id}<br/>
              ${variable.toUpperCase()}: ${parseInt(object.properties.value)}<br/>
              Aggregation: ${aggExp}`
          }
      });
      deckRef.current.redraw(true);
      console.log('✓ Quadbin layer updated with variable:', variable);
    }
  }, []);

  // Handle variable change
  const handleVariableChange = useCallback((e) => {
    const value = e.target.value;
    const option = e.target.selectedOptions[0];
    const aggMethod = option?.dataset?.aggMethod || 'SUM';

    const newAggExp = `${aggMethod}(${value})`;
    setSelectedVariable(value);
    setAggregationExp(newAggExp);
    renderLayers(value, newAggExp);
  }, [renderLayers]);

  useEffect(() => {
    // Create MapLibre map
    const map = new maplibregl.Map({
      container: 'map-container',
      style: BASEMAP.DARK_MATTER,
      interactive: false,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing
    });

    mapRef.current = map;

    // Get the canvas element
    const canvas = document.getElementById('deck-canvas');

    // Create deck.gl instance
    const deck = new Deck({
      canvas: canvas,
      width: '100%',
      height: '100%',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      onViewStateChange: ({ viewState }) => {
        // Sync MapLibre with deck.gl
        if (mapRef.current) {
          const { longitude, latitude, ...rest } = viewState;
          mapRef.current.jumpTo({
            center: [longitude, latitude],
            ...rest
          });
        }
        // Notify parent of view state change
        if (onViewStateChange) {
          onViewStateChange(viewState);
        }
        return viewState;
      },
      layers: [],
      _animate: true
    });

    deckRef.current = deck;

    // Wait for MapLibre to load before loading layers
    map.on('load', async () => {
      console.log('✓ MapLibre loaded');
      mapLoadedRef.current = true;
      deck.redraw(true);

      // Fetch variables and create initial layer
      const vars = await fetchVariables();
      setVariables(vars);

      // Determine default variable
      const defaultVar = vars.find((v) => v.column_name === 'population') || vars[0];
      const defaultVarName = defaultVar?.column_name || 'population';
      const defaultAggMethod = defaultVar?.agg_method || 'SUM';
      const defaultAggExp = `${defaultAggMethod}(${defaultVarName})`;

      setSelectedVariable(defaultVarName);
      setAggregationExp(defaultAggExp);

      // Create initial quadbin layer with the correct values
      const layer = await createQuadbinLayer(defaultAggExp);
      if (layer) {
        deck.setProps({
          layers: [layer],
          getTooltip: ({ object }) =>
            object && {
              html: `Hex ID: ${object.id}<br/>
                ${defaultVarName.toUpperCase()}: ${parseInt(object.properties.value)}<br/>
                Aggregation: ${defaultAggExp}`
            }
        });
        deck.redraw(true);
        console.log('✓ Quadbin layer created');
      }

      // Notify parent component that deck and map are ready
      if (onMapInit) {
        onMapInit({ deck, map });
      }
    });

    return () => {
      mapLoadedRef.current = false;
      if (deckRef.current) {
        deckRef.current.finalize();
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, [onMapInit, onViewStateChange]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map-container" style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <canvas
        id="deck-canvas"
        style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'auto' }}
      />

      {/* Variable Selector Panel - positioned on the RIGHT */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        background: 'rgba(0, 0, 0, 0.8)',
        padding: 16,
        borderRadius: 8,
        color: 'white',
        maxWidth: 280,
        zIndex: 1000
      }}>
        <p style={{ margin: '0 0 4px 0', fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>
          ✨👀 You're viewing
        </p>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14 }}>
          CARTO Spatial Features (Spain Quadbin)
        </h3>

        <label style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>
          Variable
        </label>
        <select
          value={selectedVariable}
          onChange={handleVariableChange}
          style={{
            width: '100%',
            padding: 8,
            marginTop: 4,
            marginBottom: 12,
            borderRadius: 4,
            border: 'none',
            background: '#333',
            color: 'white'
          }}
        >
          {variables.map((v) => (
            <option key={v.column_name} value={v.column_name} data-agg-method={v.agg_method}>
              {v.name}
            </option>
          ))}
        </select>

        <label style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>
          Aggregation method
        </label>
        <pre style={{
          margin: '4px 0 0 0',
          padding: 8,
          background: '#222',
          borderRadius: 4,
          fontSize: 12
        }}>
          {aggregationExp}
        </pre>
      </div>
    </div>
  );
};
