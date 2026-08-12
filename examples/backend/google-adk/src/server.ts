/**
 * Express + WebSocket Server for Google ADK
 *
 * Provides both WebSocket (/ws) and HTTP (/api/chat) endpoints.
 * Speaks the same protocol as the other backends so the
 * Angular frontend works with any backend without changes.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { runMapAgent } from './services/agent-runner.js';
import { ConversationManager } from './services/conversation-manager.js';
import { loadSemanticModel, getWelcomeMessage, getWelcomeChips } from './semantic/index.js';
import { getModelName } from './agent/providers.js';
import type { ChatMessage, ToolResultMessage } from './types/messages.js';
import type { Express } from 'express';

const app: Express = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const conversationManager = new ConversationManager();

// ============================================
// WebSocket Handler
// ============================================
const sessions = new Map<WebSocket, string>();

wss.on('connection', (ws) => {
  const sessionId = randomUUID();
  sessions.set(ws, sessionId);
  // Per-connection serialization chain. Without this, a `tool_result`
  // message arriving while `runMapAgent` is still iterating events on the
  // shared ADK session would call `appendEvent` concurrently with the
  // runner — `InMemorySessionService` is not concurrency-safe.
  let messageChain: Promise<void> = Promise.resolve();
  console.log(`[WS] New connection: ${sessionId}`);

  ws.on('message', (data) => {
    messageChain = messageChain.then(async () => {
      try {
        const rawMessage = JSON.parse(data.toString()) as { type: string };
        const sid = sessions.get(ws);

        if (!sid) {
          console.error('[WS] No session ID found for connection');
          return;
        }

        if (rawMessage.type === 'chat_message') {
          const message = rawMessage as ChatMessage;
          const adkSessionId = await conversationManager.getOrCreateAdkSession(sid);

          await runMapAgent(
            message.content,
            ws,
            sid,
            (agent) => conversationManager.createRunner(agent),
            adkSessionId,
            message.initialState,
            (content) => conversationManager.appendContextNote(sid, content),
          );
        } else if (rawMessage.type === 'tool_result') {
          // Handle tool execution results from frontend
          const toolResult = rawMessage as ToolResultMessage;
          console.log(`[WS] Tool result received: ${toolResult.toolName} - ${toolResult.success ? 'success' : 'failed'}`);

          if (toolResult.success) {
            // Tool succeeded - add to conversation history so AI knows what exists
            let historyContent = `[Tool executed successfully: ${toolResult.toolName}] ${toolResult.message}`;

            // Include layer state in history for AI context across turns
            if (toolResult.layerState && toolResult.layerState.length > 0) {
              historyContent += `\n[Current layers on map: ${toolResult.layerState.map(l => `"${l.id}" (${l.type})`).join(', ')}]`;
            } else if (toolResult.layerState) {
              historyContent += `\n[No layers currently on map]`;
            }

            await conversationManager.appendContextNote(sid, historyContent);
          } else {
            // Tool failed - send a correction message to inform the user
            const correctionMessage = `I apologize, but the ${toolResult.toolName} operation failed: ${toolResult.error || toolResult.message}`;

            // Add the failure to conversation history for context
            await conversationManager.appendContextNote(
              sid,
              `[Tool execution failed: ${toolResult.toolName}] ${toolResult.error || toolResult.message}`,
            );

            // Send correction as a stream chunk to the client
            const correctionId = `correction_${Date.now()}`;
            ws.send(
              JSON.stringify({
                type: 'stream_chunk',
                content: correctionMessage,
                messageId: correctionId,
                isComplete: false,
              })
            );
            ws.send(
              JSON.stringify({
                type: 'stream_chunk',
                content: '',
                messageId: correctionId,
                isComplete: true,
              })
            );
          }
        }
      } catch (error) {
        console.error('[WS] Error:', error);
        ws.send(
          JSON.stringify({
            type: 'error',
            content: 'Invalid message format',
          })
        );
      }
    });
  });

  ws.on('close', () => {
    const sid = sessions.get(ws);
    if (sid) {
      // Chain through messageChain so cleanup waits for any in-flight
      // runner; deleting the ADK session while runMapAgent is still
      // iterating events would race with appendEvent.
      messageChain = messageChain.then(() =>
        conversationManager.clearSession(sid).catch((err) => {
          console.error('[WS] Failed to clear ADK session:', err);
        }),
      );
    }
    sessions.delete(ws);
    console.log('[WS] Connection closed');
  });

  ws.on('error', (error) => {
    console.error('[WS] WebSocket error:', error);
  });
});

// ============================================
// HTTP/SSE Route
// ============================================
app.post('/api/chat', async (req, res) => {
  const { message, initialState } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Create a mock WebSocket-like interface for SSE
    const sseWriter = {
      send: (data: string) => {
        res.write(`data: ${data}\n\n`);
      },
    } as WebSocket;

    // HTTP is single-shot: each request gets a fresh ADK session that's
    // cleared in `finally`. No multi-turn memory and no `appendContextNote`
    // callback — those are WS-only by design, since the HTTP endpoint has
    // no client identity that persists between requests.
    const httpSid = `http_${randomUUID()}`;
    const adkSessionId = await conversationManager.getOrCreateAdkSession(httpSid);
    try {
      await runMapAgent(
        message,
        sseWriter,
        httpSid,
        (agent) => conversationManager.createRunner(agent),
        adkSessionId,
        initialState,
      );
    } finally {
      await conversationManager.clearSession(httpSid).catch((err) =>
        console.error('[HTTP] Failed to clear ADK session:', err),
      );
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const err = error as Error;
    res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
    res.end();
  }
});

// Semantic config endpoint — provides welcome message and chips to the frontend
app.get('/api/semantic-config', (_req, res) => {
  const model = loadSemanticModel();
  if (!model) {
    res.json({ welcomeMessage: '', welcomeChips: [] });
    return;
  }
  res.json({
    welcomeMessage: getWelcomeMessage(model),
    welcomeChips: getWelcomeChips(model),
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sdk: 'google-adk',
    provider: 'carto',
    model: getModelName(),
    activeSessions: conversationManager.getActiveSessionCount(),
  });
});

// Start server
export function startServer(port: number = 3003): void {
  server.listen(port, () => {
    console.log(`[Server] Google ADK backend running on port ${port}`);
    console.log(`  WebSocket: ws://localhost:${port}/ws`);
    console.log(`  HTTP API:  http://localhost:${port}/api/chat`);
    console.log(`  Health:    http://localhost:${port}/health`);
  });
}

export { server, app };
