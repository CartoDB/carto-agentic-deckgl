import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { WebSocketMessage } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageBuffer = new Map<string, string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  public isConnected$ = new BehaviorSubject<boolean>(false);
  public message$ = new Subject<WebSocketMessage>();

  constructor() {}

  connect(url: string): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.isConnected$.next(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;

          if (data.type === 'stream_chunk') {
            this.handleStreamChunk(data);
          } else {
            this.message$.next(data);
          }
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.isConnected$.next(false);
        this.attemptReconnect(url);
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.isConnected$.next(false);
    }
  }

  private handleStreamChunk(data: WebSocketMessage): void {
    if (!data.messageId) return;

    if (!this.messageBuffer.has(data.messageId)) {
      this.messageBuffer.set(data.messageId, '');
    }

    const currentContent = this.messageBuffer.get(data.messageId) || '';
    this.messageBuffer.set(data.messageId, currentContent + (data.content || ''));

    this.message$.next({
      type: 'stream_chunk',
      messageId: data.messageId,
      content: this.messageBuffer.get(data.messageId),
      isComplete: data.isComplete
    });

    if (data.isComplete) {
      this.messageBuffer.delete(data.messageId);
    }
  }

  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(url), delay);
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[WebSocket] Not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
