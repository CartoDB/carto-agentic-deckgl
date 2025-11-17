import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Deck } from '@deck.gl/core';
import { MapView } from './components/map-view/map-view';
import { ChatUi } from './components/chat-ui/chat-ui';
import { WebSocketService } from './services/websocket.service';
import { MapToolsService } from './services/map-tools.service';
import { Message, WebSocketMessage } from './models/message.model';

const WS_URL = 'ws://localhost:3000/ws';

@Component({
  selector: 'app-root',
  imports: [MapView, ChatUi],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  messages: Message[] = [];
  isConnected: boolean = false;
  private subscription?: Subscription;

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

  handleDeckInit(deck: Deck): void {
    this.mapToolsService.initialize(deck);
  }

  async handleMessage(data: WebSocketMessage): Promise<void> {
    if (data.type === 'stream_chunk' && data.messageId) {
      this.messages = this.messages.filter(m => m.messageId !== data.messageId);
      this.messages.push({
        type: 'bot',
        content: data.content || '',
        streaming: !data.isComplete,
        messageId: data.messageId
      });
    } else if (data.type === 'tool_call' && data.tool && this.mapToolsService.isInitialized()) {
      const result = await this.mapToolsService.execute(data.tool, data.parameters);
      if (result.success) {
        this.messages.push({
          type: 'action',
          content: `✓ ${result.message}`
        });
      } else {
        console.error('[Main] Tool execution failed:', result.message);
      }
    } else if (data.type === 'error') {
      this.messages.push({
        type: 'bot',
        content: `Error: ${data.content}`
      });
    }
  }

  handleSendMessage(content: string): void {
    this.messages.push({
      type: 'user',
      content: content
    });

    this.wsService.send({
      type: 'chat_message',
      content: content,
      timestamp: Date.now()
    });
  }
}
