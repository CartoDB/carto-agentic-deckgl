import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { Message, LoaderState } from '../../models/message.model';

@Component({
  selector: 'app-chat-ui',
  standalone: true,
  imports: [FormsModule, CommonModule, MarkdownModule],
  templateUrl: './chat-ui.html',
  styleUrl: './chat-ui.css',
})
export class ChatUi implements OnChanges, AfterViewInit {
  @Input() isConnected: boolean = false;
  @Input() messages: Message[] = [];
  @Input() loaderState: LoaderState = null;
  @Output() sendMessage = new EventEmitter<string>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;

  input: string = '';
  private shouldAutoScroll: boolean = true;
  private previousMessageCount: number = 0;

  ngAfterViewInit(): void {
    // Initialize previous message count
    this.previousMessageCount = this.messages.length;
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only auto-scroll if messages changed
    if (changes['messages'] && !changes['messages'].firstChange) {
      const hasNewMessages = this.messages.length !== this.previousMessageCount;
      
      if (hasNewMessages) {
        this.previousMessageCount = this.messages.length;
        
        // Check current scroll position before auto-scrolling
        this.checkScrollPosition();
        
        // Small delay to ensure DOM is updated
        setTimeout(() => {
          if (this.shouldAutoScroll) {
            this.scrollToBottom();
          }
        }, 0);
      }
    }
  }

  private checkScrollPosition(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Consider user at bottom if within 100px of bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    this.shouldAutoScroll = isNearBottom;
  }

  handleScroll(event: Event): void {
    const container = event.target as HTMLDivElement;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Consider user at bottom if within 100px of bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    this.shouldAutoScroll = isNearBottom;
  }

  scrollToBottom(): void {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        // Use instant scroll to avoid interfering with user scrolling
        container.scrollTop = container.scrollHeight;
      } else {
        this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'auto' });
      }
    } catch (err) {
      // Ignore scroll errors
    }
  }

  handleSend(): void {
    if (this.input.trim() && this.isConnected) {
      this.sendMessage.emit(this.input.trim());
      this.input = '';
      // Enable auto-scroll when user sends a message
      this.shouldAutoScroll = true;
    }
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.handleSend();
    }
  }

  getMessageStyle(msg: Message): Record<string, string> {
    const baseStyle: Record<string, string> = {
      padding: '10px',
      'border-radius': '8px',
      'max-width': '80%',
      'white-space': 'pre-wrap',
      'word-break': 'break-word',
    };

    switch (msg.type) {
      case 'user':
        return {
          ...baseStyle,
          'align-self': 'flex-end',
          background: '#3b82f6',
          color: 'white',
        };
      case 'assistant':
        return {
          ...baseStyle,
          'align-self': 'flex-start',
          background: '#f3f4f6',
          color: '#111',
        };
      case 'action':
        return {
          ...baseStyle,
          'align-self': 'flex-start',
          background: '#10b981',
          color: 'white',
          'font-family': 'monospace',
          'font-size': '13px',
        };
      case 'error':
        return {
          ...baseStyle,
          'align-self': 'flex-start',
          background: '#ef4444',
          color: 'white',
        };
      case 'system':
        return {
          ...baseStyle,
          'align-self': 'center',
          background: '#f1f5f9',
          color: '#64748b',
          'font-size': '12px',
          'font-style': 'italic',
        };
      default:
        return {
          ...baseStyle,
          'align-self': 'flex-start',
          background: '#f3f4f6',
          color: '#111',
        };
    }
  }

  getMessageClasses(msg: Message): string {
    const classes = ['message', msg.type];
    if (msg.streaming) {
      classes.push('streaming');
    }
    return classes.join(' ');
  }

  trackByMessage(index: number, msg: Message): string {
    return msg.id || msg.messageId || index.toString();
  }
}
