import type {
  DeckGLJsonSpec,
  ViewStateSpec,
  LayerSpec,
} from '../schemas/deckgl-json';
import { createConstantRef, createFunctionRef } from '../schemas/deckgl-json';
import type { SupportedLayerType } from '../schemas/layer-specs';

/**
 * Spec Generator Functions
 *
 * These functions transform validated tool parameters into @deck.gl/json
 * compatible specifications that can be processed by JSONConverter.
 */

// ============================================================================
// View State Spec Generators
// ============================================================================

export interface FlyToParams {
  lat: number;
  lng: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
}

/**
 * Generate a @deck.gl/json spec for fly-to operation
 */
export function generateFlyToSpec(params: FlyToParams): DeckGLJsonSpec {
  return {
    initialViewState: {
      longitude: params.lng,
      latitude: params.lat,
      zoom: params.zoom ?? 12,
      pitch: params.pitch ?? 0,
      bearing: params.bearing ?? 0,
      transitionDuration: params.transitionDuration ?? 1000,
      transitionInterpolator: createConstantRef('FlyToInterpolator'),
    },
  };
}

export interface ZoomMapParams {
  direction: 'in' | 'out';
  levels?: number;
  currentZoom: number; // Required from current state
}

/**
 * Generate a @deck.gl/json spec for zoom operation
 */
export function generateZoomSpec(params: ZoomMapParams): DeckGLJsonSpec {
  const levels = params.levels ?? 1;
  const delta = params.direction === 'in' ? levels : -levels;
  const newZoom = Math.max(0, Math.min(22, params.currentZoom + delta));

  return {
    initialViewState: {
      zoom: newZoom,
      transitionDuration: 500,
      transitionInterpolator: createConstantRef('LinearInterpolator'),
    },
  };
}

export interface SetViewStateParams {
  longitude?: number;
  latitude?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
}

/**
 * Generate a @deck.gl/json spec for setting view state
 */
export function generateViewStateSpec(params: SetViewStateParams): DeckGLJsonSpec {
  const viewState: ViewStateSpec = {};

  if (params.longitude !== undefined) viewState.longitude = params.longitude;
  if (params.latitude !== undefined) viewState.latitude = params.latitude;
  if (params.zoom !== undefined) viewState.zoom = params.zoom;
  if (params.pitch !== undefined) viewState.pitch = params.pitch;
  if (params.bearing !== undefined) viewState.bearing = params.bearing;

  if (params.transitionDuration !== undefined) {
    viewState.transitionDuration = params.transitionDuration;
    viewState.transitionInterpolator = createConstantRef('FlyToInterpolator');
  }

  return { initialViewState: viewState };
}

// ============================================================================
// Layer Operation Spec Generators
// ============================================================================

export interface ToggleLayerParams {
  layerId: string;
  visible: boolean;
}

/**
 * Generate a @deck.gl/json spec for toggling layer visibility
 */
export function generateToggleLayerSpec(params: ToggleLayerParams): DeckGLJsonSpec {
  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId,
        props: {
          visible: params.visible,
        },
      },
    ],
  };
}

export interface SetPointColorParams {
  layerId?: string;
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Generate a @deck.gl/json spec for setting point color
 */
export function generateSetPointColorSpec(params: SetPointColorParams): DeckGLJsonSpec {
  const color = [params.r, params.g, params.b, params.a ?? 200];

  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId ?? 'points-layer',
        props: {
          getFillColor: color,
          updateTriggers: {
            getFillColor: `uniform:${color.join(',')}`,
          },
        },
      },
    ],
  };
}

export interface ColorFeaturesByPropertyParams {
  layerId?: string;
  property: string;
  operator: 'equals' | 'startsWith' | 'contains' | 'regex';
  value: string;
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Generate a @deck.gl/json spec for coloring features by property
 */
export function generateColorByPropertySpec(
  params: ColorFeaturesByPropertyParams
): DeckGLJsonSpec {
  const color = [params.r, params.g, params.b, params.a ?? 180];
  const colorMap = { [params.value]: color };

  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId ?? 'points-layer',
        props: {
          getFillColor: createFunctionRef('getColorByProperty', {
            property: params.property,
            operator: params.operator,
            colorMap,
          }),
          updateTriggers: {
            getFillColor: `${params.property}:${params.operator}:${params.value}`,
          },
        },
      },
    ],
  };
}

export interface FilterFeaturesByPropertyParams {
  layerId?: string;
  property?: string;
  operator?: 'equals' | 'startsWith' | 'contains' | 'regex';
  value?: string;
  reset?: boolean;
}

/**
 * Generate a @deck.gl/json spec for filtering features
 */
export function generateFilterSpec(params: FilterFeaturesByPropertyParams): DeckGLJsonSpec {
  if (params.reset) {
    return {
      layerOperations: [
        {
          operation: 'update',
          layerId: params.layerId ?? 'points-layer',
          props: {
            // Signal to restore original data
            _filterReset: true,
            updateTriggers: {
              data: 'reset',
            },
          },
        },
      ],
    };
  }

  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId ?? 'points-layer',
        props: {
          // Signal to apply filter
          _filterParams: {
            property: params.property,
            operator: params.operator ?? 'equals',
            value: params.value,
          },
          updateTriggers: {
            data: `${params.property}:${params.operator}:${params.value}`,
          },
        },
      },
    ],
  };
}

export interface SizeFeaturesByPropertyParams {
  layerId?: string;
  property?: string;
  sizeRules?: Array<{ value: string; size: number }>;
  defaultSize?: number;
  reset?: boolean;
}

/**
 * Generate a @deck.gl/json spec for sizing features by property
 */
export function generateSizeByPropertySpec(
  params: SizeFeaturesByPropertyParams
): DeckGLJsonSpec {
  if (params.reset) {
    return {
      layerOperations: [
        {
          operation: 'update',
          layerId: params.layerId ?? 'points-layer',
          props: {
            getPointRadius: params.defaultSize ?? 8,
            updateTriggers: {
              getPointRadius: 'reset',
            },
          },
        },
      ],
    };
  }

  // Convert size rules to a map
  const sizeMap: Record<string, number> = {};
  params.sizeRules?.forEach((rule) => {
    sizeMap[rule.value] = rule.size;
  });

  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId ?? 'points-layer',
        props: {
          getPointRadius: createFunctionRef('getSizeByProperty', {
            property: params.property,
            sizeMap,
            defaultSize: params.defaultSize ?? 8,
          }),
          updateTriggers: {
            getPointRadius: `${params.property}:${JSON.stringify(params.sizeRules)}`,
          },
        },
      },
    ],
  };
}

// ============================================================================
// Layer Management Spec Generators
// ============================================================================

export interface AddLayerParams {
  layerType: SupportedLayerType;
  id: string;
  data?: string | Record<string, unknown>;
  visible?: boolean;
  opacity?: number;
  props?: Record<string, unknown>;
}

/**
 * Generate a @deck.gl/json spec for adding a new layer
 */
export function generateAddLayerSpec(params: AddLayerParams): DeckGLJsonSpec {
  const layerSpec: LayerSpec = {
    '@@type': params.layerType,
    id: params.id,
    visible: params.visible ?? true,
    opacity: params.opacity ?? 1,
    ...params.props,
  };

  // Handle data
  if (params.data) {
    if (typeof params.data === 'string') {
      // Check if it's a function reference
      if (params.data.startsWith('@@function')) {
        layerSpec.data = params.data;
      } else {
        // Assume URL
        layerSpec.data = params.data;
      }
    } else {
      layerSpec.data = params.data;
    }
  }

  return {
    layers: [layerSpec],
    layerOperations: [
      {
        operation: 'add',
        layerId: params.id,
      },
    ],
  };
}

export interface AddRasterLayerParams {
  id: string;
  connectionName: string;
  tableName: string;
  visible?: boolean;
  colorFunction?: string; // Optional custom color function
}

/**
 * Generate a @deck.gl/json spec for adding a CARTO raster layer
 */
export function generateAddRasterLayerSpec(params: AddRasterLayerParams): DeckGLJsonSpec {
  // Build data source as function reference object
  const dataSource: any = {
    '@@function': 'rasterSource',
    connectionName: params.connectionName,
    tableName: params.tableName,
  };

  const layerSpec: LayerSpec = {
    '@@type': 'RasterTileLayer',
    id: params.id,
    visible: params.visible ?? true,
    data: dataSource,
  };

  // Add color function if provided
  if (params.colorFunction) {
    layerSpec.getFillColor = params.colorFunction;
  }

  return {
    layers: [layerSpec],
    layerOperations: [
      {
        operation: 'add',
        layerId: params.id,
      },
    ],
  };
}

export interface AddVectorLayerParams {
  id: string;
  connectionName: string;
  tableName: string;
  accessToken?: string;
  apiBaseUrl?: string;
  columns?: string[];
  spatialDataColumn?: string;
  visible?: boolean;
  opacity?: number;
  fillColor?: string | number[];
  lineColor?: string | number[];
  pointRadiusMinPixels?: number;
  pickable?: boolean;
}

/**
 * Generate a @deck.gl/json spec for adding a CARTO vector layer
 */
export function generateAddVectorLayerSpec(params: AddVectorLayerParams): DeckGLJsonSpec {
  // Build data source as function reference object
  // JSONConverter expects: { "@@function": "name", ...args }
  const dataSource: any = {
    '@@function': 'vectorTableSource',
    connectionName: params.connectionName,
    tableName: params.tableName,
  };

  // Add credentials if provided (from MCP response)
  if (params.accessToken) dataSource.accessToken = params.accessToken;
  if (params.apiBaseUrl) dataSource.apiBaseUrl = params.apiBaseUrl;

  // Handle columns - if empty/not specified but spatialDataColumn is provided, include it
  let columns = params.columns;
  if ((!columns || columns.length === 0) && params.spatialDataColumn) {
    columns = [params.spatialDataColumn];
  }
  if (columns && columns.length > 0) {
    dataSource.columns = columns;
  }

  if (params.spatialDataColumn) dataSource.spatialDataColumn = params.spatialDataColumn;

  const layerSpec: LayerSpec = {
    '@@type': 'VectorTileLayer',
    id: params.id,
    visible: params.visible ?? true,
    opacity: params.opacity ?? 1,
    pickable: params.pickable ?? true,
    data: dataSource,
  };

  // Add styling properties if provided
  if (params.fillColor !== undefined) {
    layerSpec.getFillColor = params.fillColor;
  }
  if (params.lineColor !== undefined) {
    layerSpec.getLineColor = params.lineColor;
  }
  if (params.pointRadiusMinPixels !== undefined) {
    layerSpec.pointRadiusMinPixels = params.pointRadiusMinPixels;
  }

  return {
    layers: [layerSpec],
    layerOperations: [
      {
        operation: 'add',
        layerId: params.id,
      },
    ],
  };
}

export interface RemoveLayerParams {
  layerId: string;
}

/**
 * Generate a @deck.gl/json spec for removing a layer
 */
export function generateRemoveLayerSpec(params: RemoveLayerParams): DeckGLJsonSpec {
  return {
    layerOperations: [
      {
        operation: 'remove',
        layerId: params.layerId,
      },
    ],
  };
}

export interface UpdateLayerPropsParams {
  layerId: string;
  props: Record<string, unknown>;
}

/**
 * Generate a @deck.gl/json spec for updating layer props
 */
export function generateUpdateLayerPropsSpec(params: UpdateLayerPropsParams): DeckGLJsonSpec {
  return {
    layerOperations: [
      {
        operation: 'update',
        layerId: params.layerId,
        props: params.props,
      },
    ],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge multiple DeckGLJsonSpecs into one
 */
export function mergeSpecs(...specs: DeckGLJsonSpec[]): DeckGLJsonSpec {
  const result: DeckGLJsonSpec = {};

  for (const spec of specs) {
    // Merge view state (later specs override earlier)
    if (spec.initialViewState) {
      result.initialViewState = {
        ...result.initialViewState,
        ...spec.initialViewState,
      };
    }

    // Merge layers (concatenate)
    if (spec.layers) {
      result.layers = [...(result.layers ?? []), ...spec.layers];
    }

    // Merge layer operations (concatenate)
    if (spec.layerOperations) {
      result.layerOperations = [
        ...(result.layerOperations ?? []),
        ...spec.layerOperations,
      ];
    }

    // Merge map style (later overrides)
    if (spec.mapStyle) {
      result.mapStyle = spec.mapStyle;
    }

    // Merge controller (later overrides)
    if (spec.controller !== undefined) {
      result.controller = spec.controller;
    }
  }

  return result;
}

/**
 * Check if a spec contains view state changes
 */
export function hasViewStateChanges(spec: DeckGLJsonSpec): boolean {
  return spec.initialViewState !== undefined;
}

/**
 * Check if a spec contains layer changes
 */
export function hasLayerChanges(spec: DeckGLJsonSpec): boolean {
  return (
    (spec.layers !== undefined && spec.layers.length > 0) ||
    (spec.layerOperations !== undefined && spec.layerOperations.length > 0)
  );
}

/**
 * Extract layer IDs affected by a spec
 */
export function getAffectedLayerIds(spec: DeckGLJsonSpec): string[] {
  const ids = new Set<string>();

  spec.layers?.forEach((layer) => ids.add(layer.id));
  spec.layerOperations?.forEach((op) => ids.add(op.layerId));

  return Array.from(ids);
}
