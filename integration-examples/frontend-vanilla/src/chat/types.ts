/**
 * Message types for client-server communication
 */

// Initial state context for AI
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
    opacity?: number;
    data: string;
  }>;
  cartoConfig: {
    connectionName: string;
    hasCredentials: boolean;
  };
}

// Client -> Server
export interface ChatMessage {
  type: 'chat_message';
  content: string;
  timestamp: number;
  initialState?: InitialState | null; // Optional context about current map state
}

// Server -> Client message types
export interface StreamChunkMessage {
  type: 'stream_chunk';
  messageId: string;
  content: string;
  isComplete: boolean;
}

export interface ToolCallMessage {
  type: 'tool_call';
  tool?: string;
  tool_name?: string;
  toolName?: string; // Server may use camelCase
  parameters?: unknown;
  data?: unknown;
  callId?: string;
  success?: boolean;
  message?: string;
  error?: string;
}

export interface ToolResultMessage {
  type: 'tool_result';
  toolName: string;
  data: unknown;
  message: string;
}

export interface ErrorMessage {
  type: 'error';
  content: string;
  code?: string;
}

export interface WelcomeMessage {
  type: 'welcome';
  message: string;
}

export type ServerMessage =
  | StreamChunkMessage
  | ToolCallMessage
  | ToolResultMessage
  | ErrorMessage
  | WelcomeMessage;

// Callback types
export type MessageHandler = (message: ServerMessage) => void;
export type ConnectionChangeHandler = (connected: boolean) => void;

// Chat client interface
export interface ChatClient {
  connect(): void | Promise<void>;
  disconnect(): void;
  send(message: ChatMessage): void | Promise<void>;
  resetSession?(): void;
}
