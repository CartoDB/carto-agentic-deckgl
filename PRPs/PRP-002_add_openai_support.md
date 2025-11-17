# PRP-002: OpenAI Streaming Integration with Tool Calling

**Status:** Ready for Implementation
**Confidence Score:** 7/10
**Estimated Complexity:** High
**Implementation Time:** 10-14 hours
**Dependencies:** PRP-001 (Interactive Map Chat System)

---

## 📋 PROJECT OVERVIEW

### What We're Building

Enhance the existing map chat application with OpenAI ChatGPT integration featuring:
1. **Streaming AI Responses**: Real-time token-by-token text display
2. **Function Calling (Tool Use)**: LLM-driven map control via tools
3. **Natural Language Processing**: Replace rigid command parsing with conversational AI
4. **Conversation History**: Maintain context for multi-turn conversations

### Current System (from PRP-001)

**Backend**: TypeScript + Express + WebSocket
- Simple echo message handler
- No conversation context
- Client-side command parsing

**Frontend**: Vanilla JS + deck.gl
- Local CommandParser for pattern matching
- WebSocket client for real-time communication

### After This Implementation

**Backend**: Enhanced with OpenAI SDK
- Streams OpenAI responses to frontend
- Manages conversation history
- Handles tool calls and forwards to frontend

**Frontend**: Enhanced streaming support
- Displays streaming text token-by-token
- Executes tool calls from AI
- Shows action confirmations

---

## 🔬 TECHNICAL REQUIREMENTS

### OpenAI API Configuration

```typescript
Model: 'gpt-4o' or 'gpt-4-turbo'
Stream: true
Max Tokens: 500
Temperature: 0.7
Tools: [zoom_map, fly_to_location, toggle_layer]
```

###

 Environment Variables

```bash
# backend/.env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
PORT=3000
```

### Tool Definitions

**Tool 1: zoom_map**
```typescript
{
  type: 'function',
  function: {
    name: 'zoom_map',
    description: 'Control the map zoom level',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['in', 'out'],
          description: 'Zoom direction'
        },
        levels: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 1,
          description: 'Number of zoom levels'
        }
      },
      required: ['direction']
    }
  }
}
```

**Tool 2: fly_to_location**
```typescript
{
  type: 'function',
  function: {
    name: 'fly_to_location',
    description: 'Navigate map to a specific location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name (e.g., "New York", "San Francisco")'
        },
        coordinates: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '[longitude, latitude] coordinates'
        },
        zoom: {
          type: 'integer',
          minimum: 0,
          maximum: 20,
          description: 'Optional zoom level'
        }
      }
    }
  }
}
```

**Tool 3: toggle_layer**
```typescript
{
  type: 'function',
  function: {
    name: 'toggle_layer',
    description: 'Show or hide map layers',
    parameters: {
      type: 'object',
      properties: {
        layer_id: {
          type: 'string',
          enum: ['points-layer'],
          description: 'Layer identifier'
        },
        visible: {
          type: 'boolean',
          description: 'true to show, false to hide'
        }
      },
      required: ['layer_id', 'visible']
    }
  }
}
```

### System Prompt

```typescript
const SYSTEM_PROMPT = `You are a helpful AI assistant integrated with an interactive map application showing cities across the United States.

Users can ask you to control the map or ask general questions.

Available map controls:
- Zoom in/out on the map (use zoom_map tool)
- Fly to specific locations by city name or coordinates (use fly_to_location tool)
- Show/hide the points layer displaying US cities (use toggle_layer tool)

Be conversational and helpful. When users want to control the map, use the provided tools.
Always explain what you're doing when executing map commands.

When navigating to cities, use these coordinates:
- New York: [-74.0060, 40.7128]
- Los Angeles: [-118.2437, 34.0522]
- Chicago: [-87.6298, 41.8781]
- San Francisco: [-122.4194, 37.7749]
- Seattle: [-122.3321, 47.6062]
- Miami: [-80.1918, 25.7617]
- Boston: [-71.0589, 42.3601]
- Denver: [-104.9903, 39.7392]`;
```

---

## 📚 RESEARCH FINDINGS & DOCUMENTATION

### Official OpenAI Documentation

**Core APIs:**
- **Chat Completions**: https://platform.openai.com/docs/api-reference/chat/create
- **Streaming**: https://platform.openai.com/docs/api-reference/streaming
- **Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **Node.js SDK**: https://github.com/openai/openai-node
- **npm Package**: https://www.npmjs.com/package/openai

### Key Research Findings

#### OpenAI Streaming with Function Calling

From community discussions and GitHub issues:

**Challenge**: Tool call arguments arrive fragmented across multiple delta chunks
**Solution**: Accumulate deltas by tool call index

```typescript
// Pattern from research
const toolCallsAccumulator = new Map();

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;

  if (delta.tool_calls) {
    for (const tc_delta of delta.tool_calls) {
      if (!toolCallsAccumulator.has(tc_delta.index)) {
        toolCallsAccumulator.set(tc_delta.index, {
          id: tc_delta.id,
          type: tc_delta.type,
          function: { name: '', arguments: '' }
        });
      }

      const accumulated = toolCallsAccumulator.get(tc_delta.index);
      if (tc_delta.function?.name) {
        accumulated.function.name += tc_delta.function.name;
      }
      if (tc_delta.function?.arguments) {
        accumulated.function.arguments += tc_delta.function.arguments;
      }
    }
  }
}
```

#### WebSocket Streaming Patterns

**Server-to-Client Streaming over WebSocket:**
- Send chunks as individual messages
- Include message ID for client-side accumulation
- Signal completion with final chunk flag

**References:**
- https://javascript.info/websocket
- https://dev.to/devland/build-a-real-time-chat-app-using-nodejs-and-websocket-441g

---

## 🏗️ SYSTEM ARCHITECTURE

### Enhanced Message Flow

```
User Input: "Show me San Francisco"
     │
     ▼
Frontend WebSocket Client
     │
     ├─> Send: { type: 'chat_message', content: '...', timestamp: ... }
     │
     ▼
Backend WebSocket Server
     │
     ├─> Receive message
     ├─> Add to conversation history
     ├─> Call OpenAI API (streaming + tools)
     │
     ▼
OpenAI API Response (Stream)
     │
     ├─> Delta Chunk 1: { content: "Sure" }
     ├─> Delta Chunk 2: { content: "! Let me" }
     ├─> Delta Chunk 3: { content: " navigate" }
     ├─> Delta Chunk 4: { tool_calls: [{index: 0, function: {name: "fly_to"}}] }
     ├─> Delta Chunk 5: { tool_calls: [{index: 0, function: {arguments: '{"loc'}}] }
     ├─> Delta Chunk 6: { tool_calls: [{index: 0, function: {arguments: 'ation":"San Francisco"}'}}] }
     │
     ▼
Backend Processing
     │
     ├─> Accumulate text deltas
     ├─> Stream to frontend: { type: 'stream_chunk', content: "Sure! Let me navigate" }
     ├─> Accumulate tool call deltas
     ├─> Parse complete tool call JSON
     ├─> Send to frontend: { type: 'tool_call', tool: 'fly_to_location', parameters: {...} }
     │
     ▼
Frontend Display
     │
     ├─> Update streaming message: "Sure! Let me navigate"
     ├─> Execute tool: mapController.flyTo(-122.4194, 37.7749)
     └─> Show confirmation: "✓ Flew to San Francisco"
```

### New Message Types

**Backend → Frontend:**

```typescript
// Streaming text chunk
interface StreamChunk {
  type: 'stream_chunk';
  content: string;
  messageId: string;
  isComplete: boolean;
}

// Tool execution command
interface ToolCall {
  type: 'tool_call';
  tool: 'zoom_map' | 'fly_to_location' | 'toggle_layer';
  parameters: Record<string, any>;
  callId: string;
}

// Error message
interface ErrorMessage {
  type: 'error';
  content: string;
  code?: string;
}
```

---

## 📂 FILE STRUCTURE & CHANGES

### New Files to Create

```
backend/src/
├── services/
│   ├── openai-service.ts      # OpenAI API integration
│   ├── conversation-manager.ts # Conversation history
│   └── tool-definitions.ts     # Tool schemas
├── types/
│   └── openai-messages.ts      # New message type interfaces
└── .env.example               # Environment template
```

### Files to Modify

```
backend/src/
├── services/
│   └── message-handler.ts     # Replace echo with OpenAI
├── types/
│   └── messages.ts            # Add new message types
└── index.ts                  # Add API key validation

frontend/src/
├── chat/
│   ├── chat-ui.js            # Add streaming message update
│   └── websocket-client.js    # Handle new message types
└── main.js                   # Wire up tool call handling
```

---

## 🛠️ IMPLEMENTATION BLUEPRINT

### Phase 1: Backend OpenAI Service (4-5 hours)

#### Step 1.1: Install Dependencies

```bash
cd backend
npm install openai
npm install -D @types/node
```

#### Step 1.2: Create OpenAI Service

```typescript
// backend/src/services/openai-service.ts
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import { getToolDefinitions } from './tool-definitions';

const SYSTEM_PROMPT = `You are a helpful AI assistant...`;  // (full prompt from above)

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ws: WebSocket
  ): Promise<void> {
    const messageId = `msg_${Date.now()}`;
    const toolCallsAccumulator = new Map<number, any>();

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        stream: true,
        tools: getToolDefinitions(),
        max_tokens: 500,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle text content
        if (delta.content) {
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: delta.content,
            messageId,
            isComplete: false
          }));
        }

        // Handle tool calls (accumulate deltas)
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            if (!toolCallsAccumulator.has(tcDelta.index)) {
              toolCallsAccumulator.set(tcDelta.index, {
                id: tcDelta.id || '',
                type: tcDelta.type || 'function',
                function: { name: '', arguments: '' }
              });
            }

            const acc = toolCallsAccumulator.get(tcDelta.index);
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) {
              acc.function.name += tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {
              acc.function.arguments += tcDelta.function.arguments;
            }
          }
        }

        // Check if stream finished
        if (chunk.choices[0]?.finish_reason) {
          // Send completion signal
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: '',
            messageId,
            isComplete: true
          }));

          // Process accumulated tool calls
          if (toolCallsAccumulator.size > 0) {
            for (const [index, toolCall] of toolCallsAccumulator.entries()) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                ws.send(JSON.stringify({
                  type: 'tool_call',
                  tool: toolCall.function.name,
                  parameters: args,
                  callId: toolCall.id
                }));
              } catch (error) {
                console.error('[OpenAI] Error parsing tool call arguments:', error);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[OpenAI] Stream error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        content: this.getErrorMessage(error),
        code: error.code
      }));
    }
  }

  private getErrorMessage(error: any): string {
    if (error.status === 429) {
      return "I'm receiving too many requests. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "Authentication error. Please check API configuration.";
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return "Connection timeout. Please try again.";
    }
    return "I'm having trouble processing your request. Please try again.";
  }
}
```

#### Step 1.3: Create Tool Definitions

```typescript
// backend/src/services/tool-definitions.ts
import { OpenAI } from 'openai';

export function getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'zoom_map',
        description: 'Control the map zoom level. Use this when the user wants to zoom in or out.',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['in', 'out'],
              description: 'Zoom direction: "in" to zoom in, "out" to zoom out'
            },
            levels: {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              default: 1,
              description: 'Number of zoom levels to change (default: 1)'
            }
          },
          required: ['direction']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'fly_to_location',
        description: 'Navigate the map to a specific location. Can use city name or coordinates.',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name like "New York", "San Francisco", "Chicago", etc.'
            },
            coordinates: {
              type: 'array',
              items: { type: 'number' },
              minItems: 2,
              maxItems: 2,
              description: 'Optional [longitude, latitude] coordinates. Remember: longitude first, then latitude.'
            },
            zoom: {
              type: 'integer',
              minimum: 0,
              maximum: 20,
              description: 'Optional zoom level (0-20)'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'toggle_layer',
        description: 'Show or hide map layers. Currently supports the points layer showing US cities.',
        parameters: {
          type: 'object',
          properties: {
            layer_id: {
              type: 'string',
              enum: ['points-layer'],
              description: 'The layer identifier. Use "points-layer" for the US cities layer.'
            },
            visible: {
              type: 'boolean',
              description: 'true to show the layer, false to hide it'
            }
          },
          required: ['layer_id', 'visible']
        }
      }
    }
  ];
}
```

#### Step 1.4: Create Conversation Manager

```typescript
// backend/src/services/conversation-manager.ts
import { OpenAI } from 'openai';

export class ConversationManager {
  private conversations = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();
  private maxHistoryLength = 10; // Keep last 10 messages

  getConversation(sessionId: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    return this.conversations.get(sessionId)!;
  }

  addMessage(sessionId: string, message: OpenAI.Chat.ChatCompletionMessageParam): void {
    const conversation = this.getConversation(sessionId);
    conversation.push(message);

    // Prune old messages (keep system prompt + last N messages)
    if (conversation.length > this.maxHistoryLength) {
      // Keep first message if it's system prompt
      const hasSystemPrompt = conversation[0]?.role === 'system';
      const start = hasSystemPrompt ? 1 : 0;
      const keep = conversation.length - this.maxHistoryLength + (hasSystemPrompt ? 1 : 0);

      this.conversations.set(sessionId, [
        ...(hasSystemPrompt ? [conversation[0]] : []),
        ...conversation.slice(keep)
      ]);
    }
  }

  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }
}
```

#### Step 1.5: Update Message Handler

```typescript
// backend/src/services/message-handler.ts
import { WebSocket } from 'ws';
import { ClientMessage } from '../types/messages';
import { OpenAIService } from './openai-service';
import { ConversationManager } from './conversation-manager';

const openaiService = new OpenAIService();
const conversationManager = new ConversationManager();

export async function handleMessage(ws: WebSocket, message: ClientMessage, sessionId: string): Promise<void> {
  console.log('[Message] Received:', message);

  try {
    // Add user message to conversation history
    conversationManager.addMessage(sessionId, {
      role: 'user',
      content: message.content
    });

    // Get conversation history
    const messages = conversationManager.getConversation(sessionId);

    // Stream response from OpenAI
    await openaiService.streamChatCompletion(messages, ws);

  } catch (error) {
    console.error('[Message] Error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      content: 'Failed to process message',
      timestamp: Date.now()
    }));
  }
}
```

#### Step 1.6: Update WebSocket Server

```typescript
// backend/src/websocket/websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { handleMessage } from '../services/message-handler';
import { randomUUID } from 'crypto';

const sessions = new Map<WebSocket, string>();

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const sessionId = randomUUID();
    sessions.set(ws, sessionId);

    console.log(`[WebSocket] New connection from ${request.socket.remoteAddress} (session: ${sessionId})`);

    ws.send(JSON.stringify({
      type: 'stream_chunk',
      content: 'Connected to AI-powered map assistant',
      messageId: `welcome_${Date.now()}`,
      isComplete: true
    }));

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        const sessionId = sessions.get(ws);
        if (sessionId) {
          await handleMessage(ws, message, sessionId);
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Invalid message format',
          timestamp: Date.now()
        }));
      }
    });

    ws.on('close', () => {
      sessions.delete(ws);
      console.log('[WebSocket] Connection closed');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });

  return wss;
}
```

#### Step 1.7: Update Type Definitions

```typescript
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
```

#### Step 1.8: Add API Key Validation

```typescript
// backend/src/index.ts
import dotenv from 'dotenv';
import { createServer } from './server';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please create a .env file with the required variables.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = createServer();

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`=================================`);
});
```

### Phase 2: Frontend Streaming Support (3-4 hours)

#### Step 2.1: Update Chat UI for Streaming

```javascript
// frontend/src/chat/chat-ui.js
export class ChatUI {
  constructor(messagesContainer, inputElement, sendButton, statusIndicator) {
    this.messagesContainer = messagesContainer;
    this.inputElement = inputElement;
    this.sendButton = sendButton;
    this.statusIndicator = statusIndicator;
    this.streamingMessages = new Map(); // Track streaming messages
  }

  addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    messageDiv.textContent = content;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return messageDiv;
  }

  // NEW: Handle streaming message updates
  updateStreamingMessage(messageId, content, isComplete = false) {
    let messageDiv = this.streamingMessages.get(messageId);

    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.className = 'message bot streaming';
      messageDiv.dataset.messageId = messageId;
      this.messagesContainer.appendChild(messageDiv);
      this.streamingMessages.set(messageId, messageDiv);
    }

    messageDiv.textContent = content;

    if (isComplete) {
      messageDiv.classList.remove('streaming');
      this.streamingMessages.delete(messageId);
    }

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  // NEW: Add action confirmation message
  addActionMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message action';
    messageDiv.textContent = `✓ ${content}`;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  clearInput() {
    this.inputElement.value = '';
  }

  setConnectionStatus(connected) {
    this.statusIndicator.className = connected ? 'connected' : 'disconnected';
    this.sendButton.disabled = !connected;
  }

  onSendMessage(callback) {
    const sendMessage = () => {
      const content = this.inputElement.value.trim();
      if (content) {
        callback(content);
        this.clearInput();
      }
    };

    this.sendButton.addEventListener('click', sendMessage);
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
}
```

#### Step 2.2: Update WebSocket Client

```javascript
// frontend/src/chat/websocket-client.js
export class WebSocketClient {
  constructor(url, onMessage, onConnectionChange) {
    this.url = url;
    this.ws = null;
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.messageBuffer = new Map(); // NEW: Buffer for accumulating streaming messages
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // NEW: Handle different message types
          if (data.type === 'stream_chunk') {
            this.handleStreamChunk(data);
          } else if (data.type === 'tool_call') {
            this.handleToolCall(data);
          } else if (data.type === 'error') {
            this.handleError(data);
          } else {
            // Fallback for old message format
            this.onMessage(data);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.onConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.onConnectionChange(false);
    }
  }

  // NEW: Handle streaming chunks
  handleStreamChunk(data) {
    if (!this.messageBuffer.has(data.messageId)) {
      this.messageBuffer.set(data.messageId, '');
    }

    this.messageBuffer.set(data.messageId, this.messageBuffer.get(data.messageId) + data.content);

    this.onMessage({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: this.messageBuffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      this.messageBuffer.delete(data.messageId);
    }
  }

  // NEW: Handle tool calls
  handleToolCall(data) {
    this.onMessage({
      type: 'tool_call',
      tool: data.tool,
      parameters: data.parameters,
      callId: data.callId
    });
  }

  // NEW: Handle errors
  handleError(data) {
    this.onMessage({
      type: 'error',
      content: data.content,
      code: data.code
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Cannot send message - not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

#### Step 2.3: Create Tool Executor

```javascript
// frontend/src/commands/tool-executor.js
export class ToolExecutor {
  constructor(mapController, cityCoordinates) {
    this.mapController = mapController;
    this.cities = cityCoordinates;
  }

  execute(toolName, parameters) {
    console.log(`[ToolExecutor] Executing ${toolName} with`, parameters);

    switch (toolName) {
      case 'zoom_map':
        return this.executeZoom(parameters);

      case 'fly_to_location':
        return this.executeFlyTo(parameters);

      case 'toggle_layer':
        return this.executeToggleLayer(parameters);

      default:
        console.warn(`[ToolExecutor] Unknown tool: ${toolName}`);
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  }

  executeZoom(params) {
    const { direction, levels = 1 } = params;

    if (direction === 'in') {
      this.mapController.zoomIn(levels);
      return { success: true, message: `Zoomed in by ${levels} level(s)` };
    } else if (direction === 'out') {
      this.mapController.zoomOut(levels);
      return { success: true, message: `Zoomed out by ${levels} level(s)` };
    }

    return { success: false, message: 'Invalid zoom direction' };
  }

  executeFlyTo(params) {
    const { location, coordinates, zoom } = params;

    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      const [lon, lat] = coordinates;
      this.mapController.flyTo(lon, lat, zoom);
      return { success: true, message: `Flew to coordinates [${lon.toFixed(2)}, ${lat.toFixed(2)}]` };
    }

    if (location) {
      const lowerLocation = location.toLowerCase();
      const coords = this.cities[lowerLocation];

      if (coords) {
        this.mapController.flyTo(coords[0], coords[1], zoom);
        return { success: true, message: `Flew to ${location}` };
      }

      return { success: false, message: `Location "${location}" not found` };
    }

    return { success: false, message: 'No location or coordinates provided' };
  }

  executeToggleLayer(params) {
    const { layer_id, visible } = params;

    if (layer_id === 'points-layer') {
      this.mapController.toggleLayer(layer_id);
      return {
        success: true,
        message: visible ? 'Showed points layer' : 'Hid points layer'
      };
    }

    return { success: false, message: `Unknown layer: ${layer_id}` };
  }
}
```

#### Step 2.4: Update Main Entry Point

```javascript
// frontend/src/main.js
import './styles/main.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import { createMap, createPointsLayer } from './map/deckgl-map.js';
import { MapController } from './map/map-controller.js';
import { WebSocketClient } from './chat/websocket-client.js';
import { ChatUI } from './chat/chat-ui.js';
import { ToolExecutor } from './commands/tool-executor.js';  // NEW

// Configuration
const WS_URL = 'ws://localhost:3000/ws';
const GEOJSON_PATH = '/data/us-points.geojson';

// City coordinates (matching backend)
const CITY_COORDINATES = {
  'new york': [-74.0060, 40.7128],
  'los angeles': [-118.2437, 34.0522],
  'chicago': [-87.6298, 41.8781],
  'san francisco': [-122.4194, 37.7749],
  'seattle': [-122.3321, 47.6062],
  'miami': [-80.1918, 25.7617],
  'boston': [-71.0589, 42.3601],
  'denver': [-104.9903, 39.7392]
};

// Initialize map
const { deck, map, initialViewState } = createMap('map', 'deck-canvas');

// Load GeoJSON data and add points layer
fetch(GEOJSON_PATH)
  .then(response => response.json())
  .then(data => {
    const pointsLayer = createPointsLayer(data);
    deck.setProps({ layers: [pointsLayer] });
    console.log('✓ Points layer loaded');
  })
  .catch(error => {
    console.error('Error loading GeoJSON:', error);
  });

// Initialize map controller
const mapController = new MapController(deck, initialViewState);

// NEW: Initialize tool executor
const toolExecutor = new ToolExecutor(mapController, CITY_COORDINATES);

// Initialize chat UI
const chatUI = new ChatUI(
  document.getElementById('chat-messages'),
  document.getElementById('chat-input'),
  document.getElementById('send-button'),
  document.getElementById('connection-status')
);

// Initialize WebSocket client with NEW message handlers
const wsClient = new WebSocketClient(
  WS_URL,
  (data) => {
    // Handle different message types
    if (data.type === 'stream_chunk') {
      // Update streaming message
      chatUI.updateStreamingMessage(data.messageId, data.content, data.isComplete);
    }
    else if (data.type === 'tool_call') {
      // Execute tool call
      const result = toolExecutor.execute(data.tool, data.parameters);
      if (result.success) {
        chatUI.addActionMessage(result.message);
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    }
    else if (data.type === 'error') {
      // Display error
      chatUI.addMessage(`Error: ${data.content}`, false);
    }
  },
  (connected) => {
    chatUI.setConnectionStatus(connected);
    if (!connected) {
      chatUI.addMessage('Disconnected from server', false);
    }
  }
);

// Handle sending messages
chatUI.onSendMessage((content) => {
  chatUI.addMessage(content, true);
  wsClient.send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
});

// Connect to WebSocket
wsClient.connect();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  wsClient.disconnect();
});

console.log('✓ Application initialized with AI support');
```

#### Step 2.5: Update CSS for Streaming

```css
/* frontend/src/styles/main.css - ADD THESE STYLES */

/* Streaming message animation */
.message.streaming {
  position: relative;
}

.message.streaming::after {
  content: '▋';
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* Action confirmation messages */
.message.action {
  background: #10b981;
  color: white;
  align-self: flex-start;
  font-size: 13px;
  padding: 8px 12px;
}

/* Error messages */
.message.error {
  background: #ef4444;
  color: white;
  align-self: flex-start;
}
```

### Phase 3: Environment & Configuration (1 hour)

#### Step 3.1: Create Environment Files

```bash
# backend/.env.example
OPENAI_API_KEY=sk-proj-your-api-key-here
OPENAI_MODEL=gpt-4o
PORT=3000
```

```bash
# backend/.env (create this manually, don't commit)
OPENAI_API_KEY=sk-proj-actual-key
OPENAI_MODEL=gpt-4o
PORT=3000
```

#### Step 3.2: Update .gitignore

```bash
# Add to backend/.gitignore
.env
.env.local
```

### Phase 4: Testing & Validation (2-3 hours)

#### Step 4.1: Backend Unit Tests (Optional but Recommended)

```typescript
// backend/src/__tests__/tool-definitions.test.ts
import { getToolDefinitions } from '../services/tool-definitions';

describe('Tool Definitions', () => {
  it('should return three tools', () => {
    const tools = getToolDefinitions();
    expect(tools).toHaveLength(3);
  });

  it('should have correct tool names', () => {
    const tools = getToolDefinitions();
    const names = tools.map(t => t.function.name);
    expect(names).toContain('zoom_map');
    expect(names).toContain('fly_to_location');
    expect(names).toContain('toggle_layer');
  });
});
```

---

## ✅ VALIDATION GATES

### Backend Validation

```bash
# Navigate to backend
cd backend

# TypeScript compilation
npx tsc --noEmit
# Expected: No errors

# Check environment variables
cat .env | grep OPENAI_API_KEY
# Expected: sk-proj-...

# Start server
npm run dev
# Expected: Server starts, shows OpenAI model in logs

# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":...}
```

### Frontend Validation

```bash
# Navigate to frontend
cd frontend

# Start dev server
npm run dev
# Expected: Vite dev server starts

# Open browser to http://localhost:5173
# Expected: Map loads, chat interface ready
```

### Integration Testing

**Manual Test Checklist:**

1. **Basic Streaming**
   - [ ] Send "Hello" → Receive streaming response
   - [ ] Tokens appear progressively (not all at once)
   - [ ] No errors in console

2. **Tool Execution - Zoom**
   - [ ] Send "zoom in" → Map zooms in, see "✓ Zoomed in" message
   - [ ] Send "zoom out 3" → Map zooms out 3 levels
   - [ ] Tool confirmation appears in chat

3. **Tool Execution - Navigation**
   - [ ] Send "show me San Francisco" → Map flies to SF
   - [ ] Send "fly to New York" → Map flies to NYC
   - [ ] Send "go to coordinates -122, 37" → Map flies to coords
   - [ ] Each shows "✓ Flew to..." confirmation

4. **Tool Execution - Layer Toggle**
   - [ ] Send "hide the points" → Points disappear
   - [ ] Send "show the cities" → Points reappear
   - [ ] Confirmation messages appear

5. **Combined Requests**
   - [ ] Send "show me Boston and zoom in" → Flies to Boston AND zooms
   - [ ] Both actions execute
   - [ ] Both confirmations appear

6. **Conversational Context**
   - [ ] Send "show me Chicago" → AI responds + flies
   - [ ] Send "zoom in a bit" → AI understands context, zooms
   - [ ] Send "what city am I looking at?" → AI references Chicago

7. **Error Handling**
   - [ ] Send message with invalid API key → See error message
   - [ ] Disconnect WiFi → See "Disconnected" message
   - [ ] Reconnect → Auto-reconnects and works

8. **Performance**
   - [ ] First token latency < 2 seconds
   - [ ] Streaming feels smooth
   - [ ] No UI lag during streaming

---

## ⚠️ GOTCHAS & COMMON PITFALLS

### Critical Issues to Avoid

1. **Tool Call Delta Accumulation**
   - ❌ WRONG: Process each delta immediately
   - ✅ CORRECT: Accumulate by index, parse when complete
   - Tool call arguments split across chunks - MUST buffer!

2. **Async Handler in WebSocket**
   - ❌ WRONG: `ws.on('message', (data) => { await handleMessage(...) })`
   - ✅ CORRECT: `ws.on('message', async (data) => { await handleMessage(...) })`
   - Missing async breaks streaming

3. **JSON Parsing Tool Arguments**
   - ❌ WRONG: `eval(toolCall.function.arguments)`
   - ✅ CORRECT: `JSON.parse(toolCall.function.arguments)`
   - Arguments come as JSON string, must parse

4. **Coordinate Order**
   - ❌ WRONG: `[latitude, longitude]`
   - ✅ CORRECT: `[longitude, latitude]`
   - GeoJSON standard - same as PRP-001

5. **API Key in Logs**
   - ❌ WRONG: `console.log(process.env.OPENAI_API_KEY)`
   - ✅ CORRECT: Never log API keys
   - Even in debug mode!

6. **Stream Completion Detection**
   - ❌ WRONG: Assume last chunk is complete
   - ✅ CORRECT: Check `finish_reason` field
   - Must explicitly signal completion

7. **Frontend Message Buffer Cleanup**
   - ❌ WRONG: Never clear messageBuffer Map
   - ✅ CORRECT: Delete entry when `isComplete: true`
   - Memory leak if not cleaned

8. **Session Management**
   - ❌ WRONG: Single global conversation history
   - ✅ CORRECT: Per-session conversation with UUID
   - Multiple users share history otherwise

9. **Tool Parameter Validation**
   - ❌ WRONG: Trust all tool parameters from AI
   - ✅ CORRECT: Validate zoom levels, coordinates, layer IDs
   - AI can generate invalid values

10. **Conversation History Growth**
    - ❌ WRONG: Unlimited history accumulation
    - ✅ CORRECT: Prune to last 10 messages
    - Token costs explode quickly

### Performance Considerations

- **First Token Latency**: Expect 500-1500ms
- **Streaming Rate**: ~20-50 tokens/second
- **Token Costs**: Monitor with OpenAI dashboard
- **Memory**: Conversation history per session
- **Network**: WebSocket keepalive for long sessions

### Security Considerations

- **API Key**: Backend only, never frontend
- **Rate Limiting**: Implement per-session limits
- **Input Validation**: Sanitize before OpenAI
- **Tool Validation**: Verify tool parameters
- **Error Messages**: Don't expose internal details

---

## 📝 IMPLEMENTATION TASK LIST

Execute in this exact order:

### Phase A: Backend Setup (2-3 hours)
- [ ] Install openai npm package
- [ ] Create .env file with OPENAI_API_KEY
- [ ] Add API key validation in index.ts
- [ ] Create openai-service.ts with streaming
- [ ] Create tool-definitions.ts with 3 tools
- [ ] Create conversation-manager.ts
- [ ] Update message-handler.ts to use OpenAI
- [ ] Update websocket-server.ts for sessions
- [ ] Create new type definitions
- [ ] Test backend: verify no TypeScript errors

### Phase B: Backend Testing (1 hour)
- [ ] Start backend server
- [ ] Test health endpoint
- [ ] Test WebSocket connection
- [ ] Use WebSocket test tool to send message
- [ ] Verify streaming chunks received
- [ ] Verify tool calls received
- [ ] Check console logs for errors

### Phase C: Frontend Streaming (2-3 hours)
- [ ] Update ChatUI with streaming methods
- [ ] Update WebSocketClient with message handlers
- [ ] Create ToolExecutor class
- [ ] Update main.js to wire everything
- [ ] Add streaming CSS animations
- [ ] Add action message styles

### Phase D: Integration Testing (2-3 hours)
- [ ] Test basic streaming conversation
- [ ] Test each tool individually (zoom, fly, toggle)
- [ ] Test combined tool calls
- [ ] Test conversational context
- [ ] Test error scenarios
- [ ] Test reconnection logic
- [ ] Performance testing (latency, smoothness)

### Phase E: Polish & Documentation (1-2 hours)
- [ ] Add inline code comments
- [ ] Create .env.example files
- [ ] Update README with OpenAI setup
- [ ] Document available commands
- [ ] Add troubleshooting section
- [ ] Test end-to-end one more time

---

## 🎯 CONFIDENCE SCORE: 7/10

### Why 7/10?

**Strengths (+):**
- Clear implementation path with code examples
- Well-researched OpenAI streaming patterns
- Existing WebSocket infrastructure (from PRP-001)
- Detailed gotchas documented
- Good error handling strategy

**Risk Areas (-):**
- Complex delta accumulation logic for tool calls
- First-time OpenAI streaming integration
- Conversation history management complexity
- Multiple async operations (OpenAI + WebSocket)
- Edge cases in tool call parsing

### Success Probability

- **Phase A (Backend Setup)**: 85% - Well-documented patterns
- **Phase B (Streaming Logic)**: 70% - Delta accumulation is tricky
- **Phase C (Frontend)**: 90% - Building on existing UI
- **Phase D (Integration)**: 75% - Many moving parts
- **Overall one-pass success**: 70% - High complexity but good prep

### Recommendations for Success

1. **Test backend streaming independently first** - Use curl or Postman
2. **Implement delta accumulation carefully** - Follow the exact pattern
3. **Add extensive logging** - Track each chunk and tool call
4. **Start with text-only streaming** - Add tool calls second
5. **Test with simple prompts** - "Hello" before complex requests
6. **Monitor OpenAI dashboard** - Watch costs and rate limits
7. **Keep API key safe** - Never commit .env file

---

## 📚 ADDITIONAL RESOURCES

### Official Documentation
- OpenAI API: https://platform.openai.com/docs
- OpenAI Node SDK: https://github.com/openai/openai-node
- Function Calling: https://platform.openai.com/docs/guides/function-calling
- Streaming: https://platform.openai.com/docs/api-reference/streaming

### Community Resources
- OpenAI Community: https://community.openai.com
- Function Calling with Streaming: https://community.openai.com/t/help-for-function-calls-with-streaming/627170
- Delta Accumulation Pattern: https://github.com/openai/openai-node/issues/507

### Cost Management
- OpenAI Pricing: https://openai.com/pricing
- Token Counter: https://platform.openai.com/tokenizer
- Usage Dashboard: https://platform.openai.com/usage

---

**END OF PRP-002**

*Dependencies:* PRP-001 (Interactive Map Chat System)
*Next Steps:* After completion, consider PRP-003 (Persistent Conversation History)

*Last Updated: 2025-11-06*
*Document Version: 1.0*
