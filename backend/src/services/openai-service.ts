// backend/src/services/openai-service.ts
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import { getToolDefinitions, getSystemPrompt } from '@map-tools/ai-tools';

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private tools: any[];
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Get tools and prompt from library
    this.tools = getToolDefinitions();
    this.systemPrompt = getSystemPrompt(this.tools);
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ws: WebSocket
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam | null> {
    console.log('[OpenAI] Starting streamChatCompletion...');
    const messageId = `msg_${Date.now()}`;
    const toolCallsAccumulator = new Map<number, any>();
    let contentAccumulator = '';

    try {
      console.log('[OpenAI] Creating chat completion request...');
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        stream: true,
        tools: this.tools,
        max_tokens: 500,
        temperature: 0.7,
      });

      console.log('[OpenAI] Stream created successfully, starting to process chunks...');

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle text content
        if (delta.content) {
          contentAccumulator += delta.content;
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: delta.content,
            messageId,
            isComplete: false
          }));
        }

        // Handle tool calls (accumulate deltas)
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            if (!toolCallsAccumulator.has(tcDelta.index)) {
              toolCallsAccumulator.set(tcDelta.index, {
                id: tcDelta.id || '',
                type: tcDelta.type || 'function',
                function: { name: '', arguments: '' }
              });
            }

            const acc = toolCallsAccumulator.get(tcDelta.index);
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) {
              acc.function.name += tcDelta.function.name;
            }
            if (tcDelta.function?.arguments) {
              acc.function.arguments += tcDelta.function.arguments;
            }
          }
        }

        // Check if stream finished
        if (chunk.choices[0]?.finish_reason) {
          // Send completion signal
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            content: '',
            messageId,
            isComplete: true
          }));

          // Process accumulated tool calls
          if (toolCallsAccumulator.size > 0) {
            for (const [index, toolCall] of toolCallsAccumulator.entries()) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                ws.send(JSON.stringify({
                  type: 'tool_call',
                  tool: toolCall.function.name,
                  parameters: args,
                  callId: toolCall.id
                }));
              } catch (error) {
                console.error('[OpenAI] Error parsing tool call arguments:', error);
              }
            }
          }

          // Build and return assistant message for conversation history
          // Note: We don't include tool_calls in history because OpenAI requires
          // tool response messages to follow, which we don't have in this flow
          const assistantMessage: OpenAI.Chat.ChatCompletionMessageParam = {
            role: 'assistant' as const,
            content: contentAccumulator || 'I performed the requested actions.',
          };

          return assistantMessage;
        }
      }
    } catch (error: any) {
      console.error('[OpenAI] Stream error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        content: this.getErrorMessage(error),
        code: error.code
      }));
      return null;
    }

    return null;
  }

  private getErrorMessage(error: any): string {
    if (error.status === 429) {
      return "I'm receiving too many requests. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "Authentication error. Please check API configuration.";
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return "Connection timeout. Please try again.";
    }
    return "I'm having trouble processing your request. Please try again.";
  }
}
