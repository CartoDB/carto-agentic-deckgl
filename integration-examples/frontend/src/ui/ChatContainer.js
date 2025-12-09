/**
 * ChatContainer - Custom chat interface component
 */
export class ChatContainer {
  constructor(container) {
    this.container = container;
    this.messages = [];
    this.sendCallback = null;
    this.render();
    this.attachEvents();
  }

  render() {
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

    this.messagesContainer = this.container.querySelector('#chat-messages');
    this.input = this.container.querySelector('#chat-input');
    this.sendBtn = this.container.querySelector('#chat-send-btn');
    this.connectionStatus = this.container.querySelector('#connection-status');
  }

  attachEvents() {
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  handleSend() {
    const content = this.input.value.trim();
    if (content && this.sendCallback) {
      this.sendCallback(content);
      this.input.value = '';
    }
  }

  onSend(callback) {
    this.sendCallback = callback;
  }

  addMessage(msg) {
    const id = msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message = { ...msg, id };
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
    return id;
  }

  renderMessage(msg) {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message chat-message-${msg.role || 'system'}`;
    messageEl.id = `message-${msg.id}`;

    const contentEl = document.createElement('div');
    contentEl.className = 'chat-message-content';
    contentEl.textContent = msg.content;

    messageEl.appendChild(contentEl);
    this.messagesContainer.appendChild(messageEl);
  }

  updateMessage(messageId, content) {
    const messageEl = this.container.querySelector(`#message-${messageId}`);
    if (messageEl) {
      const contentEl = messageEl.querySelector('.chat-message-content');
      if (contentEl) {
        contentEl.textContent = content;
      }
    }
    // Also update in messages array
    const msg = this.messages.find(m => m.id === messageId);
    if (msg) {
      msg.content = content;
    }
    this.scrollToBottom();
  }

  getMessages() {
    return this.messages;
  }

  addToolCall({ toolName, status, message }) {
    this.addMessage({
      role: 'action',
      content: `${status === 'success' ? '✓' : '✗'} ${message}`
    });
  }

  setConnectionStatus(connected) {
    if (this.connectionStatus) {
      this.connectionStatus.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
      this.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}
