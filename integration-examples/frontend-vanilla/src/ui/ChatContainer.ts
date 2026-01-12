/**
 * ChatContainer - Chat interface component for AI map interaction
 */

import { marked } from 'marked';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true // GitHub flavored markdown
});

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'action';
  content: string;
}

export class ChatContainer {
  private container: HTMLElement;
  private messages: ChatMessageData[] = [];
  private sendCallback: ((content: string) => void) | null = null;
  private messagesContainer!: HTMLElement;
  private input!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private connectionStatus!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="chat-container">
        <div class="chat-header">
          <h3>AI Map Assistant</h3>
          <span class="connection-status" id="connection-status"></span>
        </div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-container">
          <input
            type="text"
            class="chat-input"
            id="chat-input"
            placeholder="Ask about the map..."
            autocomplete="off"
          />
          <button class="chat-send-btn" id="chat-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.messagesContainer = this.container.querySelector('#chat-messages')!;
    this.input = this.container.querySelector('#chat-input')!;
    this.sendBtn = this.container.querySelector('#chat-send-btn')!;
    this.connectionStatus = this.container.querySelector('#connection-status')!;
  }

  private attachEvents(): void {
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private handleSend(): void {
    const content = this.input.value.trim();
    if (content && this.sendCallback) {
      this.sendCallback(content);
      this.input.value = '';
    }
  }

  /**
   * Register callback for when user sends a message
   */
  onSend(callback: (content: string) => void): void {
    this.sendCallback = callback;
  }

  /**
   * Add a message to the chat
   */
  addMessage(msg: {
    role: 'user' | 'assistant' | 'system' | 'action';
    content: string;
    id?: string;
  }): string {
    const id =
      msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessageData = { ...msg, id };
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
    return id;
  }

  private renderMessage(msg: ChatMessageData): void {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message chat-message-${msg.role}`;
    messageEl.id = `message-${msg.id}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'chat-message-content';

    // Use markdown rendering for assistant messages
    if (msg.role === 'assistant') {
      contentEl.innerHTML = marked.parse(msg.content) as string;
    } else {
      contentEl.textContent = msg.content;
    }

    messageEl.appendChild(contentEl);
    this.messagesContainer.appendChild(messageEl);
  }

  /**
   * Update an existing message (for streaming)
   */
  updateMessage(messageId: string, content: string): void {
    const messageEl = this.container.querySelector(`#message-${messageId}`);
    if (messageEl) {
      const contentEl = messageEl.querySelector('.chat-message-content');
      if (contentEl) {
        // Check if this is an assistant message (has markdown class or check parent)
        const isAssistant = messageEl.classList.contains('chat-message-assistant');
        if (isAssistant) {
          contentEl.innerHTML = marked.parse(content) as string;
        } else {
          contentEl.textContent = content;
        }
      }
    }
    // Also update in messages array
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg) {
      msg.content = content;
    }
    this.scrollToBottom();
  }

  /**
   * Get all messages
   */
  getMessages(): ChatMessageData[] {
    return this.messages;
  }

  /**
   * Add a tool execution result message
   */
  addToolCall({
    status,
    message
  }: {
    toolName: string;
    status: 'success' | 'error';
    message: string;
  }): void {
    this.addMessage({
      role: 'action',
      content: `${status === 'success' ? '\u2713' : '\u2717'} ${message}`
    });
  }

  /**
   * Update connection status indicator
   */
  setConnectionStatus(connected: boolean): void {
    console.log('[ChatContainer] Connection status:', connected);
    if (this.connectionStatus) {
      this.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      this.connectionStatus.textContent = connected
        ? 'Connected'
        : 'Disconnected';
    }
  }

  /**
   * Set connection status to "Checking..."
   */
  setConnectionChecking(): void {
    if (this.connectionStatus) {
      this.connectionStatus.className = 'connection-status checking';
      this.connectionStatus.textContent = 'Checking...';
    }
  }

  /**
   * Hide connection status indicator (for HTTP mode)
   */
  hideConnectionStatus(): void {
    if (this.connectionStatus) {
      this.connectionStatus.style.display = 'none';
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}
