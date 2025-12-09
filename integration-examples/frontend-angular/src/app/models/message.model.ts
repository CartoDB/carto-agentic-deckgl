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
