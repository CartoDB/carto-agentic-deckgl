import { Deck } from '@deck.gl/core';
import maplibregl from 'maplibre-gl';

export interface Message {
  type: 'user' | 'assistant' | 'action' | 'error' | 'system';
  content: string;
  streaming?: boolean;
  messageId?: string;
  id?: string;
}

export interface WebSocketMessage {
  type: 'chat_message' | 'stream_chunk' | 'tool_call' | 'error' | 'welcome';
  content?: string;
  messageId?: string;
  isComplete?: boolean;
  tool?: string;
  parameters?: any;
  timestamp?: number;
}

export interface MapInstances {
  deck: Deck;
  map: maplibregl.Map;
}

// Loader state type matching React's useMapAITools hook
export type LoaderState = 'thinking' | 'executing' | null;

// Layer configuration for registry (matching React's useLayerRegistry)
export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

// Active filter for data filtering (matching React's useDataFilters)
export interface ActiveFilter {
  property: string;
  operator: string;
  value: string;
}

// Snackbar configuration for notifications
export interface SnackbarConfig {
  message: string | null;
  type: 'error' | 'info';
}
