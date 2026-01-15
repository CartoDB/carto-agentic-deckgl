import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewChecked,
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
export class ChatUi implements AfterViewChecked {
  @Input() isConnected: boolean = false;
  @Input() messages: Message[] = [];
  @Input() loaderState: LoaderState = null;
  @Output() sendMessage = new EventEmitter<string>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  input: string = '';

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      // Ignore scroll errors
    }
  }

  handleSend(): void {
    if (this.input.trim() && this.isConnected) {
      this.sendMessage.emit(this.input.trim());
      this.input = '';
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
