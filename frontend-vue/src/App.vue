<template>
  <div style="display: flex; width: 100vw; height: 100vh;">
    <div style="flex: 1; position: relative;">
      <MapView @deckInit="handleDeckInit" />
    </div>
    <ChatUI
      :isConnected="isConnected"
      :messages="messages"
      @sendMessage="handleSendMessage"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import MapView from './components/MapView.vue';
import ChatUI from './components/ChatUI.vue';
import { useWebSocket } from './composables/useWebSocket';
import { useMapTools } from './composables/useMapTools';

const WS_URL = 'ws://localhost:3000/ws';

const messages = ref([]);
const deck = ref(null);
const { mapTools } = useMapTools(deck);

const handleMessage = async (data) => {
  if (data.type === 'stream_chunk') {
    const filtered = messages.value.filter(m => m.messageId !== data.messageId);
    messages.value = [...filtered, {
      type: 'bot',
      content: data.content,
      streaming: !data.isComplete,
      messageId: data.messageId
    }];
  } else if (data.type === 'tool_call' && mapTools.value) {
    const result = await mapTools.value.execute(data.tool, data.parameters);
    if (result.success) {
      messages.value.push({
        type: 'action',
        content: `✓ ${result.message}`
      });
    } else {
      console.error('[Main] Tool execution failed:', result.message);
    }
  } else if (data.type === 'error') {
    messages.value.push({
      type: 'bot',
      content: `Error: ${data.content}`
    });
  }
};

const { isConnected, send } = useWebSocket(WS_URL, handleMessage);

const handleDeckInit = (deckInstance) => {
  deck.value = deckInstance;
};

const handleSendMessage = (content) => {
  messages.value.push({
    type: 'user',
    content: content
  });

  send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
};
</script>
