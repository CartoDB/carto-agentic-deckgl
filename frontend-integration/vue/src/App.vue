<template>
  <div style="display: flex; width: 100vw; height: 100vh;">
    <div style="flex: 1; position: relative;">
      <MapView @map-init="handleMapInit" />
      <ZoomControls :disabled="!isConnected" :map-tools="mapTools" />
      <LayerToggle :disabled="!isConnected" :map-tools="mapTools" />
    </div>
    <ChatUI
      :isConnected="isConnected"
      :messages="messages"
      @sendMessage="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import MapView from './components/MapView.vue';
import ChatUI from './components/ChatUI.vue';
import ZoomControls from './components/ZoomControls.vue';
import LayerToggle from './components/LayerToggle.vue';
import { useWebSocket, type WebSocketMessage } from './composables/useWebSocket';
import { useMapTools, type ToolResult } from './composables/useMapTools';
import { Deck } from '@deck.gl/core';
import type maplibregl from 'maplibre-gl';

const WS_URL = 'ws://localhost:3000/ws';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'action' | 'error' | 'system';
  content: string;
  streaming?: boolean;
  messageId?: string;
}

const messages = ref<Message[]>([]);
const deck = ref<Deck | null>(null);
const map = ref<maplibregl.Map | null>(null);
let messageIdCounter = 0;

// Streaming content accumulation
const streamingContent = new Map<string, string>();

// Initialize map tools with both deck and map refs
const mapTools = useMapTools(deck, map);

const generateMessageId = (): string => {
  return `local_${Date.now()}_${messageIdCounter++}`;
};

const handleMessage = (data: WebSocketMessage): void => {
  if (data.type === 'stream_chunk' && data.messageId) {
    const isNewMessage = !streamingContent.has(data.messageId);

    // Skip empty completion chunks
    if (data.isComplete && !data.content) {
      messages.value = messages.value.map(msg =>
        msg.messageId === data.messageId
          ? { ...msg, streaming: false }
          : msg
      );
      return;
    }

    if (isNewMessage) {
      streamingContent.set(data.messageId, data.content || '');
      messages.value = [...messages.value, {
        id: generateMessageId(),
        type: 'assistant',
        content: data.content || '',
        streaming: true,
        messageId: data.messageId
      }];
    } else {
      const existingContent = streamingContent.get(data.messageId) || '';
      const newContent = existingContent + (data.content || '');
      streamingContent.set(data.messageId, newContent);

      messages.value = messages.value.map(msg =>
        msg.messageId === data.messageId
          ? { ...msg, content: newContent, streaming: !data.isComplete }
          : msg
      );
    }

    if (data.isComplete) {
      streamingContent.delete(data.messageId);
    }
  } else if (data.type === 'tool_call' && data.tool && mapTools.isInitialized()) {
    const result: ToolResult = mapTools.execute(data.tool, data.parameters || {});
    messages.value = [...messages.value, {
      id: generateMessageId(),
      type: 'action',
      content: result.success ? `✓ ${result.message}` : `✗ ${result.message}`
    }];
  } else if (data.type === 'error') {
    messages.value = [...messages.value, {
      id: generateMessageId(),
      type: 'error',
      content: `Error: ${data.content}`
    }];
  } else if (data.type === 'welcome') {
    console.log('Server welcome:', data.content);
  }
};

const { isConnected, send } = useWebSocket(WS_URL, handleMessage);

const handleMapInit = (instances: { deck: Deck; map: maplibregl.Map }): void => {
  deck.value = instances.deck;
  map.value = instances.map;
};

const handleSendMessage = (content: string): void => {
  streamingContent.clear();

  messages.value = [...messages.value, {
    id: generateMessageId(),
    type: 'user',
    content: content
  }];

  send({
    type: 'chat_message',
    content: content,
    timestamp: Date.now()
  });
};
</script>
