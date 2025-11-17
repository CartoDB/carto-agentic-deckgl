export interface Message {
  type: 'user' | 'bot' | 'action';
  content: string;
  streaming?: boolean;
  messageId?: string;
}

export interface WebSocketMessage {
  type: 'chat_message' | 'stream_chunk' | 'tool_call' | 'error';
  content?: string;
  messageId?: string;
  isComplete?: boolean;
  tool?: string;
  parameters?: any;
  timestamp?: number;
}
