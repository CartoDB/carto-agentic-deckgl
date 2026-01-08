/**
 * Express + WebSocket Server
 *
 * Provides both WebSocket (/ws) and HTTP (/api/chat) endpoints
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { runMapAgent } from './services/agent-runner.js';
import { runMapAgentHTTP } from './services/agent-runner-http.js';
import { ConversationManager } from './services/conversation-manager.js';
import type { ChatMessage } from './types/messages.js';

const app = express();
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
  console.log(`[WS] New connection: ${sessionId}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as ChatMessage;
      const sid = sessions.get(ws);

      if (sid && message.type === 'chat_message') {
        const history = conversationManager.getHistory(sid);
        conversationManager.addMessage(sid, {
          role: 'user',
          content: message.content,
        });

        const response = await runMapAgent(
          message.content,
          ws,
          sid,
          history,
          message.initialState
        );

        if (response) {
          conversationManager.addMessage(sid, response);
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

  ws.on('close', () => {
    const sid = sessions.get(ws);
    if (sid) {
      conversationManager.clearHistory(sid);
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
    await runMapAgentHTTP(message, res, initialState);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const err = error as Error;
    res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
    res.end();
  }
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sdk: 'openai-agents',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    activeSessions: conversationManager.getActiveSessionCount(),
  });
});

// Start server
export function startServer(port: number = 3001): void {
  server.listen(port, () => {
    console.log(`[Server] OpenAI Agents backend running on port ${port}`);
    console.log(`  WebSocket: ws://localhost:${port}/ws`);
    console.log(`  HTTP API:  http://localhost:${port}/api/chat`);
    console.log(`  Health:    http://localhost:${port}/health`);
  });
}

export { server, app };
