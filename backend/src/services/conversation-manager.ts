// backend/src/services/conversation-manager.ts
import { OpenAI } from 'openai';

export class ConversationManager {
  private conversations = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();
  private maxHistoryLength = 10; // Keep last 10 messages

  getConversation(sessionId: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    return this.conversations.get(sessionId)!;
  }

  addMessage(sessionId: string, message: OpenAI.Chat.ChatCompletionMessageParam): void {
    const conversation = this.getConversation(sessionId);
    conversation.push(message);

    // Prune old messages (keep system prompt + last N messages)
    if (conversation.length > this.maxHistoryLength) {
      // Keep first message if it's system prompt
      const hasSystemPrompt = conversation[0]?.role === 'system';
      const start = hasSystemPrompt ? 1 : 0;
      const keep = conversation.length - this.maxHistoryLength + (hasSystemPrompt ? 1 : 0);

      this.conversations.set(sessionId, [
        ...(hasSystemPrompt ? [conversation[0]] : []),
        ...conversation.slice(keep)
      ]);
    }
  }

  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }
}
