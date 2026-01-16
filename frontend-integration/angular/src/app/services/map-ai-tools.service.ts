/**
 * Map AI Tools Service
 *
 * Consolidated service for AI-powered map tools integration.
 * Angular equivalent of Vanilla's index.ts message handling.
 *
 * Handles:
 * - WebSocket connection management via WebSocketService
 * - Chat message state and streaming
 * - Tool execution via ConsolidatedExecutorsService
 * - Loader state management
 * - Error handling
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
  Message,
  WebSocketMessage,
  LoaderState,
  LoaderStage,
  InitialState,
  LayerConfig
} from '../models/message.model';
import { ConsolidatedExecutorsService } from './consolidated-executors.service';
import { WebSocketService } from './websocket.service';
import { DeckStateService } from '../state/deck-state.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MapAIToolsService implements OnDestroy {
  // State observables
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private loaderStateSubject = new BehaviorSubject<LoaderState>(null);
  private loaderMessageSubject = new BehaviorSubject<string>('');
  private errorSubject = new Subject<string>();
  private layersSubject = new BehaviorSubject<LayerConfig[]>([]);

  public messages$ = this.messagesSubject.asObservable();
  public loaderState$ = this.loaderStateSubject.asObservable();
  public loaderMessage$ = this.loaderMessageSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public layers$ = this.layersSubject.asObservable();

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
    private executorsService: ConsolidatedExecutorsService,
    private deckState: DeckStateService
  ) {
    // Subscribe to deck state layers for UI
    this.subscriptions.push(
      this.deckState.layers$.subscribe(layers => {
        const layerConfigs = layers.map(layer => ({
          id: (layer['id'] as string) || 'unknown',
          name: (layer['id'] as string) || 'Unknown Layer',
          color: '#036fe2',
          visible: layer['visible'] !== false
        }));
        this.layersSubject.next(layerConfigs);
      })
    );
  }

  /**
   * Connect to WebSocket server and start listening for messages
   */
  connect(wsUrl?: string): void {
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
   */
  sendMessage(content: string): boolean {
    if (!this.wsService.isConnected$.getValue()) {
      console.warn('[MapAIToolsService] WebSocket not connected');
      return false;
    }

    // Add user message
    this.addMessage({ type: 'user', content });

    // Reset streaming state
    this.streamingMessageIds.clear();

    // Set loader to thinking
    this.setLoaderState('thinking', 'Thinking...');

    // Build initial state to provide context to AI
    const initialState = this.createInitialState();

    // Send through WebSocket
    this.wsService.sendChatMessage(content, initialState);

    return true;
  }

  /**
   * Clear all messages and reset state
   */
  clearMessages(): void {
    this.messagesSubject.next([]);
    this.streamingMessageIds.clear();
    this.messageIdCounter = 0;
    this.setLoaderState(null);
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

  private createInitialState(): InitialState {
    const state = this.deckState.getState();

    return {
      viewState: {
        longitude: state.viewState.longitude ?? 0,
        latitude: state.viewState.latitude ?? 0,
        zoom: state.viewState.zoom ?? 3,
        pitch: state.viewState.pitch ?? 0,
        bearing: state.viewState.bearing ?? 0
      },
      layers: state.deckConfig.layers.map(layer => ({
        id: (layer['id'] as string) || 'unknown',
        type: (layer['@@type'] as string) || 'Unknown',
        visible: layer['visible'] !== false
      })),
      activeLayerId: state.activeLayerId,
      cartoConfig: {
        connectionName: environment.connectionName,
        hasCredentials: !!environment.accessToken
      }
    };
  }

  private handleMessage(data: WebSocketMessage): void {
    switch (data.type) {
      case 'stream_chunk':
        this.handleStreamChunk(data);
        break;
      case 'tool_call_start':
        this.handleToolCallStart(data);
        break;
      case 'mcp_tool_result':
        this.handleMcpToolResult(data);
        break;
      case 'tool_call':
        this.handleToolCall(data);
        break;
      case 'tool_result':
        this.handleToolResult(data);
        break;
      case 'error':
        this.errorSubject.next(data.content || 'Unknown error');
        this.setLoaderState(null);
        break;
      case 'welcome':
        console.log('[MapAIToolsService] Server welcome:', data.content);
        break;
    }
  }

  private handleStreamChunk(data: WebSocketMessage): void {
    if (!data.messageId) return;

    const isNewMessage = !this.streamingMessageIds.has(data.messageId);

    // First chunk - hide "thinking" loader
    if (isNewMessage) {
      this.setLoaderState(null);
    }

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      this.updateMessage(data.messageId, { streaming: false });
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
      // Update existing message
      this.updateMessage(data.messageId, {
        content: data.content || '',
        streaming: !data.isComplete,
      });
    }

    if (data.isComplete) {
      this.streamingMessageIds.delete(data.messageId);
    }
  }

  private handleToolCallStart(data: WebSocketMessage): void {
    const toolName = data.toolName || data.tool || 'tool';
    console.log('[MapAIToolsService] Tool call starting:', toolName);
    this.setLoaderState('mcp_request', `Working with ${toolName}...`);
  }

  private handleMcpToolResult(data: WebSocketMessage): void {
    const toolName = data.toolName || data.tool || 'tool';
    console.log('[MapAIToolsService] MCP tool result:', toolName);
    this.setLoaderState('mcp_processing', `Processing ${toolName} result...`);
  }

  private async handleToolCall(data: WebSocketMessage): Promise<void> {
    const toolName = data.tool || data.toolName;
    const parameters = data.parameters || data.data || {};
    const callId = data.callId || '';

    if (!toolName) {
      this.errorSubject.next('No tool name provided');
      this.setLoaderState(null);
      return;
    }

    console.log(`[MapAIToolsService] Executing tool: ${toolName}`, parameters);

    // Set loader state based on tool
    let stage: LoaderStage = 'executing';
    if (toolName === 'set-deck-state') {
      stage = 'creating';
    }
    this.setLoaderState(stage, `Executing ${toolName}...`);

    try {
      const result = await this.executorsService.execute(toolName, parameters);

      // Add result message
      this.addMessage({
        type: 'tool',
        content: result.success ? `${result.message}` : `${result.message}`,
        toolName,
        status: result.success ? 'success' : 'error'
      });

      // Send result back to server
      this.wsService.sendToolResult({
        toolName,
        callId,
        success: result.success,
        message: result.message,
        error: result.error?.message
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorSubject.next(`Tool execution error: ${errorMessage}`);

      this.wsService.sendToolResult({
        toolName,
        callId,
        success: false,
        message: `Execution error: ${errorMessage}`,
        error: errorMessage
      });
    }

    this.setLoaderState(null);
  }

  private handleToolResult(data: WebSocketMessage): void {
    console.log('[MapAIToolsService] Tool result:', data.toolName);

    // Tool completed on backend - just log for now
    if (data.success === false) {
      this.errorSubject.next(data.error || data.message || 'Tool execution failed');
    }

    this.setLoaderState(null);
  }

  private setLoaderState(state: LoaderState, message?: string): void {
    this.loaderStateSubject.next(state);
    this.loaderMessageSubject.next(message || '');
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
      toolName: msg.toolName,
      status: msg.status,
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
