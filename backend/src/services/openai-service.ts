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
import type { InitialState } from '../types/messages.js';
import { getCustomToolNames, getCustomTool } from './custom-tools.js';

/**
 * Convert Zod schema to JSON Schema for OpenAI function parameters
 * Simple conversion for common Zod types used in custom tools
 */
function zodSchemaToJsonSchema(zodSchema: any): any {
  const shape = zodSchema.shape || zodSchema._def?.shape?.();
  if (!shape) return { type: 'object', properties: {} };

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape) as [string, any][]) {
    const def = value._def;
    let prop: any = {};

    // Handle optional wrapper
    const isOptional = def?.typeName === 'ZodOptional';
    const innerDef = isOptional ? def.innerType._def : def;
    const innerTypeName = innerDef?.typeName;

    // Get description
    const description = innerDef?.description || def?.description;
    if (description) prop.description = description;

    // Map Zod types to JSON Schema types
    switch (innerTypeName) {
      case 'ZodString':
        prop.type = 'string';
        break;
      case 'ZodNumber':
        prop.type = 'number';
        if (innerDef.checks) {
          for (const check of innerDef.checks) {
            if (check.kind === 'min') prop.minimum = check.value;
            if (check.kind === 'max') prop.maximum = check.value;
          }
        }
        break;
      case 'ZodBoolean':
        prop.type = 'boolean';
        break;
      case 'ZodArray':
        prop.type = 'array';
        const elementDef = innerDef.type?._def;
        if (elementDef?.typeName === 'ZodNumber') {
          prop.items = { type: 'number' };
        } else if (elementDef?.typeName === 'ZodString') {
          prop.items = { type: 'string' };
        }
        break;
      default:
        prop.type = 'string';
    }

    properties[key] = prop;
    if (!isOptional) required.push(key);
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private tools: any[];
  private systemPrompt: string;
  private customToolNames: Set<string>;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-5.1';

    // Get CARTO tools from definitions package
    const cartoTools = getAllToolDefinitions();

    // Convert custom tools to OpenAI function format
    const customToolNames = getCustomToolNames();
    this.customToolNames = new Set(customToolNames);

    const customToolDefinitions = customToolNames.map(toolName => {
      const customTool = getCustomTool(toolName);
      return {
        type: 'function' as const,
        function: {
          name: toolName,
          description: customTool.description,
          parameters: zodSchemaToJsonSchema(customTool.schema),
        }
      };
    });

    // Combine all tool definitions
    this.tools = [...cartoTools, ...customToolDefinitions];
    this.systemPrompt = buildSystemPrompt(this.tools);

    console.log('[OpenAI] Total tools:', this.tools.length);
    console.log('[OpenAI] CARTO tools:', cartoTools.length);
    console.log('[OpenAI] Custom tools:', customToolDefinitions.length);
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ws: WebSocket,
    initialState?: InitialState
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam | null> {
    console.log('[OpenAI] Starting streamChatCompletion...');
    const messageId = `msg_${Date.now()}`;
    const toolCallsAccumulator = new Map<number, any>();
    let contentAccumulator = '';

    // Build dynamic system prompt based on demo context
    const systemPrompt = initialState
      ? buildSystemPrompt(this.tools, initialState)
      : this.systemPrompt;

    console.log('[OpenAI] Using demo context:', initialState?.demoId || 'default');

    try {
      console.log('[OpenAI] Creating chat completion request...');
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
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

                console.log(`[OpenAI] Processing tool call: ${toolName}`, args);

                // Check if this is a custom tool or CARTO tool
                const isCustomTool = this.customToolNames.has(toolName);

                if (isCustomTool) {
                  // Handle custom tool - validate with its Zod schema
                  console.log(`[OpenAI] Validating custom tool: ${toolName}`);
                  console.log(`[OpenAI] Raw args:`, JSON.stringify(args, null, 2));
                  console.log(`[OpenAI] Arg types:`, Object.entries(args).map(([k, v]) => `${k}: ${typeof v} = ${JSON.stringify(v)}`).join(', '));
                  const customTool = getCustomTool(toolName);

                  try {
                    const validatedData = customTool.schema.parse(args);
                    console.log(`[OpenAI] Custom tool validation passed: ${toolName}`, validatedData);

                    // Send tool call to frontend for execution
                    ws.send(JSON.stringify({
                      type: 'tool_call',
                      toolName,
                      data: validatedData,
                      message: `Executing ${toolName}`,
                      callId: toolCall.id
                    }));
                  } catch (validationError: any) {
                    console.error(`[OpenAI] Custom tool validation failed for ${toolName}:`);
                    console.error(`[OpenAI] Full error:`, validationError);
                    console.error(`[OpenAI] Zod issues:`, JSON.stringify(validationError.issues, null, 2));
                    ws.send(JSON.stringify({
                      type: 'tool_call',
                      toolName,
                      error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid parameters: ${JSON.stringify(validationError.issues || validationError.message, null, 2)}`
                      },
                      callId: toolCall.id
                    }));
                  }
                } else {
                  // Handle CARTO tool - use existing validation
                  console.log(`[OpenAI] Validating CARTO tool: ${toolName}`);
                  const validation = validateWithZod(toolName, args);

                  if (!validation.valid) {
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
                    continue;
                  }

                  console.log(`[OpenAI] Validation passed for ${toolName}`);

                  // Send standardized ToolResponse format with validated data
                  const response: ToolResponse = formatToolResponse(toolName, {
                    data: validation.data,
                    message: `Executing ${toolName}`
                  });

                  ws.send(JSON.stringify({
                    type: 'tool_call',
                    ...response,
                    callId: toolCall.id
                  }));
                }
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
