import { Deck } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';

export interface Message {
  type: 'user' | 'assistant' | 'action' | 'error' | 'system' | 'tool';
  content: string;
  streaming?: boolean;
  messageId?: string;
  id?: string;
  toolName?: string;
  status?: 'success' | 'error' | 'pending';
}

export interface WebSocketMessage {
  type:
    | 'chat_message'
    | 'stream_chunk'
    | 'tool_call'
    | 'tool_call_start'
    | 'mcp_tool_result'
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
  color: string;
  visible: boolean;
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
  }>;
  activeLayerId?: string;
  cartoConfig: {
    connectionName: string;
    hasCredentials: boolean;
  };
}
