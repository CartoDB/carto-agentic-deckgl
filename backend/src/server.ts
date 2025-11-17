// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket/websocket-server';

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  return server;
}
