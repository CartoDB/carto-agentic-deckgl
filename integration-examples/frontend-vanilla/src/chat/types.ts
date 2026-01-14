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
    data?: string;
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

// Server -> Client: Agent is starting to call a tool (before result)
export interface ToolCallStartMessage {
  type: 'tool_call_start';
  toolName: string;
  input: unknown;
  callId: string;
}

// Server -> Client: MCP tool completed on backend
export interface McpToolResultMessage {
  type: 'mcp_tool_result';
  toolName: string;
  result: unknown;
  callId: string;
}

// Server -> Client: Tool result notification (MCP tools)
export interface ToolResultMessage {
  type: 'tool_result';
  toolName: string;
  data: unknown;
  message: string;
}

// Client -> Server: Frontend tool execution result
export interface FrontendToolResultMessage {
  type: 'tool_result';
  toolName: string;
  callId: string;
  success: boolean;
  message: string;
  error?: string;
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
  | ToolCallStartMessage
  | McpToolResultMessage
  | ToolResultMessage
  | ErrorMessage
  | WelcomeMessage;

// Callback types
export type MessageHandler = (message: ServerMessage) => void;
export type ConnectionChangeHandler = (connected: boolean) => void;

// All client -> server message types
export type ClientMessage = ChatMessage | FrontendToolResultMessage;

// Chat client interface
export interface ChatClient {
  connect(): void | Promise<void>;
  disconnect(): void;
  send(message: ClientMessage): void | Promise<void>;
  sendToolResult?(result: FrontendToolResultMessage): void;
  resetSession?(): void;
}
