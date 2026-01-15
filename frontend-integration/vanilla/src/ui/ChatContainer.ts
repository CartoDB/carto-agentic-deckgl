/**
 * ChatContainer - Chat interface component for AI map interaction
 */

import { marked } from 'marked';
import { LoadingIndicator, type LoadingState } from './LoadingIndicator';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true // GitHub flavored markdown
});

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'action' | 'action-error';
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
  private loadingIndicator!: LoadingIndicator;
  private thinkingMessageId: string | null = null;
  private dotsInterval: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.attachEvents();
    // Create loading indicator
    this.loadingIndicator = new LoadingIndicator(this.container);
  }

  private render(): void {
    // Add CSS for tool loading messages if not already added
    if (!document.querySelector('#chat-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'chat-loading-styles';
      style.textContent = `
        .chat-message-loading {
          padding: 10px;
          margin: 5px 10px;
          background: linear-gradient(90deg, #f0f7ff 0%, #f8fbff 100%);
          border-left: 3px solid #036fe2;
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .loading-message {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: #333;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e0e0e0;
          border-top: 2px solid #036fe2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          flex: 1;
        }

        /* AI Thinking Message Styles */
        .chat-message-thinking {
          padding: 12px 16px;
          margin: 8px 10px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-left: 3px solid #6c757d;
          border-radius: 8px;
          animation: fadeIn 0.3s ease-out;
        }

        .thinking-content {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #495057;
          font-style: italic;
        }

        .thinking-icon {
          font-size: 16px;
        }

        .thinking-text {
          flex: 1;
        }

        .thinking-dots {
          display: inline-block;
          min-width: 24px;
          text-align: left;
          font-weight: bold;
          color: #6c757d;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        .chat-message-thinking.removing {
          animation: fadeOut 0.2s ease-out forwards;
        }
      `;
      document.head.appendChild(style);
    }

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
    role: 'user' | 'assistant' | 'system' | 'action' | 'action-error';
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
      role: status === 'success' ? 'action' : 'action-error',
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

  /**
   * Set loading state (thinking or executing)
   */
  setLoadingState(state: LoadingState): void {
    if (state === null) {
      this.loadingIndicator.hide();
      // Re-enable input when not loading
      this.input.disabled = false;
      this.sendBtn.disabled = false;
    } else {
      this.loadingIndicator.setState(state);
      // Disable input during loading
      if (state === 'thinking') {
        this.input.disabled = true;
        this.sendBtn.disabled = true;
      } else {
        // Allow input during tool execution
        this.input.disabled = false;
        this.sendBtn.disabled = false;
      }
    }
  }

  /**
   * Loading stage type for tool execution
   */
  static readonly LOADING_STAGES = {
    starting: 'starting',
    mcp_request: 'mcp_request',
    mcp_processing: 'mcp_processing',
    enriching: 'enriching',
    creating: 'creating',
    loading: 'loading'
  } as const;

  /**
   * Add a tool loading message to the chat
   * @param toolName The name of the tool being executed
   * @param stage The current stage of execution
   * @returns The message ID for updating/removing
   */
  addToolLoading(
    toolName: string,
    stage: 'starting' | 'mcp_request' | 'mcp_processing' | 'enriching' | 'creating' | 'loading'
  ): string {
    const messageId = `loading-${Date.now()}`;
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message chat-message-loading';
    messageElement.id = messageId;

    const stageMessages: Record<string, string> = {
      'starting': `⚡ Preparing to execute ${toolName}...`,
      'mcp_request': `🔗 Working with CARTO MCPs...`,
      'mcp_processing': `⚙️ Processing server response...`,
      'enriching': `🔄 Enriching data with demographic information...`,
      'creating': `🏗️ Creating vector layer...`,
      'loading': `📍 Loading map tiles for visualization...`
    };

    messageElement.innerHTML = `
      <div class="loading-message">
        <span class="loading-spinner"></span>
        <span class="loading-text">${stageMessages[stage] || `Executing ${toolName}...`}</span>
      </div>
    `;

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
    return messageId;
  }

  /**
   * Update the text of a tool loading message
   * @param messageId The ID of the loading message
   * @param stage The new stage
   * @param message Optional custom message (overrides stage default)
   */
  updateToolLoading(messageId: string, stage: string, message?: string): void {
    const element = document.getElementById(messageId);
    if (element) {
      const textElement = element.querySelector('.loading-text');
      if (textElement) {
        // Stage messages with icons
        const stageMessages: Record<string, string> = {
          'starting': `⚡ Preparing...`,
          'mcp_request': `🔗 Working with CARTO MCPs...`,
          'mcp_processing': `⚙️ Processing server response...`,
          'enriching': `🔄 Enriching data with demographic information...`,
          'creating': `🏗️ Creating vector layer...`,
          'loading': `📍 Loading map tiles for visualization...`
        };

        textElement.textContent = message || stageMessages[stage] || `Stage: ${stage}`;
      }
    }
  }

  /**
   * Remove a tool loading message from the chat
   * @param messageId The ID of the loading message to remove
   */
  removeToolLoading(messageId: string): void {
    const element = document.getElementById(messageId);
    if (element) {
      element.remove();
    }
  }

  /**
   * Add a thinking message to the chat with animated dots
   * @returns The message ID for tracking
   */
  addThinkingMessage(): string {
    // Remove any existing thinking message first
    this.removeThinkingMessage();

    const messageId = `thinking-${Date.now()}`;
    this.thinkingMessageId = messageId;

    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message chat-message-thinking';
    messageElement.id = messageId;

    messageElement.innerHTML = `
      <div class="thinking-content">
        <span class="thinking-icon">🤖</span>
        <span class="thinking-text">AI is thinking</span>
        <span class="thinking-dots">.</span>
      </div>
    `;

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();

    // Start dots animation
    this.startDotsAnimation(messageId);

    return messageId;
  }

  /**
   * Start the dots animation for the thinking message
   */
  private startDotsAnimation(messageId: string): void {
    // Clear any existing interval
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
    }

    let dotCount = 1;
    this.dotsInterval = window.setInterval(() => {
      const element = document.getElementById(messageId);
      if (element) {
        const dotsElement = element.querySelector('.thinking-dots');
        if (dotsElement) {
          dotCount = (dotCount % 4) + 1;
          dotsElement.textContent = '.'.repeat(dotCount);
        }
      } else {
        // Element was removed, stop the animation
        if (this.dotsInterval) {
          clearInterval(this.dotsInterval);
          this.dotsInterval = null;
        }
      }
    }, 400);
  }

  /**
   * Remove the thinking message from the chat
   */
  removeThinkingMessage(): void {
    // Stop dots animation
    if (this.dotsInterval) {
      clearInterval(this.dotsInterval);
      this.dotsInterval = null;
    }

    if (this.thinkingMessageId) {
      const element = document.getElementById(this.thinkingMessageId);
      if (element) {
        // Add removing class for fade-out animation
        element.classList.add('removing');
        // Remove after animation completes
        setTimeout(() => {
          element.remove();
        }, 200);
      }
      this.thinkingMessageId = null;
    }
  }

  /**
   * Check if a thinking message is currently shown
   */
  hasThinkingMessage(): boolean {
    return this.thinkingMessageId !== null;
  }

  /**
   * Disable/enable the input field
   * When enabled, automatically focuses the input
   */
  setInputDisabled(disabled: boolean): void {
    this.input.disabled = disabled;
    this.sendBtn.disabled = disabled;
    if (!disabled) {
      this.input.focus();
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}
