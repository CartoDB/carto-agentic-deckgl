// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket/websocket-server.js';
import { vercelChatRouter } from './routes/vercel-chat.js';
import { liteLLMChatRouter } from './routes/litellm-chat.js';
import { openAIChatRouter } from './routes/openai-chat.js';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Vercel Chat routes
  app.use('/api/vercel-chat', vercelChatRouter);

  // LiteLLM Chat routes
  app.use('/api/litellm-chat', liteLLMChatRouter);

  // OpenAI Chat routes (using Responses API)
  app.use('/api/openai-chat', openAIChatRouter);

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  return server;
}
