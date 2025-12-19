// backend/src/services/openai-responses-service.ts
import OpenAI from 'openai';
import { Response } from 'express';
import {
  getAllToolDefinitions,
  formatToolResponse,
  validateWithZod,
} from '@carto/maps-ai-tools';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { getCustomToolNames, getCustomTool, initializeMCPTools } from './custom-tools.js';
import * as z from 'zod';

interface Message {
  role: string;
  content: string;
}

export class OpenAIResponsesService {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;
  private allToolDefinitions: any[];

  private initialized: boolean = false;

  constructor() {
    // Check if we should use LiteLLM endpoint or OpenAI
    const useLiteLLM = process.env.USE_LITELLM_FOR_RESPONSES === 'true';

    let apiKey: string;
    let baseURL: string | undefined;
    let defaultHeaders: Record<string, string> | undefined;

    if (useLiteLLM) {
      // Use LiteLLM/CARTO endpoint
      apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required when USE_LITELLM_FOR_RESPONSES=true');
      }

      baseURL = process.env.CARTO_LITELLM_URL || 'https://litellm-gcp-us-east1.api.carto.com/v1';
      defaultHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'x-litellm-api-key': apiKey,
      };

      console.log('[OpenAI Responses] Using LiteLLM endpoint:', baseURL);
    } else {
      // Use standard OpenAI endpoint
      apiKey = process.env.OPENAI_API_KEY || '';
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      console.log('[OpenAI Responses] Using OpenAI endpoint');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders,
    });
    this.model = process.env.OPENAI_RESPONSES_MODEL || 'gpt-4.1';

    // Get CARTO library tool definitions (in OpenAI Chat format)
    const cartoToolDefinitions = getAllToolDefinitions();

    // Initialize with CARTO tools only - custom tools will be added asynchronously
    const chatFormatTools = [...cartoToolDefinitions];
    this.systemPrompt = buildSystemPrompt(chatFormatTools);
    this.allToolDefinitions = chatFormatTools.map(tool => ({
      type: 'function' as const,
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));

    console.log('[OpenAI Responses] Service created (initialization pending)');
    console.log('[OpenAI Responses] Model:', this.model);
  }

  /**
   * Initialize custom tools (async operation)
   */
  private async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[OpenAI Responses] Initializing custom tools...');

      // Initialize MCP tools first
      await initializeMCPTools();

      // Get CARTO library tool definitions (in OpenAI Chat format)
      const cartoToolDefinitions = getAllToolDefinitions();

      // Get all custom tool names (now includes MCP tools)
      const customToolNames = getCustomToolNames();

      // Convert custom tools to OpenAI Chat format
      const customToolDefinitions = customToolNames.map(toolName => {
        const customTool = getCustomTool(toolName);

        // Determine if schema needs conversion
        let parameters: any;
        try {
          // First, check if tool has jsonSchema property (from MCP)
          if (customTool.jsonSchema) {
            console.log(`[OpenAI Responses] Using JSON Schema for MCP tool: ${toolName}`);
            parameters = customTool.jsonSchema;
          }
          // Check if it's a Zod object schema
          else if (customTool.schema && typeof customTool.schema === 'object' && '_def' in customTool.schema) {
            console.log(`[OpenAI Responses] Converting Zod schema for tool: ${toolName}`);
            // It's a Zod schema, convert it using native Zod 4 method
            parameters = z.toJSONSchema(customTool.schema, { target: 'openapi-3.0' });
          } else if (customTool.schema && typeof customTool.schema === 'object') {
            console.log(`[OpenAI Responses] Using plain JSON Schema for tool: ${toolName}`);
            // It's already a plain object (JSON Schema)
            parameters = customTool.schema;
          } else {
            console.warn(`[OpenAI Responses] No valid schema found for ${toolName}, using empty schema`);
            // Fallback to generic object schema
            parameters = { type: 'object', properties: {}, additionalProperties: true };
          }

          // Ensure required fields are present
          if (!parameters.type) {
            parameters.type = 'object';
          }
          if (!parameters.properties) {
            parameters.properties = {};
          }
        } catch (error) {
          console.error(`[OpenAI Responses] Error processing schema for ${toolName}:`, error);
          parameters = { type: 'object', properties: {}, additionalProperties: true };
        }

        return {
          type: 'function' as const,
          function: {
            name: toolName,
            description: customTool.description,
            parameters
          }
        };
      });

      // Combine all tool definitions in Chat format for system prompt
      const chatFormatTools = [...cartoToolDefinitions, ...customToolDefinitions];
      this.systemPrompt = buildSystemPrompt(chatFormatTools);

      // Convert to Responses API format (name at top level, not nested in function)
      // Responses API format: { type: 'function', name: '...', description: '...', parameters: {...} }
      this.allToolDefinitions = chatFormatTools.map(tool => ({
        type: 'function' as const,
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }));

      this.initialized = true;

      console.log('[OpenAI Responses] Service initialized');
      console.log('[OpenAI Responses] Model:', this.model);
      console.log('[OpenAI Responses] Total tools:', this.allToolDefinitions.length);
      console.log('[OpenAI Responses] CARTO tools:', cartoToolDefinitions.length);
      console.log('[OpenAI Responses] Custom tools:', customToolDefinitions.length);

      // Log custom tool schemas for debugging
      for (const tool of customToolDefinitions) {
        console.log(`[OpenAI Responses] Custom tool schema for ${tool.function.name}:`, JSON.stringify(tool.function.parameters, null, 2));
      }
    } catch (error) {
      console.error('[OpenAI Responses] Error initializing custom tools:', error);
      this.initialized = true; // Mark as initialized even on error to prevent retry loops
    }
  }

  /**
   * Stream chat completion using OpenAI Responses API
   */
  async streamChatCompletion(
    messages: Message[],
    res: Response,
    previousResponseId?: string
  ): Promise<{ message: any; responseId?: string; hadToolCalls?: boolean } | null> {
    console.log('[OpenAI Responses] Starting streamChatCompletion...');
    console.log('[OpenAI Responses] Previous response ID:', previousResponseId || '(none)');

    // Ensure tools are initialized before processing
    await this.initialize();

    const messageId = `msg_${Date.now()}`;

    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // CRITICAL: Only send the LAST user message to prevent AI from inferring
      // actions from previous conversation context
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1);

      console.log('[OpenAI Responses] Total messages in history:', messages.length);
      console.log('[OpenAI Responses] Sending to AI: last user message only');
      console.log('[OpenAI Responses] Last user message:', lastUserMessage[0]?.content);

      // Build request options for OpenAI Responses API
      const requestOptions: any = {
        model: this.model,
        input: lastUserMessage[0]?.content || '',
        instructions: this.systemPrompt,
        stream: true,
        tools: this.allToolDefinitions,
      };

      // Add previous_response_id if provided (for conversation chaining)
      if (previousResponseId) {
        requestOptions.previous_response_id = previousResponseId;
        console.log('[OpenAI Responses] Including previous_response_id:', previousResponseId);
      }

      console.log('[OpenAI Responses] Creating response with SDK...');
      console.log('[OpenAI Responses] Model:', this.model);
      console.log('[OpenAI Responses] Tools count:', this.allToolDefinitions.length);

      // Call OpenAI Responses API using SDK with streaming
      const stream = this.client.responses.stream(requestOptions);

      let responseId: string | undefined;
      let assistantMessage = '';
      const toolCallsMap = new Map<string, any>();

      // Process streaming response using SDK events
      console.log('[OpenAI Responses] Setting up event listeners for streaming...');

      stream.on('response.created', (event: any) => {
        console.log('[OpenAI Responses] Event: response.created');
        if (event.response?.id) {
          responseId = event.response.id;
          console.log('[OpenAI Responses] Response ID:', responseId);
        }
      });

      stream.on('response.output_text.delta', (event: any) => {
        const delta = event.delta;
        if (delta) {
          assistantMessage += delta;
          const textMessage = {
            type: 'stream_chunk',
            content: delta,
            messageId,
            isComplete: false
          };
          res.write(JSON.stringify(textMessage) + '\n');
        }
      });

      stream.on('response.output_item.added', (event: any) => {
        const item = event.item;
        console.log('[OpenAI Responses] Output item added event:', JSON.stringify(event, null, 2));
        if (item?.type === 'function_call') {
          const callId = item.call_id || item.id || `call_${Date.now()}`;
          const initialArgs = item.arguments || '';
          toolCallsMap.set(callId, {
            id: callId,
            name: item.name || '',
            arguments: initialArgs
          });
          console.log('[OpenAI Responses] Function call started:', item.name, 'Call ID:', callId, 'Initial args:', initialArgs);
        }
      });

      stream.on('response.function_call_arguments.delta', (event: any) => {
        const delta = event.delta;
        const lastCallId = Array.from(toolCallsMap.keys()).pop();
        console.log('[OpenAI Responses] Function arguments delta:', delta, 'for call:', lastCallId);
        if (lastCallId && delta) {
          const toolCall = toolCallsMap.get(lastCallId);
          if (toolCall) {
            toolCall.arguments += delta;
            console.log('[OpenAI Responses] Accumulated arguments so far:', toolCall.arguments);
          }
        }
      });

      // Wait for the stream to complete and get final response
      const finalResponse = await stream.finalResponse();

      console.log('[OpenAI Responses] Final response received');
      console.log('[OpenAI Responses] Final response structure:', JSON.stringify(finalResponse, null, 2));

      // Extract response ID from final response if not already set
      if (finalResponse?.id && !responseId) {
        responseId = finalResponse.id;
        console.log('[OpenAI Responses] Response ID from final:', responseId);
      }

      // Process final output for any missed content
      if (finalResponse?.output) {
        console.log('[OpenAI Responses] Processing final output, items:', finalResponse.output.length);
        for (const output of finalResponse.output) {
          if (output.type === 'message' && (output as any).content) {
            for (const content of (output as any).content) {
              if (content.type === 'output_text' && content.text) {
                if (!assistantMessage) {
                  assistantMessage = content.text;
                }
              }
            }
          }

          if (output.type === 'function_call') {
            const fc = output as any;
            const callId = fc.call_id || fc.id || '';
            console.log('[OpenAI Responses] Final response function_call:', fc);

            // Only add if not already in map, or update if arguments are more complete
            if (!toolCallsMap.has(callId)) {
              console.log('[OpenAI Responses] Adding new function call from final response');
              toolCallsMap.set(callId, {
                id: callId,
                name: fc.name || '',
                arguments: fc.arguments || ''
              });
            } else {
              // Update if final response has arguments and current doesn't
              const existing = toolCallsMap.get(callId)!;
              if (fc.arguments && !existing.arguments) {
                console.log('[OpenAI Responses] Updating function call arguments from final response');
                existing.arguments = fc.arguments;
              }
            }
          }
        }
      }

      // Convert accumulated tool calls to array and parse arguments
      const toolCalls = Array.from(toolCallsMap.values()).map(tc => {
        console.log(`[OpenAI Responses] Raw tool call - Name: ${tc.name}, Arguments string: "${tc.arguments}"`);

        let parsedArgs = {};
        try {
          if (tc.arguments && tc.arguments.trim()) {
            parsedArgs = JSON.parse(tc.arguments);
            console.log(`[OpenAI Responses] Parsed arguments for ${tc.name}:`, JSON.stringify(parsedArgs));
          } else {
            console.warn(`[OpenAI Responses] Empty or missing arguments for ${tc.name}`);
          }
        } catch (e) {
          console.error(`[OpenAI Responses] Error parsing tool arguments for ${tc.name}:`, tc.arguments, e);
        }

        return {
          id: tc.id,
          name: tc.name,
          input: parsedArgs
        };
      });

      console.log('[OpenAI Responses] Stream completed');
      console.log('[OpenAI Responses] Response ID:', responseId);
      console.log('[OpenAI Responses] Assistant message length:', assistantMessage.length);
      console.log('[OpenAI Responses] Tool calls:', toolCalls.length);
      console.log('[OpenAI Responses] Tool calls details:', JSON.stringify(toolCalls, null, 2));

      // Process tool calls
      if (toolCalls.length > 0) {
        console.log('[OpenAI Responses] Processing tool calls:', toolCalls.length);

        for (const toolCall of toolCalls) {
          try {
            const toolName = toolCall.name;
            const args = toolCall.input;

            console.log(`[OpenAI Responses] Processing tool: ${toolName}`, args);

            // Check if this is a custom tool
            const customToolNames = getCustomToolNames();
            const isCustomTool = customToolNames.includes(toolName as any);

            if (isCustomTool) {
              // Handle custom tool execution (backend-side)
              console.log(`[OpenAI Responses] Executing custom tool: ${toolName}`);

              const customTool = getCustomTool(toolName);

              try {
                const validatedArgs = customTool.schema.parse(args);
                console.log(`[OpenAI Responses] Validation passed for custom tool: ${toolName}`);

                if (customTool.execute) {
                  console.log(`[OpenAI Responses] Executing custom tool function for: ${toolName}`);
                  const executeResult = await customTool.execute(validatedArgs);
                  console.log(`[OpenAI Responses] Custom tool execution complete:`, executeResult);

                  const toolMessage = {
                    type: 'tool_result',
                    toolName,
                    data: executeResult,
                    message: `Executed ${toolName}`,
                    callId: toolCall.id
                  };
                  console.log(`[OpenAI Responses] Sending tool result to client:`, toolMessage);
                  res.write(JSON.stringify(toolMessage) + '\n');
                  console.log(`[OpenAI Responses] Tool result sent successfully`);
                }
              } catch (validationError: any) {
                console.error(`[OpenAI Responses] Validation failed for custom tool ${toolName}:`, validationError);
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
              console.log(`[OpenAI Responses] Validating CARTO tool: ${toolName}`);
              const validation = validateWithZod(toolName, args);

              if (!validation.valid) {
                console.error(`[OpenAI Responses] Validation failed for ${toolName}:`, validation.errors);
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

              console.log(`[OpenAI Responses] Validation passed for ${toolName}`);

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
              console.log(`[OpenAI Responses] Sending tool call to client:`, toolMessage);
              res.write(JSON.stringify(toolMessage) + '\n');
              console.log(`[OpenAI Responses] Tool call sent successfully`);
            }
          } catch (error) {
            console.error('[OpenAI Responses] Error processing tool call:', error);
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
      console.log('[OpenAI Responses] Sending completion signal');
      res.write(JSON.stringify(completeMessage) + '\n');

      // End the response
      console.log('[OpenAI Responses] Ending response stream');
      res.end();
      console.log('[OpenAI Responses] Response stream ended successfully');

      // Return assistant message, response ID, and whether there were tool calls
      return {
        message: {
          role: 'assistant',
          content: assistantMessage || 'I processed your request.',
        },
        responseId,
        hadToolCalls: toolCalls.length > 0
      };

    } catch (error: any) {
      console.error('[OpenAI Responses] Error:', error);

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
