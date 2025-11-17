// backend/src/types/openai-messages.ts
export interface StreamChunk {
  type: 'stream_chunk';
  content: string;
  messageId: string;
  isComplete: boolean;
}

export interface ToolCall {
  type: 'tool_call';
  tool: 'zoom_map' | 'fly_to_location' | 'toggle_layer';
  parameters: Record<string, any>;
  callId: string;
}

export interface ErrorMessage {
  type: 'error';
  content: string;
  code?: string;
  timestamp?: number;
}

export type WebSocketMessage = StreamChunk | ToolCall | ErrorMessage;
