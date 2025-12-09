// backend/src/services/openai-service.ts
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import {
  getAllToolDefinitions,
  TOOL_NAMES,
  formatToolResponse,
  ErrorCodes,
  validateWithZod,
} from '@carto/maps-ai-tools';
import type { ToolResponse } from '@carto/maps-ai-tools';
import { buildSystemPrompt } from '../prompts/system-prompt.js';

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
    this.model = process.env.OPENAI_MODEL || 'gpt-5.1';

    // Get tools from definitions package
    this.tools = getAllToolDefinitions();
    this.systemPrompt = buildSystemPrompt(this.tools);
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
        max_completion_tokens: 500,
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

          // Process accumulated tool calls with standardized response format
          if (toolCallsAccumulator.size > 0) {
            for (const [, toolCall] of toolCallsAccumulator.entries()) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const toolName = toolCall.function.name;

                // Validate tool parameters using Zod schema
                console.log(`[OpenAI] Validating tool call: ${toolName}`, args);
                const validation = validateWithZod(toolName, args);

                if (!validation.valid) {
                  // Send validation error to frontend
                  console.error(`[OpenAI] Validation failed for ${toolName}:`, validation.errors);
                  ws.send(JSON.stringify({
                    type: 'tool_call',
                    toolName,
                    error: {
                      code: 'VALIDATION_ERROR',
                      message: `Invalid parameters: ${validation.errors.join(', ')}`
                    },
                    callId: toolCall.id
                  }));
                  continue; // Skip this tool call
                }

                console.log(`[OpenAI] Validation passed for ${toolName}`);

                // Send standardized ToolResponse format with validated data
                const response: ToolResponse = formatToolResponse(toolName, {
                  data: validation.data, // Use validated & typed data
                  message: `Executing ${toolName}`
                });

                ws.send(JSON.stringify({
                  type: 'tool_call',
                  ...response,
                  callId: toolCall.id
                }));
              } catch (error) {
                console.error('[OpenAI] Error parsing tool call arguments:', error);
                ws.send(JSON.stringify({
                  type: 'tool_call',
                  toolName: toolCall.function.name,
                  error: {
                    code: 'PARSE_ERROR',
                    message: `Failed to parse tool arguments: ${(error as Error).message}`
                  },
                  callId: toolCall.id
                }));
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
