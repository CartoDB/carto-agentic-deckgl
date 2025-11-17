<template>
  <div style="width: 350px; display: flex; flex-direction: column; border-left: 1px solid #ddd; background: white;">
    <div style="padding: 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0;">Map Control Chat</h3>
      <span style="font-size: 12px;" :style="{ color: isConnected ? '#22c55e' : '#ef4444' }">●</span>
    </div>

    <div ref="messagesContainer" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px;">
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['message', msg.type, msg.streaming ? 'streaming' : '']"
        :style="{
          padding: '10px',
          borderRadius: '8px',
          maxWidth: '80%',
          alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
          background: msg.type === 'user' ? '#3b82f6' : msg.type === 'action' ? '#10b981' : '#f3f4f6',
          color: msg.type === 'user' || msg.type === 'action' ? 'white' : '#111'
        }"
      >
        {{ msg.content }}
      </div>
      <div ref="messagesEnd" />
    </div>

    <div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px;">
      <input
        v-model="input"
        type="text"
        @keypress.enter="handleSend"
        placeholder="Type a command (e.g., 'zoom in', 'fly to San Francisco')"
        style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;"
      />
      <button
        @click="handleSend"
        :disabled="!isConnected"
        :style="{
          padding: '10px 20px',
          background: isConnected ? '#3b82f6' : '#cbd5e1',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isConnected ? 'pointer' : 'not-allowed',
          fontWeight: '500'
        }"
      >
        Send
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  isConnected: Boolean,
  messages: Array
});

const emit = defineEmits(['sendMessage']);

const input = ref('');
const messagesContainer = ref(null);
const messagesEnd = ref(null);

const scrollToBottom = () => {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
  });
};

watch(() => props.messages, () => {
  scrollToBottom();
}, { deep: true });

const handleSend = () => {
  if (input.value.trim() && props.isConnected) {
    emit('sendMessage', input.value.trim());
    input.value = '';
  }
};
</script>
