// backend/src/services/litellm-service.ts
import { Response } from 'express';
import {
  getAllToolDefinitions,
  tools as cartoTools,
  formatToolResponse,
  validateWithZod,
} from '@carto/maps-ai-tools';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { getCustomToolNames, getCustomTool } from './custom-tools.js';

interface Message {
  role: string;
  content: string;
}

interface StreamChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class LiteLLMService {
  private apiBase: string;
  private apiKey: string;
  private model: string;
  private systemPrompt: string;
  private allToolDefinitions: any[];

  constructor() {
    // Validate required env vars
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.apiBase = process.env.CARTO_LITELLM_URL || 'https://litellm-gcp-us-east1.api.carto.com/v1';
    this.model = process.env.GEMINI_MODEL || 'carto::gemini-2.5-flash';

    // Get CARTO library tool definitions (in OpenAI format)
    const cartoToolDefinitions = getAllToolDefinitions();

    // Convert custom tools to the same format as CARTO tool definitions
    const customToolDefinitions = getCustomToolNames().map(toolName => {
      const customTool = getCustomTool(toolName);
      return {
        type: 'function',
        function: {
          name: toolName,
          description: customTool.description,
          parameters: {
            type: 'object',
            properties: customTool.schema.shape,
            required: Object.keys(customTool.schema.shape)
          }
        }
      };
    });

    // Combine all tool definitions (keep in OpenAI format)
    this.allToolDefinitions = [...cartoToolDefinitions, ...customToolDefinitions];
    this.systemPrompt = buildSystemPrompt(this.allToolDefinitions);

    console.log('[LiteLLM] Service initialized');
    console.log('[LiteLLM] API Base:', this.apiBase);
    console.log('[LiteLLM] Model:', this.model);
    console.log('[LiteLLM] Total tools:', this.allToolDefinitions.length);
    console.log('[LiteLLM] CARTO tools:', cartoToolDefinitions.length);
    console.log('[LiteLLM] Custom tools:', customToolDefinitions.length);
  }

  /**
   * Stream chat completion using LiteLLM responses API
   */
  async streamChatCompletion(
    messages: Message[],
    res: Response,
    previousResponseId?: string
  ): Promise<{ message: any; responseId?: string } | null> {
    console.log('[LiteLLM] Starting streamChatCompletion...');
    console.log('[LiteLLM] Previous response ID:', previousResponseId || '(none)');

    const messageId = `msg_${Date.now()}`;

    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // CRITICAL: Only send the LAST user message to prevent AI from inferring
      // actions from previous conversation context
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1);

      console.log('[LiteLLM] Total messages in history:', messages.length);
      console.log('[LiteLLM] Sending to AI: last user message only');
      console.log('[LiteLLM] Last user message:', lastUserMessage[0]?.content);

      // Build request body for LiteLLM chat/completions API (OpenAI format)
      const requestBody: any = {
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: lastUserMessage[0]?.content || '' }
        ],
        stream: true,
        tools: this.allToolDefinitions,
      };

      // Add previous_response_id if provided (for Gemini Responses API chaining)
      // This is a custom header for CARTO LiteLLM
      const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'x-litellm-api-key': this.apiKey,
      };

      if (previousResponseId) {
        headers['x-previous-response-id'] = previousResponseId;
        console.log('[LiteLLM] Including previous_response_id in header:', previousResponseId);
      }

      console.log('[LiteLLM] Request body:', JSON.stringify(requestBody, null, 2));

      // Make request to LiteLLM chat/completions API
      const response = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LiteLLM] API error:', response.status, errorText);
        throw new Error(`LiteLLM API error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Process streaming response (OpenAI format)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let responseId: string | undefined;
      let assistantMessage = '';
      const toolCallsMap = new Map<number, any>(); // Map of index to accumulated tool call

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === '[DONE]') continue;

          try {
            const chunk: StreamChunk = JSON.parse(data);

            // Extract response ID
            if (chunk.id && !responseId) {
              responseId = chunk.id;
              console.log('[LiteLLM] Response ID:', responseId);
            }

            // Process choices
            if (chunk.choices && chunk.choices.length > 0) {
              const choice = chunk.choices[0];
              const delta = choice.delta;

              if (delta) {
                // Handle text content
                if (delta.content) {
                  assistantMessage += delta.content;
                  const textMessage = {
                    type: 'stream_chunk',
                    content: delta.content,
                    messageId,
                    isComplete: false
                  };
                  res.write(JSON.stringify(textMessage) + '\n');
                }

                // Handle tool calls (accumulate incremental deltas)
                if (delta.tool_calls) {
                  for (const toolCallDelta of delta.tool_calls) {
                    const index = toolCallDelta.index ?? 0;

                    if (!toolCallsMap.has(index)) {
                      toolCallsMap.set(index, {
                        id: toolCallDelta.id || '',
                        type: toolCallDelta.type || 'function',
                        function: {
                          name: '',
                          arguments: ''
                        }
                      });
                    }

                    const toolCall = toolCallsMap.get(index)!;

                    if (toolCallDelta.id) {
                      toolCall.id = toolCallDelta.id;
                    }
                    if (toolCallDelta.function?.name) {
                      toolCall.function.name = toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function?.arguments) {
                      toolCall.function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                }
              }

              // Check for finish reason
              if (choice.finish_reason) {
                console.log('[LiteLLM] Finish reason:', choice.finish_reason);
              }
            }

            // Check for usage (indicates end of stream)
            if (chunk.usage) {
              console.log('[LiteLLM] Usage:', chunk.usage);
            }
          } catch (parseError) {
            console.error('[LiteLLM] Error parsing chunk:', parseError);
          }
        }
      }

      // Convert accumulated tool calls to array
      const toolCalls = Array.from(toolCallsMap.values()).map(tc => {
        // Parse arguments string to object
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (e) {
          console.error('[LiteLLM] Error parsing tool arguments:', tc.function.arguments);
        }

        return {
          id: tc.id,
          name: tc.function.name,
          input: parsedArgs
        };
      });

      console.log('[LiteLLM] Stream completed');
      console.log('[LiteLLM] Assistant message length:', assistantMessage.length);
      console.log('[LiteLLM] Tool calls:', toolCalls.length);

      // Process tool calls
      if (toolCalls.length > 0) {
        console.log('[LiteLLM] Processing tool calls:', toolCalls.length);

        for (const toolCall of toolCalls) {
          try {
            const toolName = toolCall.name;
            const args = toolCall.input;

            console.log(`[LiteLLM] Processing tool: ${toolName}`, args);

            // Check if this is a custom tool
            const isCustomTool = getCustomToolNames().includes(toolName as any);

            if (isCustomTool) {
              // Handle custom tool
              console.log(`[LiteLLM] Processing custom tool: ${toolName}`);

              const customTool = getCustomTool(toolName);

              try {
                const validatedArgs = customTool.schema.parse(args);
                console.log(`[LiteLLM] Validation passed for custom tool: ${toolName}`);

                if (customTool.execute) {
                  // Backend-executed tool - execute and send result
                  console.log(`[LiteLLM] Executing custom tool function for: ${toolName}`);
                  const executeResult = await customTool.execute(validatedArgs);
                  console.log(`[LiteLLM] Custom tool execution complete:`, executeResult);

                  const toolMessage = {
                    type: 'tool_result',
                    toolName,
                    data: executeResult,
                    message: `Executed ${toolName}`,
                    callId: toolCall.id
                  };
                  console.log(`[LiteLLM] Sending tool result to client:`, toolMessage);
                  res.write(JSON.stringify(toolMessage) + '\n');
                  console.log(`[LiteLLM] Tool result sent successfully`);
                } else {
                  // Frontend-executed tool - send tool call to frontend
                  console.log(`[LiteLLM] Sending custom tool to frontend for execution: ${toolName}`);
                  const toolMessage = {
                    type: 'tool_call',
                    toolName,
                    data: validatedArgs,
                    callId: toolCall.id
                  };
                  res.write(JSON.stringify(toolMessage) + '\n');
                  console.log(`[LiteLLM] Tool call sent to frontend successfully`);
                }
              } catch (validationError: any) {
                console.error(`[LiteLLM] Validation failed for custom tool ${toolName}:`, validationError);
                const errorMessage = {
                  type: 'tool_call',
                  toolName,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid parameters: ${validationError.errors?.map((e: any) => e.message).join(', ') || validationError.message}`
                  },
                  callId: toolCall.id
                };
                res.write(JSON.stringify(errorMessage) + '\n');
                continue;
              }
            } else {
              // Handle CARTO library tool (frontend-side execution)
              console.log(`[LiteLLM] Validating CARTO tool: ${toolName}`);
              const validation = validateWithZod(toolName, args);

              if (!validation.valid) {
                console.error(`[LiteLLM] Validation failed for ${toolName}:`, validation.errors);
                const errorMessage = {
                  type: 'tool_call',
                  toolName,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid parameters: ${validation.errors.join(', ')}`
                  },
                  callId: toolCall.id
                };
                res.write(JSON.stringify(errorMessage) + '\n');
                continue;
              }

              console.log(`[LiteLLM] Validation passed for ${toolName}`);

              // Send standardized ToolResponse format for frontend execution
              const toolResponse = formatToolResponse(toolName, {
                data: validation.data,
                message: `Executing ${toolName}`
              });

              const toolMessage = {
                type: 'tool_call',
                ...toolResponse,
                callId: toolCall.id
              };
              console.log(`[LiteLLM] Sending tool call to client:`, toolMessage);
              res.write(JSON.stringify(toolMessage) + '\n');
              console.log(`[LiteLLM] Tool call sent successfully`);
            }
          } catch (error) {
            console.error('[LiteLLM] Error processing tool call:', error);
            const errorMessage = {
              type: 'tool_call',
              toolName: toolCall.name,
              error: {
                code: 'EXECUTION_ERROR',
                message: `Failed to process tool: ${(error as Error).message}`
              },
              callId: toolCall.id
            };
            res.write(JSON.stringify(errorMessage) + '\n');
          }
        }
      }

      // Send completion signal
      const completeMessage = {
        type: 'stream_chunk',
        content: '',
        messageId,
        isComplete: true
      };
      console.log('[LiteLLM] Sending completion signal');
      res.write(JSON.stringify(completeMessage) + '\n');

      // End the response
      console.log('[LiteLLM] Ending response stream');
      res.end();
      console.log('[LiteLLM] Response stream ended successfully');

      // Return assistant message and response ID for conversation history
      return {
        message: {
          role: 'assistant',
          content: assistantMessage || 'I processed your request.',
        },
        responseId
      };

    } catch (error: any) {
      console.error('[LiteLLM] Error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: this.getErrorMessage(error),
          code: error.code
        });
      } else {
        const errorMessage = {
          type: 'error',
          content: this.getErrorMessage(error),
          code: error.code
        };
        res.write(JSON.stringify(errorMessage) + '\n');
        res.end();
      }

      return null;
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "Authentication error. Please check API configuration.";
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return "Connection timeout. Please try again.";
    }

    return error.message || "An unexpected error occurred. Please try again.";
  }
}
