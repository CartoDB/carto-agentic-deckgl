// backend/src/services/litellm-model.ts
import OpenAI from 'openai';
import { BaseLlm } from '@google/adk';
import { BaseLlmConnection } from '@google/adk';
import { LlmRequest } from '@google/adk';
import { LlmResponse } from '@google/adk';
import { Content, Part } from '@google/genai';

/**
 * Custom LLM implementation that uses OpenAI SDK to connect to LiteLLM endpoints.
 * This allows Google ADK to work with CARTO's LiteLLM server.
 */
export class LiteLlmModel extends BaseLlm {
  private client: OpenAI;
  private baseURL: string;
  private apiKey: string;
  private allTools: any[] | null = null; // Store all tools to inject into every request
  private toolCallIdMap: Map<string, string> = new Map(); // Map function call IDs to tool_call_ids

  constructor({
    model,
    baseURL,
    apiKey,
  }: {
    model: string;
    baseURL: string;
    apiKey: string;
  }) {
    super({ model });

    this.baseURL = baseURL;
    this.apiKey = apiKey;

    // Create OpenAI client configured for LiteLLM endpoint
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });

    console.log('[LiteLLM Model] Initialized with:', {
      model,
      baseURL,
    });
  }

  /**
   * Store all tools to bypass ADK's semantic filtering
   */
  setAllTools(tools: any[]) {
    this.allTools = tools;
    console.log('[LiteLLM Model] Stored all tools:', tools.length);
  }

  /**
   * List of supported models - match any model name for LiteLLM
   */
  static readonly supportedModels = [/.*/]; // Accept any model

  /**
   * Generate deterministic tool call ID from function name and args
   */
  private generateToolCallId(name: string, args: any): string {
    // Create a deterministic ID based on function name and args hash
    const argsStr = JSON.stringify(args || {});
    // Simple hash - in practice you might want a better hash function
    let hash = 0;
    for (let i = 0; i < argsStr.length; i++) {
      hash = ((hash << 5) - hash) + argsStr.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return `call_${name}_${Math.abs(hash)}`;
  }

  /**
   * Convert ADK Content to OpenAI message format
   */
  private contentToOpenAIMessage(content: Content): OpenAI.Chat.ChatCompletionMessageParam | null {
    const role = content.role === 'model' ? 'assistant' : (content.role || 'user');

    if (!content.parts || content.parts.length === 0) {
      return { role: role as any, content: '' };
    }

    // If single text part, use simple string content
    if (content.parts.length === 1 && content.parts[0].text) {
      return { role: role as any, content: content.parts[0].text };
    }

    // Handle multiple parts or complex content
    const contentParts: any[] = [];

    for (const part of content.parts) {
      if (part.text) {
        contentParts.push({ type: 'text', text: part.text });
      } else if (part.functionCall) {
        // Function call from model - generate deterministic ID
        const callId = part.functionCall.id || this.generateToolCallId(
          part.functionCall.name || '',
          part.functionCall.args
        );
        // Store mapping for tool response matching
        if (part.functionCall.name) {
          this.toolCallIdMap.set(part.functionCall.name, callId);
        }
        return {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: callId,
            type: 'function',
            function: {
              name: part.functionCall.name || '',
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          }],
        } as any;
      } else if (part.functionResponse) {
        // Tool response - use stored ID or generate matching one
        const functionName = part.functionResponse.name || '';
        const toolCallId = this.toolCallIdMap.get(functionName) || `call_${functionName}`;

        return {
          role: 'tool',
          content: JSON.stringify(part.functionResponse.response || {}),
          tool_call_id: toolCallId,
        } as any;
      }
    }

    return {
      role: role as any,
      content: contentParts.length > 0 ? contentParts : ''
    };
  }

  /**
   * Convert OpenAI tools to ADK tool declarations
   */
  private getToolDeclarations(llmRequest: LlmRequest): OpenAI.Chat.ChatCompletionTool[] | undefined {
    // Use stored tools to bypass ADK's semantic filtering
    const toolsToUse = this.allTools || llmRequest.config?.tools;

    if (!toolsToUse || toolsToUse.length === 0) {
      return undefined;
    }

    return toolsToUse.map((tool: any) => {      
      // Extract parameters from functionDeclarations (set by google-adk-service with normalized schema)
      let parameters = tool.functionDeclarations?.[0]?.parameters || tool.parameters || {
        type: 'object',
        properties: {},
      };      

      return {
        type: 'function',
        function: {
          name: tool.functionDeclarations?.[0]?.name || tool.name,
          description: tool.functionDeclarations?.[0]?.description || tool.description,
          parameters,
        },
      };
    });
  }

  /**
   * Main method: Generate content using LiteLLM via OpenAI SDK
   */
  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream: boolean = true
  ): AsyncGenerator<LlmResponse, void> {
    console.log('[LiteLLM Model] generateContentAsync called');
    console.log('[LiteLLM Model] Stream:', stream);
    console.log('[LiteLLM Model] Model:', this.model);
    console.log('[LiteLLM Model] Contents count:', llmRequest.contents.length);

    try {
      // Convert ADK contents to OpenAI messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      // Add system instruction if present
      if (llmRequest.config?.systemInstruction) {
        const sysInstr = llmRequest.config.systemInstruction;
        if (typeof sysInstr === 'string') {
          messages.push({ role: 'system', content: sysInstr });
        } else if (typeof sysInstr === 'object' && 'parts' in sysInstr && Array.isArray(sysInstr.parts)) {
          const text = sysInstr.parts.map((p: Part) => p.text || '').join('\n');
          messages.push({ role: 'system', content: text });
        }
      }

      // Convert all contents to messages (filter out null for skipped tool responses)
      for (const content of llmRequest.contents) {
        const message = this.contentToOpenAIMessage(content);
        if (message !== null) {
          messages.push(message);
        }
      }

      // Get tool declarations
      const tools = this.getToolDeclarations(llmRequest);

      console.log('[LiteLLM Model] Messages count:', messages.length);
      console.log('[LiteLLM Model] Tools count:', tools?.length || 0);

      if (stream) {
        // Streaming mode
        const streamResponse = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools,
          stream: true,
        });

        let currentContent = '';
        let currentFunctionCall: any = null;
        let currentFunctionArgs = '';

        for await (const chunk of streamResponse) {
          const delta = chunk.choices[0]?.delta;

          if (!delta) continue;

          // Handle text content
          if (delta.content) {
            currentContent += delta.content;

            yield {
              content: {
                role: 'model',
                parts: [{ text: delta.content }],
              },
              partial: true,
            };
          }

          // Handle function calls
          if (delta.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              if (toolCall.function?.name) {
                currentFunctionCall = {
                  name: toolCall.function.name,
                  args: toolCall.function.arguments || '',
                };
                // IMPORTANT: Also accumulate initial arguments from first chunk
                // OpenAI often sends function name + initial args in first chunk
                if (toolCall.function.arguments) {
                  currentFunctionArgs += toolCall.function.arguments;
                }
              } else if (toolCall.function?.arguments) {
                // Subsequent chunks with more arguments
                currentFunctionArgs += toolCall.function.arguments;
              }
            }
          }

          // Check if stream is complete
          if (chunk.choices[0]?.finish_reason) {
            console.log('[LiteLLM Model] Stream finish reason:', chunk.choices[0].finish_reason);

            // Yield final response
            const finalParts: Part[] = [];

            if (currentContent) {
              finalParts.push({ text: currentContent });
            }

            if (currentFunctionCall) {
              try {
                const args = JSON.parse(currentFunctionArgs);
                finalParts.push({
                  functionCall: {
                    name: currentFunctionCall.name,
                    args,
                  },
                });
              } catch (error) {
                console.error('[LiteLLM Model] Error parsing function args:', error);
              }
            }

            yield {
              content: finalParts.length > 0 ? {
                role: 'model',
                parts: finalParts,
              } : undefined,
              partial: false,
              turnComplete: true,
              finishReason: chunk.choices[0].finish_reason as any,
            };
          }
        }
      } else {
        // Non-streaming mode
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools,
          stream: false,
        });

        const choice = response.choices[0];
        const parts: Part[] = [];

        if (choice.message.content) {
          parts.push({ text: choice.message.content });
        }

        if (choice.message.tool_calls) {
          for (const toolCall of choice.message.tool_calls) {
            if (toolCall.type === 'function') {
              console.log('[LiteLLM Model] Non-stream tool call DEBUG:', {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
                argumentsLength: toolCall.function.arguments?.length,
              });

              try {
                const args = JSON.parse(toolCall.function.arguments);
                console.log('[LiteLLM Model] Parsed args:', args);
                parts.push({
                  functionCall: {
                    name: toolCall.function.name,
                    args,
                  },
                });
              } catch (error) {
                console.error('[LiteLLM Model] Error parsing tool call:', error);
                console.error('[LiteLLM Model] Arguments string was:', toolCall.function.arguments);
              }
            }
          }
        }

        yield {
          content: parts.length > 0 ? {
            role: 'model',
            parts,
          } : undefined,
          partial: false,
          turnComplete: true,
          finishReason: choice.finish_reason as any,
          usageMetadata: response.usage ? {
            promptTokenCount: response.usage.prompt_tokens,
            candidatesTokenCount: response.usage.completion_tokens,
            totalTokenCount: response.usage.total_tokens,
          } : undefined,
        };
      }
    } catch (error: any) {
      console.error('[LiteLLM Model] Error:', error);

      yield {
        errorCode: error.status?.toString() || 'UNKNOWN_ERROR',
        errorMessage: error.message || 'An error occurred while generating content',
        partial: false,
        turnComplete: true,
      };
    }
  }

  /**
   * Live connection not supported for LiteLLM
   */
  async connect(llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connections are not supported for LiteLLM');
  }
}
