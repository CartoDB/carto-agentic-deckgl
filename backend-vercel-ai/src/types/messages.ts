/**
 * Message types for WebSocket and HTTP communication
 */

/**
 * Initial map state sent with chat messages
 */
export interface InitialState {
  viewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch?: number;
    bearing?: number;
  };
  layers?: Array<{
    id: string;
    type: string;
    visible: boolean;
    [key: string]: unknown;
  }>;
  currentSlide?: number;
  slideMetadata?: {
    index: number;
    title?: string;
    description?: string;
  };
}

/**
 * Client to Server message types
 */
export interface ChatMessage {
  type: 'chat_message';
  content: string;
  timestamp: number;
  initialState?: InitialState;
}

/**
 * Server to Client message types
 */
export interface StreamChunk {
  type: 'stream_chunk';
  content: string;
  messageId: string;
  isComplete: boolean;
}

export interface ToolCallMessage {
  type: 'tool_call';
  toolName: string;
  data: unknown;
  callId: string;
  message?: string;
}

export interface ErrorMessage {
  type: 'error';
  content: string;
  code?: string;
}

export type ServerMessage = StreamChunk | ToolCallMessage | ErrorMessage;

/**
 * Conversation history message
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
