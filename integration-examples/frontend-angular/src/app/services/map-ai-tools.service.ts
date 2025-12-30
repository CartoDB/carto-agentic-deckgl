import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { Message, WebSocketMessage, LoaderState } from '../models/message.model';
import { MapToolsService } from './map-tools.service';
import { WebSocketService } from './websocket.service';

/**
 * Consolidated service for AI-powered map tools integration
 * Angular equivalent of React's useMapAITools hook
 *
 * Handles:
 * - WebSocket connection management via WebSocketService
 * - Chat message state and streaming
 * - Tool execution via MapToolsService
 * - Loader state management ('thinking' | 'executing' | null)
 * - Error handling
 */
@Injectable({
  providedIn: 'root',
})
export class MapAIToolsService implements OnDestroy {
  // State observables
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private loaderStateSubject = new BehaviorSubject<LoaderState>(null);
  private errorSubject = new Subject<string>();

  public messages$ = this.messagesSubject.asObservable();
  public loaderState$ = this.loaderStateSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  // Proxy WebSocket connection status
  public get isConnected$() {
    return this.wsService.isConnected$;
  }

  // Internal state
  private streamingMessageIds = new Set<string>();
  private messageIdCounter = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private wsService: WebSocketService,
    private mapToolsService: MapToolsService
  ) {}

  /**
   * Connect to WebSocket server and start listening for messages
   */
  connect(wsUrl: string): void {
    this.wsService.connect(wsUrl);

    // Subscribe to WebSocket messages
    const msgSub = this.wsService.message$.subscribe((data) => this.handleMessage(data));
    this.subscriptions.push(msgSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.wsService.disconnect();
  }

  /**
   * Send a chat message through WebSocket
   * Handles adding user message, resetting streaming state, and setting loader
   *
   * @param content - Message content
   * @returns Whether the message was sent
   */
  sendMessage(content: string): boolean {
    if (!this.wsService.isConnected$.getValue()) {
      console.warn('WebSocket not connected');
      return false;
    }

    // Add user message
    this.addMessage({ type: 'user', content });

    // Reset streaming state
    this.streamingMessageIds.clear();

    // Set loader to thinking
    this.loaderStateSubject.next('thinking');

    // Send through WebSocket
    this.wsService.send({
      type: 'chat_message',
      content,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Clear all messages and reset state
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
    this.streamingMessageIds.clear();
    this.messageIdCounter = 0;
    this.loaderStateSubject.next(null);
  }

  /**
   * Get current loader state value
   */
  getLoaderState(): LoaderState {
    return this.loaderStateSubject.getValue();
  }

  /**
   * Get current messages array
   */
  getMessages(): Message[] {
    return this.messagesSubject.getValue();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'stream_chunk':
        this.handleStreamChunk(data);
        break;
      case 'tool_call':
        this.handleToolCall(data);
        break;
      case 'error':
        this.errorSubject.next(data.content || 'Unknown error');
        this.loaderStateSubject.next(null);
        break;
      case 'welcome':
        console.log('Server welcome:', data.content);
        break;
    }
  }

  private handleStreamChunk(data: WebSocketMessage): void {
    if (!data.messageId) return;

    const isNewMessage = !this.streamingMessageIds.has(data.messageId);

    // First chunk - hide "thinking" loader
    if (isNewMessage) {
      this.loaderStateSubject.next(null);
    }

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      this.updateMessage(data.messageId, { streaming: false });
      this.loaderStateSubject.next('executing');
      return;
    }

    if (isNewMessage) {
      // New message - add to messages array
      this.streamingMessageIds.add(data.messageId);
      this.addMessage({
        type: 'assistant',
        content: data.content || '',
        streaming: true,
        messageId: data.messageId,
      });
    } else {
      // Update existing message (WebSocketService already accumulated content)
      this.updateMessage(data.messageId, {
        content: data.content || '',
        streaming: !data.isComplete,
      });
    }

    if (data.isComplete) {
      this.streamingMessageIds.delete(data.messageId);
      this.loaderStateSubject.next('executing');
    }
  }

  private async handleToolCall(data: WebSocketMessage): Promise<void> {
    if (!this.mapToolsService.isInitialized()) {
      this.errorSubject.next('Map not ready');
      this.loaderStateSubject.next(null);
      return;
    }

    const { toolName, data: toolData, error } = this.mapToolsService.parseResponse(data);

    if (error) {
      this.errorSubject.next(`Error: ${error.message}`);
      this.loaderStateSubject.next(null);
      return;
    }

    console.log(`Executing tool: ${toolName}`, toolData);

    if (toolName && toolData) {
      const result = await this.mapToolsService.execute(toolName, toolData);
      this.addMessage({
        type: 'action',
        content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`,
      });
    } else {
      this.errorSubject.next(`Unknown tool: ${toolName}`);
    }

    this.loaderStateSubject.next(null);
  }

  private generateMessageId(): string {
    return `local_${Date.now()}_${this.messageIdCounter++}`;
  }

  private addMessage(msg: Partial<Message>): void {
    const messages = this.messagesSubject.getValue();
    const newMessage: Message = {
      id: msg.id || this.generateMessageId(),
      type: msg.type || 'assistant',
      content: msg.content || '',
      streaming: msg.streaming,
      messageId: msg.messageId,
    };
    this.messagesSubject.next([...messages, newMessage]);
  }

  private updateMessage(messageId: string, updates: Partial<Message>): void {
    const messages = this.messagesSubject.getValue();
    const updated = messages.map((msg) =>
      msg.messageId === messageId ? { ...msg, ...updates } : msg
    );
    this.messagesSubject.next(updated);
  }
}
