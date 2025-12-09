import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MapView } from './components/map-view/map-view';
import { ChatUi } from './components/chat-ui/chat-ui';
import { ZoomControls } from './components/zoom-controls/zoom-controls';
import { LayerToggle } from './components/layer-toggle/layer-toggle';
import { WebSocketService } from './services/websocket.service';
import { MapToolsService } from './services/map-tools.service';
import { Message, WebSocketMessage, MapInstances } from './models/message.model';

const WS_URL = 'ws://localhost:3000/ws';

@Component({
  selector: 'app-root',
  imports: [MapView, ChatUi, ZoomControls, LayerToggle],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  messages: Message[] = [];
  isConnected: boolean = false;
  private subscription?: Subscription;
  private messageIdCounter = 0;

  // Streaming message state - accumulates content instead of replacing
  private streamingContent = new Map<string, string>();

  constructor(
    private wsService: WebSocketService,
    private mapToolsService: MapToolsService
  ) {}

  ngOnInit(): void {
    this.wsService.connect(WS_URL);

    this.subscription = this.wsService.isConnected$.subscribe(
      (connected) => (this.isConnected = connected)
    );

    this.wsService.message$.subscribe(
      async (data) => await this.handleMessage(data)
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.wsService.disconnect();
  }

  handleMapInit(instances: MapInstances): void {
    this.mapToolsService.initialize(instances.deck, instances.map);
  }

  private generateMessageId(): string {
    return `local_${Date.now()}_${this.messageIdCounter++}`;
  }

  async handleMessage(data: WebSocketMessage): Promise<void> {
    if (data.type === 'stream_chunk' && data.messageId) {
      // Handle streaming chunks - accumulate content
      const isNewMessage = !this.streamingContent.has(data.messageId);

      // Skip empty completion chunks
      if (data.isComplete && !data.content) {
        // Just mark the message as not streaming anymore
        this.messages = this.messages.map(msg =>
          msg.messageId === data.messageId
            ? { ...msg, streaming: false }
            : msg
        );
        return;
      }

      if (isNewMessage) {
        // New message - initialize content and add to messages
        this.streamingContent.set(data.messageId, data.content || '');
        this.messages = [...this.messages, {
          id: this.generateMessageId(),
          type: 'assistant',
          content: data.content || '',
          streaming: true,
          messageId: data.messageId
        }];
      } else {
        // Existing message - accumulate content
        const existingContent = this.streamingContent.get(data.messageId) || '';
        const newContent = existingContent + (data.content || '');
        this.streamingContent.set(data.messageId, newContent);

        // Update the message in the array
        this.messages = this.messages.map(msg =>
          msg.messageId === data.messageId
            ? { ...msg, content: newContent, streaming: !data.isComplete }
            : msg
        );
      }

      // Clean up streaming content when complete
      if (data.isComplete) {
        this.streamingContent.delete(data.messageId);
      }
    } else if (data.type === 'tool_call' && data.tool && this.mapToolsService.isInitialized()) {
      const result = await this.mapToolsService.execute(data.tool, data.parameters);
      this.messages = [...this.messages, {
        id: this.generateMessageId(),
        type: 'action',
        content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`
      }];
    } else if (data.type === 'error') {
      this.messages = [...this.messages, {
        id: this.generateMessageId(),
        type: 'error',
        content: `Error: ${data.content}`
      }];
    } else if (data.type === 'welcome') {
      console.log('Server welcome:', data.content);
    }
  }

  handleSendMessage(content: string): void {
    // Clear streaming state for new conversation turn
    this.streamingContent.clear();

    this.messages = [...this.messages, {
      id: this.generateMessageId(),
      type: 'user',
      content: content
    }];

    this.wsService.send({
      type: 'chat_message',
      content: content,
      timestamp: Date.now()
    });
  }
}
