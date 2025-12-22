// backend/src/services/conversation-manager.ts
import { OpenAI } from 'openai';

export class ConversationManager {
  private conversations = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>();
  private responseIds = new Map<string, string>(); // Track last response_id per session
  private hadToolCalls = new Map<string, boolean>(); // Track if last response had tool calls
  private maxHistoryLength = 10; // Keep last 10 messages

  getConversation(sessionId: string): OpenAI.Chat.ChatCompletionMessageParam[] {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, []);
    }
    return this.conversations.get(sessionId)!;
  }

  getLastResponseId(sessionId: string): string | undefined {
    // Don't return response ID if last response had tool calls
    // (OpenAI expects tool outputs which we don't provide since tools run on frontend)
    if (this.hadToolCalls.get(sessionId)) {
      return undefined;
    }
    return this.responseIds.get(sessionId);
  }

  setResponseId(sessionId: string, responseId: string, hadToolCalls: boolean = false): void {
    this.responseIds.set(sessionId, responseId);
    this.hadToolCalls.set(sessionId, hadToolCalls);
  }

  addMessage(sessionId: string, message: OpenAI.Chat.ChatCompletionMessageParam): void {
    const conversation = this.getConversation(sessionId);
    conversation.push(message);

    // Prune old messages (keep system prompt + last N messages)
    if (conversation.length > this.maxHistoryLength) {
      // Keep first message if it's system prompt
      const hasSystemPrompt = conversation[0]?.role === 'system';
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
