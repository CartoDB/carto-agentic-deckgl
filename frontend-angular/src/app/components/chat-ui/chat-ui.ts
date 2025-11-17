import { Component, Input, Output, EventEmitter, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-chat-ui',
  imports: [FormsModule, CommonModule],
  templateUrl: './chat-ui.html',
  styleUrl: './chat-ui.css',
})
export class ChatUi implements AfterViewChecked {
  @Input() isConnected: boolean = false;
  @Input() messages: Message[] = [];
  @Output() sendMessage = new EventEmitter<string>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  input: string = '';

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {}
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
}
