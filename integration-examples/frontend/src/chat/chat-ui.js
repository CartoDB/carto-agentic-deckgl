// frontend/src/chat/chat-ui.js
export class ChatUI {
  constructor(messagesContainer, inputElement, sendButton, statusIndicator) {
    this.messagesContainer = messagesContainer;
    this.inputElement = inputElement;
    this.sendButton = sendButton;
    this.statusIndicator = statusIndicator;
    this.streamingMessages = new Map(); // Track streaming messages
  }

  addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
    messageDiv.textContent = content;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return messageDiv;
  }

  // NEW: Handle streaming message updates
  updateStreamingMessage(messageId, content, isComplete = false) {
    let messageDiv = this.streamingMessages.get(messageId);

    if (!messageDiv) {
      messageDiv = document.createElement('div');
      messageDiv.className = 'message bot streaming';
      messageDiv.dataset.messageId = messageId;
      this.messagesContainer.appendChild(messageDiv);
      this.streamingMessages.set(messageId, messageDiv);
    }

    messageDiv.textContent = content;

    if (isComplete) {
      messageDiv.classList.remove('streaming');
      this.streamingMessages.delete(messageId);
    }

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  // NEW: Add action confirmation message
  addActionMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message action';
    messageDiv.textContent = `✓ ${content}`;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  clearInput() {
    this.inputElement.value = '';
  }

  setConnectionStatus(connected) {
    this.statusIndicator.className = connected ? 'connected' : 'disconnected';
    this.sendButton.disabled = !connected;
  }

  onSendMessage(callback) {
    const sendMessage = () => {
      const content = this.inputElement.value.trim();
      if (content) {
        callback(content);
        this.clearInput();
      }
    };

    this.sendButton.addEventListener('click', sendMessage);
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }
}
