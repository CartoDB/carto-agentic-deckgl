<template>
  <div class="chat-container">
    <div class="chat-header">
      <h3 style="margin: 0;">Map Control Chat</h3>
      <span class="connection-status" :style="{ color: isConnected ? '#22c55e' : '#ef4444' }">●</span>
    </div>

    <div ref="messagesContainer" class="messages-container">
      <div
        v-for="msg in messages"
        :key="msg.id || msg.messageId"
        :class="getMessageClasses(msg)"
        :style="getMessageStyle(msg)"
      >
        {{ msg.content }}
        <span v-if="msg.streaming" class="streaming-indicator">▌</span>
      </div>
      <div ref="messagesEnd" />
    </div>

    <div class="input-container">
      <input
        v-model="input"
        type="text"
        @keypress.enter="handleSend"
        placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
        class="message-input"
      />
      <button
        @click="handleSend"
        :disabled="!isConnected"
        :class="['send-button', { disabled: !isConnected }]"
      >
        Send
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, type CSSProperties } from 'vue';

interface Message {
  id?: string;
  type: 'user' | 'assistant' | 'action' | 'error' | 'system';
  content: string;
  streaming?: boolean;
  messageId?: string;
}

const props = defineProps<{
  isConnected: boolean;
  messages: Message[];
}>();

const emit = defineEmits<{
  sendMessage: [content: string];
}>();

const input = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const messagesEnd = ref<HTMLElement | null>(null);

const scrollToBottom = (): void => {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

watch(() => props.messages, () => {
  scrollToBottom();
}, { deep: true });

const handleSend = (): void => {
  if (input.value.trim() && props.isConnected) {
    emit('sendMessage', input.value.trim());
    input.value = '';
  }
};

const getMessageStyle = (msg: Message): CSSProperties => {
  const baseStyle: CSSProperties = {
    padding: '10px',
    borderRadius: '8px',
    maxWidth: '80%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  };

  switch (msg.type) {
    case 'user':
      return { ...baseStyle, alignSelf: 'flex-end', background: '#3b82f6', color: 'white' };
    case 'assistant':
      return { ...baseStyle, alignSelf: 'flex-start', background: '#f3f4f6', color: '#111' };
    case 'action':
      return { ...baseStyle, alignSelf: 'flex-start', background: '#10b981', color: 'white', fontFamily: 'monospace', fontSize: '13px' };
    case 'error':
      return { ...baseStyle, alignSelf: 'flex-start', background: '#ef4444', color: 'white' };
    case 'system':
      return { ...baseStyle, alignSelf: 'center', background: '#f1f5f9', color: '#64748b', fontSize: '12px', fontStyle: 'italic' };
    default:
      return { ...baseStyle, alignSelf: 'flex-start', background: '#f3f4f6', color: '#111' };
  }
};

const getMessageClasses = (msg: Message): string => {
  const classes = ['message', msg.type];
  if (msg.streaming) classes.push('streaming');
  return classes.join(' ');
};
</script>

<style scoped>
.chat-container {
  width: 350px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #ddd;
  background: white;
}

.chat-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-status {
  font-size: 12px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-container {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

.message-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.send-button {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.send-button.disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.streaming-indicator {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
