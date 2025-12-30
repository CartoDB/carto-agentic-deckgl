// backend/src/services/vercel-ai-service.ts
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, tool } from 'ai';
import { Response } from 'express';
import {
  getAllToolDefinitions,
  tools as cartoTools,
  formatToolResponse,
  validateWithZod,
} from '@carto/maps-ai-tools';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { getCustomToolNames, getCustomTool } from './custom-tools.js';

export class VercelAIService {
  private carto: any;
  private model: any;
  private tools: Record<string, any>;
  private systemPrompt: string;

  constructor() {
    // Validate required env vars
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    // Create OpenAI-compatible provider for CARTO LiteLLM
    this.carto = createOpenAI({
      baseURL: process.env.CARTO_LITELLM_URL,
      apiKey: apiKey,
      headers: {
        'x-litellm-api-key': apiKey,
      },
    });

    this.model = this.carto(process.env.GEMINI_MODEL);

    // Get CARTO library tool definitions
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

    // Combine all tool definitions
    const allToolDefinitions = [...cartoToolDefinitions, ...customToolDefinitions];


    this.tools = this.convertToolsToVercelFormat();
    this.systemPrompt = buildSystemPrompt(allToolDefinitions);

    console.log('[VercelAI] Total tools for system prompt:', allToolDefinitions.length);
    console.log('[VercelAI] CARTO tools:', cartoToolDefinitions.length);
    console.log('[VercelAI] Custom tools:', customToolDefinitions.length);
  }

  /**
   * Convert CARTO tools and custom tools to Vercel AI SDK format
   * CARTO tools: {name, description, schema: ZodSchema}
   * Custom tools: {name, description, schema: ZodSchema, execute?: function}
   * Vercel AI SDK expects: {toolName: tool({description, inputSchema: ZodSchema, execute?: function})}
   */
  private convertToolsToVercelFormat(): Record<string, any> {
    const vercelTools: Record<string, any> = {};

    // Add CARTO library tools
    for (const [toolName, cartoTool] of Object.entries(cartoTools) as [string, any][]) {
      console.log(`[VercelAI] Adding CARTO tool: ${toolName}`);

      vercelTools[toolName] = tool({
        description: cartoTool.description,
        inputSchema: cartoTool.schema,  // Use the existing Zod schema
      });
    }

    // Add custom tools
    for (const toolName of getCustomToolNames()) {
      const customTool = getCustomTool(toolName);
      console.log(`[VercelAI] Adding custom tool: ${toolName}`);

      const toolConfig: any = {
        description: customTool.description,
        inputSchema: customTool.schema,
      };

      // Add execute function if provided (for backend-executed tools)
      if (customTool.execute) {
        toolConfig.execute = customTool.execute;
      }

      vercelTools[toolName] = tool(toolConfig);
    }

    console.log('[VercelAI] Tool conversion complete:', Object.keys(vercelTools).join(', '));
    return vercelTools;
  }

  /**
   * Generate chat completion with full conversation history (non-streaming)
   * Sends newline-delimited JSON messages (compatible with WebSocket message format)
   *
   * @param messages - Conversation messages
   * @param res - Express response object
   * @param previousResponseId - Optional previous response ID for Gemini Responses API chaining
   */
  async streamChatCompletion(
    messages: any[],
    res: Response,
    previousResponseId?: string
  ): Promise<{ message: any; responseId?: string } | null> {
    console.log('[VercelAI] Starting generateText...');

    const messageId = `msg_${Date.now()}`;

    try {      
      // Set headers for JSON response
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Generate response using Vercel AI SDK with tools
      let result;
      let responseId: string | undefined;

      try {
        console.log('[VercelAI] Previous response ID:', previousResponseId || '(none)');

        // CRITICAL: Only send the LAST user message to prevent AI from inferring
        // actions from previous conversation context (e.g., seeing "Chicago" and calling weather)
        // This makes each request independent and prevents unwanted tool calls
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1);

        console.log('[VercelAI] Total messages in history:', messages.length);
        console.log('[VercelAI] Sending to AI: last user message only');
        console.log('[VercelAI] Last user message:', lastUserMessage[0]?.content);

        const requestConfig: any = {
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...lastUserMessage
          ],
          tools: this.tools,
          previous_response_id: previousResponseId
        };

        // Add previous_response_id if provided (for Gemini Responses API)
        if (previousResponseId) {
          requestConfig.experimental_providerMetadata = {
            openai: {
              previous_response_id: previousResponseId
            }
          };
        }

        result = await generateText(requestConfig);

        console.log('[VercelAI] generateText completed');
        console.log('[VercelAI] Response text:', result.text || '(no text)');
        console.log('[VercelAI] Tool calls:', result.toolCalls?.length || 0);

        // Extract response_id for Gemini Responses API chaining
        responseId = (result.response as any)?.id;
        if (responseId) {
          console.log('[VercelAI] Response ID:', responseId);
        }

      } catch (initError: any) {
        console.error('[VercelAI] Error generating text:', initError);
        console.error('[VercelAI] Error details:', JSON.stringify(initError, null, 2));

        // Check if this is the known "text: null" issue with Gemini responses
        // This happens when Gemini tries to call tools via CARTO LiteLLM's /v1/responses endpoint
        if (initError.message?.includes('Invalid input: expected string, received null') ||
            initError.cause?.value?.output?.[0]?.content?.[0]?.text === null) {
          console.log('[VercelAI] Detected Gemini response format incompatibility');
          console.log('[VercelAI] Note: Custom backend tools cannot be used with current API configuration');
          console.log('[VercelAI] Gemini returned "text: null" when attempting to call a tool');

          // Return a user-friendly error
          const errorMessage = {
            type: 'error',
            content: 'I understand you want to use that feature, but there\'s a compatibility issue with the current API configuration. Please try asking about map features instead.',
            code: 'TOOL_CALL_INCOMPATIBLE'
          };
          res.write(JSON.stringify(errorMessage) + '\n');
          res.end();
          return null;
        }

        const errorMessage = {
          type: 'error',
          content: `Failed to generate AI response: ${initError.message || 'Unknown error'}`,
          code: 'GENERATION_ERROR'
        };
        res.write(JSON.stringify(errorMessage) + '\n');
        res.end();
        return null;
      }

      // Send the text response if present
      if (result.text) {
        const textMessage = {
          type: 'stream_chunk',
          content: result.text,
          messageId,
          isComplete: false
        };
        res.write(JSON.stringify(textMessage) + '\n');
      }

      // Handle tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        console.log('[VercelAI] Processing tool calls:', result.toolCalls.length);

        for (const toolCall of result.toolCalls) {
          try {
            console.log('[VercelAI] Tool call:', toolCall);
            const toolName = toolCall.toolName;
            const args = toolCall.input;

            console.log(`[VercelAI] Processing tool: ${toolName}`, args);

            // Check if this is a custom tool
            const isCustomTool = getCustomToolNames().includes(toolName as any);

            if (isCustomTool) {
              // Handle custom tool
              console.log(`[VercelAI] Processing custom tool: ${toolName}`);

              const customTool = getCustomTool(toolName);

              // Validate custom tool input against its schema
              try {
                const validatedArgs = customTool.schema.parse(args);
                console.log(`[VercelAI] Validation passed for custom tool: ${toolName}`);

                if (customTool.execute) {
                  // Backend-executed tool - execute and send result
                  console.log(`[VercelAI] Executing custom tool function for: ${toolName}`);
                  const executeResult = await customTool.execute(validatedArgs);
                  console.log(`[VercelAI] Custom tool execution complete:`, executeResult);

                  const toolMessage = {
                    type: 'tool_result',
                    toolName,
                    data: executeResult,
                    message: `Executed ${toolName}`,
                    callId: toolCall.toolCallId
                  };
                  console.log(`[VercelAI] Sending tool result to client:`, toolMessage);
                  res.write(JSON.stringify(toolMessage) + '\n');
                  console.log(`[VercelAI] Tool result sent successfully`);
                } else {
                  // Frontend-executed tool - send tool call to frontend
                  console.log(`[VercelAI] Sending custom tool to frontend for execution: ${toolName}`);
                  const toolMessage = {
                    type: 'tool_call',
                    toolName,
                    data: validatedArgs,
                    callId: toolCall.toolCallId
                  };
                  res.write(JSON.stringify(toolMessage) + '\n');
                  console.log(`[VercelAI] Tool call sent to frontend successfully`);
                }
              } catch (validationError: any) {
                console.error(`[VercelAI] Validation failed for custom tool ${toolName}:`, validationError);
                const errorMessage = {
                  type: 'tool_call',
                  toolName,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid parameters: ${validationError.errors?.map((e: any) => e.message).join(', ') || validationError.message}`
                  },
                  callId: toolCall.toolCallId
                };
                res.write(JSON.stringify(errorMessage) + '\n');
                continue;
              }
            } else {
              // Handle CARTO library tool (frontend-side execution)
              console.log(`[VercelAI] Validating CARTO tool: ${toolName}`);
              const validation = validateWithZod(toolName, args);

              if (!validation.valid) {
                console.error(`[VercelAI] Validation failed for ${toolName}:`, validation.errors);
                const errorMessage = {
                  type: 'tool_call',
                  toolName,
                  error: {
                    code: 'VALIDATION_ERROR',
                    message: `Invalid parameters: ${validation.errors.join(', ')}`
                  },
                  callId: toolCall.toolCallId
                };
                res.write(JSON.stringify(errorMessage) + '\n');
                continue;
              }

              console.log(`[VercelAI] Validation passed for ${toolName}`);

              // Send standardized ToolResponse format for frontend execution
              const toolResponse = formatToolResponse(toolName, {
                data: validation.data,
                message: `Executing ${toolName}`
              });

              const toolMessage = {
                type: 'tool_call',
                ...toolResponse,
                callId: toolCall.toolCallId
              };
              console.log(`[VercelAI] Sending tool call to client:`, toolMessage);
              res.write(JSON.stringify(toolMessage) + '\n');
              console.log(`[VercelAI] Tool call sent successfully`);
            }

          } catch (error) {
            console.error('[VercelAI] Error processing tool call:', error);
            const errorMessage = {
              type: 'tool_call',
              toolName: toolCall.toolName,
              error: {
                code: 'EXECUTION_ERROR',
                message: `Failed to process tool: ${(error as Error).message}`
              },
              callId: toolCall.toolCallId
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
      console.log('[VercelAI] Sending completion signal');
      res.write(JSON.stringify(completeMessage) + '\n');

      // End the response
      console.log('[VercelAI] Ending response stream');
      res.end();
      console.log('[VercelAI] Response stream ended successfully');

      // Return assistant message and response ID for conversation history
      return {
        message: {
          role: 'assistant',
          content: result.text || 'I processed your request.',
        },
        responseId
      };

    } catch (error: any) {
      console.error('[VercelAI] Generation error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: this.getErrorMessage(error),
          code: error.code
        });
      } else {
        // Send error as JSON message
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
   * Extract meaningful error message from complex error objects
   */
  private extractErrorMessage(error: any): string {
    // Check for LiteLLM errors in the error message
    if (error.message && typeof error.message === 'string') {
      // Extract inner error message from LiteLLM format
      if (error.message.includes('litellm.')) {
        const match = error.message.match(/"message":\s*"([^"]+)"/);
        if (match && match[1]) {
          return `AI Provider Error: ${match[1]}`;
        }
      }
      return error.message;
    }

    // Check for nested error objects
    if (error.value?.error?.message) {
      return this.extractErrorMessage(error.value.error);
    }

    if (error.cause?.message) {
      return this.extractErrorMessage(error.cause);
    }

    return "An unexpected error occurred. Please try again.";
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

    // Use extractErrorMessage for detailed errors
    return this.extractErrorMessage(error);
  }
}
