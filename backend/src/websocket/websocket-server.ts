// backend/src/websocket/websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { handleMessage } from '../services/message-handler.js';
import { randomUUID } from 'crypto';

const sessions = new Map<WebSocket, string>();

export function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const sessionId = randomUUID();
    sessions.set(ws, sessionId);

    console.log(`[WebSocket] New connection from ${request.socket.remoteAddress} (session: ${sessionId})`);

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
