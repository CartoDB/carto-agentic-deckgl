// backend/src/services/message-handler.ts
import { WebSocket } from 'ws';
import { ClientMessage } from '../types/messages';
import { OpenAIService } from './openai-service';
import { ConversationManager } from './conversation-manager';

// Lazy initialization to ensure .env is loaded first
let openaiService: OpenAIService | null = null;
let conversationManager: ConversationManager | null = null;

function getServices(): { openaiService: OpenAIService; conversationManager: ConversationManager } {
  if (!openaiService) {
    openaiService = new OpenAIService();
  }
  if (!conversationManager) {
    conversationManager = new ConversationManager();
  }
  return { openaiService, conversationManager };
}

export async function handleMessage(ws: WebSocket, message: ClientMessage, sessionId: string): Promise<void> {
  console.log('[Message] Received:', message);

  try {
    // Get services (lazy initialization)
    const services = getServices();

    // Add user message to conversation history
    services.conversationManager.addMessage(sessionId, {
      role: 'user',
      content: message.content
    });

    // Get conversation history
    const messages = services.conversationManager.getConversation(sessionId);

    // Stream response from OpenAI
    const assistantMessage = await services.openaiService.streamChatCompletion(messages, ws);

    // Add assistant response to conversation history
    if (assistantMessage) {
      services.conversationManager.addMessage(sessionId, assistantMessage);
    }

  } catch (error) {
    console.error('[Message] Error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      content: 'Failed to process message',
      timestamp: Date.now()
    }));
  }
}
