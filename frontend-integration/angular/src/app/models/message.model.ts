import { Deck } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';
import { LegendData } from '../utils/legend.utils';

/**
 * User context for business location analysis
 */
export interface UserContext {
  analysisType?: string;
  analysisTypeName?: string;
  country?: string;
  businessType?: string;       // Single value (backward compat)
  businessTypeName?: string;  // Single value (backward compat)
  businessTypes?: string[];   // Array of category IDs (new)
  businessTypeNames?: string[]; // Array of category names (new)
  selectedRadius?: number;     // Radius in miles (optional, not used for demographic)
  radiusUnit?: 'miles';
  selectedDrivetime?: number;  // Drivetime in minutes (for demographic analysis)
  drivetimeUnit?: 'minutes';
  targetArea?: {
    name?: string;
    bbox?: [number, number, number, number];
  };
  selectedLocation?: string;       // Location ID or 'custom'
  selectedLocationName?: string;   // Human-readable location name
  customLocation?: string;         // Custom location text (if id='custom')
  locationCoordinates?: { longitude: number; latitude: number };  // Preset coordinates
}

export interface Message {
  type: 'user' | 'assistant' | 'action' | 'error' | 'system' | 'tool';
  content: string;
  streaming?: boolean;
  messageId?: string;
  id?: string;
  toolName?: string;
  status?: 'success' | 'error' | 'pending';
  timestamp?: number;
}

export interface WebSocketMessage {
  type:
    | 'chat_message'
    | 'stream_chunk'
    | 'tool_call'
    | 'tool_call_start'
    | 'mcp_tool_result'
    | 'custom_tool_result'
    | 'tool_result'
    | 'error'
    | 'welcome';
  content?: string;
  messageId?: string;
  isComplete?: boolean;
  tool?: string;
  toolName?: string;
  parameters?: any;
  data?: any;
  result?: any;
  callId?: string;
  timestamp?: number;
  success?: boolean;
  message?: string;
  error?: string;
}

export interface MapInstances {
  deck: Deck;
  map: maplibregl.Map;
}

// Extended loader state type for better UX
export type LoaderStage =
  | 'thinking'
  | 'starting'
  | 'mcp_request'
  | 'mcp_processing'
  | 'enriching'
  | 'creating'
  | 'loading'
  | 'executing';

export type LoaderState = LoaderStage | null;

// Layer configuration for registry
export interface LayerConfig {
  id: string;
  name: string;
  color: string; // keep for backward compatibility
  visible: boolean;
  center?: { longitude: number; latitude: number; zoom?: number };
  legend?: LegendData; // new field for detailed legend
}

// Active filter for data filtering
export interface ActiveFilter {
  property: string;
  operator: string;
  value: string;
}

// Snackbar configuration for notifications
export interface SnackbarConfig {
  message: string | null;
  type: 'error' | 'info' | 'success';
}

// Initial state sent to backend with each message
export interface InitialState {
  viewState: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  };
  layers: Array<{
    id: string;
    type: string;
    visible: boolean;
    styleContext?: {
      getFillColor?: unknown;
      filters?: unknown;
      updateTriggers?: unknown;
    };
  }>;
  activeLayerId?: string;
  cartoConfig: {
    connectionName: string;
    hasCredentials: boolean;
  };
  userContext?: UserContext;
}
