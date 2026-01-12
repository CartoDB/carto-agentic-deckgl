// backend/src/services/google-adk-service.ts
import { Response } from 'express';
import { LlmAgent, Runner, InMemorySessionService, FunctionTool, type BaseSessionService } from '@google/adk';
import { Content, FunctionCallingConfigMode } from '@google/genai';
import { LiteLlmModel } from './litellm-model.js';
import { randomUUID } from 'crypto';
import { getAllToolDefinitions } from '@carto/maps-ai-tools';
import { buildSystemPrompt, type MapInitialState } from '../prompts/system-prompt.js';
import * as z from 'zod';
import { RedisSessionService } from './redis-session-service.js';
import { customTools, initializeMCPTools } from './custom-tools.js';

export class GoogleADKService {
  private agent: LlmAgent | null = null;
  private runner: Runner | null = null;
  private sessionService: BaseSessionService;
  private model: string;
  private cartoTools: FunctionTool[] = [];
  private cartoToolDefinitions: any[] = [];
  private customTools: FunctionTool[] = [];
  private customToolDefinitions: Record<string, any> = {};
  private allTools: FunctionTool[] = [];

  constructor() {
    // Configuration from environment
    // Models can be: carto::gemini-2.5-flash, ac_qb86nj1::gpt-4o, etc.
    this.model = process.env.GOOGLE_ADK_MODEL || 'carto::gemini-2.5-flash';

    // Initialize session service (singleton, shared across requests)
    // Use Redis if configured, otherwise use InMemory
    const useRedis = process.env.USE_REDIS_SESSIONS === 'true';

    if (useRedis) {
      console.log('[Google ADK] Initializing Redis session service');
      this.sessionService = new RedisSessionService(undefined, {
        ttl: parseInt(process.env.REDIS_SESSION_TTL || '86400'), // 24 hours default
      });
    } else {
      console.log('[Google ADK] Initializing InMemory session service');
      this.sessionService = new InMemorySessionService();
    }

    console.log('[Google ADK] Service created');
    console.log('[Google ADK] Model:', this.model);
    console.log('[Google ADK] Session storage:', useRedis ? 'Redis' : 'InMemory');
    console.log('[Google ADK] Using CARTO LiteLLM endpoint');
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Initialize agent with CARTO library tools and custom tools (including MCP)
   */
  private async initialize() {
    if (this.agent && this.runner) {
      return;
    }

    try {
      console.log('[Google ADK] Initializing agent...');

      // Initialize MCP tools (if configured)
      await initializeMCPTools();

      // Get CARTO library tool definitions
      this.cartoToolDefinitions = getAllToolDefinitions();
      console.log('[Google ADK] Loaded CARTO tools:', this.cartoToolDefinitions.length);

      // Convert CARTO tools to ADK FunctionTool format
      this.cartoTools = this.convertCartoToolsToADK(this.cartoToolDefinitions);

      // Get custom tools (static + MCP)
      this.customToolDefinitions = customTools;
      const customToolCount = Object.keys(this.customToolDefinitions).length;
      console.log('[Google ADK] Loaded custom tools:', customToolCount);

      // Convert custom tools to ADK FunctionTool format
      this.customTools = this.convertCustomToolsToADK(this.customToolDefinitions);

      // Combine all tools
      this.allTools = [...this.cartoTools, ...this.customTools];
      console.log('[Google ADK] Total tools:', this.allTools.length);

      // Get API credentials
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required for Google ADK with LiteLLM');
      }

      const baseURL = process.env.CARTO_LITELLM_URL || 'https://litellm-gcp-us-east1.api.carto.com/v1';

      // Create custom LiteLLM model instance
      const liteLlmModel = new LiteLlmModel({
        model: this.model,
        baseURL,
        apiKey,
      });

      // Store all tools in LiteLlmModel to bypass ADK's semantic filtering
      liteLlmModel.setAllTools(this.allTools);

      // Create LlmAgent with all tools (CARTO + custom)
      // Note: Instruction will be set per-request based on initialState
      this.agent = new LlmAgent({
        model: liteLlmModel,
        name: 'map_assistant_agent',
        description: 'AI assistant for deck.gl map visualization and data exploration',
        tools: this.allTools,
        // Removed generateContentConfig - we bypass ADK filtering by injecting tools in LiteLlmModel
      });

      // Create Runner with session service
      this.runner = new Runner({
        appName: 'ps-frontend-tools',
        agent: this.agent,
        sessionService: this.sessionService,
      });

      console.log('[Google ADK] Service initialized successfully');
      console.log('[Google ADK] Model:', this.model);
      console.log('[Google ADK] CARTO tools loaded:', this.cartoTools.length);
      console.log('[Google ADK] Custom tools loaded:', this.customTools.length);
      console.log('[Google ADK] Total tools:', this.allTools.length);
      console.log('[Google ADK] Tool names:', this.allTools.map(t => t.name).join(', '));

    } catch (error) {
      console.error('[Google ADK] Error initializing:', error);
      throw error;
    }
  }

  /**
   * Convert CARTO library tools to ADK FunctionTool format
   */
  private convertCartoToolsToADK(cartoTools: any[]): FunctionTool[] {
    const adkTools: FunctionTool[] = [];

    for (const tool of cartoTools) {
      try {
        const toolFunc = tool.function || tool;
        const adkTool = this.createADKFunctionTool(
          toolFunc.name,
          toolFunc.description,
          toolFunc.parameters
        );
        adkTools.push(adkTool);
      } catch (error) {
        console.error(`[Google ADK] Error converting CARTO tool ${tool.function?.name}:`, error);
      }
    }

    return adkTools;
  }

  /**
   * Convert custom tools (with backend execute functions) to ADK FunctionTool format
   */
  private convertCustomToolsToADK(customTools: Record<string, any>): FunctionTool[] {
    const adkTools: FunctionTool[] = [];

    for (const [toolName, tool] of Object.entries(customTools)) {
      try {
        // Convert Zod schema to JSON Schema for parameters
        const parametersSchema = tool.schema ? this.zodToJsonSchema(tool.schema) : { type: 'object', properties: {} };

        // Create ADK tool with backend execute function
        const adkTool = this.createBackendExecutableTool(
          tool.name,
          tool.description,
          parametersSchema,
          tool.execute
        );
        adkTools.push(adkTool);
        console.log(`[Google ADK] Added custom tool: ${tool.name}`);
      } catch (error) {
        console.error(`[Google ADK] Error converting custom tool ${toolName}:`, error);
      }
    }

    return adkTools;
  }

  /**
   * Convert Zod schema to JSON Schema format
   */
  private zodToJsonSchema(zodSchema: z.ZodType<any>): any {
    // Basic Zod to JSON Schema conversion
    // For more complex schemas, consider using a library like zod-to-json-schema
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema._def.shape;  // shape is a property, not a function
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodType<any>;

        // Extract type and description
        let fieldType = 'string';
        let description = '';

        if (fieldSchema instanceof z.ZodString) {
          fieldType = 'string';
          description = fieldSchema.description || '';
        } else if (fieldSchema instanceof z.ZodNumber) {
          fieldType = 'number';
          description = fieldSchema.description || '';
        } else if (fieldSchema instanceof z.ZodBoolean) {
          fieldType = 'boolean';
          description = fieldSchema.description || '';
        } else if (fieldSchema instanceof z.ZodArray) {
          fieldType = 'array';
          description = fieldSchema.description || '';
        } else if (fieldSchema instanceof z.ZodObject) {
          fieldType = 'object';
          description = fieldSchema.description || '';
        }

        properties[key] = {
          type: fieldType,
          description,
        };

        // Check if field is required (not optional)
        if (!fieldSchema.isOptional()) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    // Fallback for non-object schemas
    return { type: 'object', properties: {} };
  }

  /**
   * Create an ADK FunctionTool from OpenAI-style definition
   * CARTO tools are frontend-executed, so we return a marker
   */
  private createADKFunctionTool(
    name: string,
    description: string,
    parametersSchema: any
  ): FunctionTool {
    // Normalize tool name: replace hyphens with underscores
    // LLMs (especially via LiteLLM) often convert hyphens to underscores
    const normalizedName = name.replace(/-/g, '_');

    console.log(`[Google ADK] Creating tool: ${normalizedName}`);
    console.log(`[Google ADK] Original parametersSchema:`, JSON.stringify(parametersSchema, null, 2).substring(0, 200));

    // Convert JSON Schema to Zod schema
    const zodSchema = this.jsonSchemaToZod(parametersSchema);

    // Normalize the JSON Schema - make a deep copy to avoid mutations
    const normalizedSchema = JSON.parse(JSON.stringify(parametersSchema || {}));

    // Ensure it has standard JSON Schema structure
    if (!normalizedSchema.type) {
      normalizedSchema.type = 'object';
    } else if (typeof normalizedSchema.type === 'string') {
      // Ensure type is lowercase (OpenAI requires lowercase)
      normalizedSchema.type = normalizedSchema.type.toLowerCase();
    }

    if (!normalizedSchema.properties) {
      normalizedSchema.properties = {};
    }

    // Create FunctionTool
    // IMPORTANT: For frontend tools, execute immediately returns success
    // This prevents ADK from retrying and keeps conversation history clean
    const toolOptions: any = {
      name: normalizedName,  // Use normalized name (with underscores)
      description,
      parameters: normalizedSchema,  // Use normalized JSON Schema (not Zod schema!)
      execute: async (params: any) => {
        // Frontend tools are executed on the client side
        // Return empty object to signal success without adding to conversation history
        console.log(`[Google ADK] Frontend tool called: ${normalizedName}`, params);
        return {};
      },
    };

    const tool = new FunctionTool(toolOptions);

    return tool;
  }

  /**
   * Create an ADK FunctionTool with backend execution
   * Custom tools with execute functions run on the backend
   */
  private createBackendExecutableTool(
    name: string,
    description: string,
    parametersSchema: any,
    executeFunction?: (params: any) => Promise<any>
  ): FunctionTool {
    // Normalize tool name: replace hyphens with underscores
    const normalizedName = name.replace(/-/g, '_');

    console.log(`[Google ADK] Creating backend tool: ${normalizedName}`);

    // Normalize the JSON Schema
    const normalizedSchema = JSON.parse(JSON.stringify(parametersSchema || {}));

    if (!normalizedSchema.type) {
      normalizedSchema.type = 'object';
    } else if (typeof normalizedSchema.type === 'string') {
      normalizedSchema.type = normalizedSchema.type.toLowerCase();
    }

    if (!normalizedSchema.properties) {
      normalizedSchema.properties = {};
    }

    // Create FunctionTool with backend execution
    const toolOptions: any = {
      name: normalizedName,
      description,
      parameters: normalizedSchema,
      execute: async (params: any) => {
        if (executeFunction) {
          console.log(`[Google ADK] Executing backend tool: ${normalizedName}`, params);
          try {
            const result = await executeFunction(params);
            console.log(`[Google ADK] Backend tool result:`, result);
            return result;
          } catch (error) {
            console.error(`[Google ADK] Backend tool execution error:`, error);
            return {
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }
        return {};
      },
    };

    const tool = new FunctionTool(toolOptions);

    return tool;
  }

  /**
   * Convert JSON Schema to Zod schema
   */
  private jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> | undefined {
    const shape: Record<string, z.ZodTypeAny> = {};

    if (!jsonSchema || !jsonSchema.properties || Object.keys(jsonSchema.properties).length === 0) {
      return z.object({});
    }

    for (const [key, propSchema] of Object.entries(jsonSchema.properties as Record<string, any>)) {
      let zodType: z.ZodTypeAny;

      switch (propSchema.type) {
        case 'string':
          zodType = z.string();
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        case 'number':
          zodType = z.number();
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        case 'integer':
          zodType = z.number().int();
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        case 'boolean':
          zodType = z.boolean();
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        case 'array':
          zodType = z.array(z.any());
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        case 'object':
          zodType = z.object({}).passthrough();
          if (propSchema.description) {
            zodType = zodType.describe(propSchema.description);
          }
          break;
        default:
          zodType = z.any();
      }

      // Make optional if not in required array
      if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * Stream chat completion using Google ADK with CARTO tools
   */
  async streamChatCompletion(
    message: string,
    res: Response,
    sessionId?: string,
    initialState?: MapInitialState
  ): Promise<{ message: any; sessionId: string } | null> {
    console.log('[Google ADK] Starting streamChatCompletion...');
    console.log('[Google ADK] Session ID provided:', sessionId || '(none)');

    // Ensure agent is initialized
    await this.initialize();

    if (!this.agent || !this.runner) {
      throw new Error('Google ADK agent or runner not initialized');
    }

    // Generate session ID if not provided
    const actualSessionId = sessionId || `session_${randomUUID()}`;
    const messageId = `msg_${Date.now()}`;
    const userId = 'default_user';

    console.log('[Google ADK] Using session ID:', actualSessionId);

    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Build dynamic instruction based on initialState
      // Combine CARTO tools and custom tools for system prompt
      const cartoToolsForPrompt = this.cartoToolDefinitions.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.function?.name || tool.name,
          description: tool.function?.description || tool.description,
          parameters: tool.function?.parameters || tool.parameters
        }
      }));

      const customToolsForPrompt = Object.values(this.customToolDefinitions).map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.schema ? this.zodToJsonSchema(tool.schema) : { type: 'object', properties: {} }
        }
      }));

      const chatFormatTools = [...cartoToolsForPrompt, ...customToolsForPrompt];

      // Ensure session exists - create if not found
      const session = await this.sessionService.getSession({
        appName: 'ps-frontend-tools',
        userId,
        sessionId: actualSessionId,
      });

      const isNewSession = !session;

      if (!session) {
        console.log('[Google ADK] Session not found, creating new session');
        await this.sessionService.createSession({
          appName: 'ps-frontend-tools',
          userId,
          sessionId: actualSessionId,
        });
        console.log('[Google ADK] Session created successfully');
      } else {
        console.log('[Google ADK] Using existing session');
      }

      // Only prepend system prompt for NEW sessions
      // For existing sessions, ADK already has the system prompt in history
      let inputContent: string;

      if (isNewSession) {
        // Build system instruction based on initialState
        const instruction = initialState
          ? buildSystemPrompt(chatFormatTools, initialState as any)
          : buildSystemPrompt(chatFormatTools);

        // Prepend system instruction to the FIRST user message only
        inputContent = `${instruction}\n\nUser: ${message}`;
        console.log('[Google ADK] New session - including system prompt');
        console.log('[Google ADK] System prompt length:', instruction.length);
      } else {
        // Existing session - just send the user message
        inputContent = message;
        console.log('[Google ADK] Existing session - sending user message only');
      }

      console.log('[Google ADK] User message:', message);

      // Create message for ADK (requires parts array with text)
      const newMessage: Content = {
        role: 'user',
        parts: [{ text: inputContent }]
      };


      const eventStream = await this.runner.runAsync({
        userId,
        sessionId: actualSessionId,
        newMessage,
      });

      let assistantMessage = '';

      // Process events from the stream
      for await (const event of eventStream) {
        console.log('[Google ADK] Event:', event.author, event.partial ? '(partial)' : '(complete)');

        // Check for content in the event
        if (event.content && event.content.parts && event.content.parts.length > 0) {
          for (const part of event.content.parts) {
            // Handle text content
            if (part.text !== undefined && part.text !== null) {
              const textContent = part.text;

              // Only send non-empty text deltas
              if (textContent && textContent.length > 0) {
                assistantMessage += textContent;

                // Send text chunk to client
                const textMessage = {
                  type: 'stream_chunk',
                  content: textContent,
                  messageId,
                  isComplete: false,
                };
                console.log('[Google ADK] Text message:', textMessage);
                res.write(JSON.stringify(textMessage) + '\n');
              }
            }

            // Handle function calls (CARTO library tools and custom tools)
            if (part.functionCall) {
              const toolName = part.functionCall.name;
              if (!toolName) {
                console.warn('[Google ADK] Function call without name, skipping');
                continue;
              }

              const toolArgs = part.functionCall.args || {};

              console.log(`[Google ADK] Function call: ${toolName}`, toolArgs);

              // Convert tool name back to hyphen format for frontend
              // ADK uses underscores (navigate_slide), frontend expects hyphens (navigate-slide)
              const frontendToolName = toolName.replace(/_/g, '-');

              // Send tool call to frontend for execution
              const toolMessage = {
                type: 'tool_call',
                toolName: frontendToolName,  // Use hyphen format for frontend
                data: toolArgs,
                callId: `call_${Date.now()}`,
              };
              console.log('[Google ADK] Tool message:', toolMessage);
              res.write(JSON.stringify(toolMessage) + '\n');
            }

            // Handle function responses (backend tool execution results)
            if (part.functionResponse) {
              const toolName = part.functionResponse.name;
              const response = part.functionResponse.response;

              console.log(`[Google ADK] Function response from ${toolName}:`, response);

              // Send backend tool result to client
              const responseMessage = {
                type: 'backend_tool_result',
                toolName,
                result: response,
                timestamp: Date.now(),
              };
              res.write(JSON.stringify(responseMessage) + '\n');
            }
          }
        }
      }

      // Send completion signal with session ID
      const completeMessage = {
        type: 'stream_chunk',
        content: '',
        messageId,
        isComplete: true,
        sessionId: actualSessionId,
      };
      console.log('[Google ADK] Complete message:', completeMessage);
      res.write(JSON.stringify(completeMessage) + '\n');

      // End the response
      res.end();

      console.log('[Google ADK] Stream completed');
      console.log('[Google ADK] Assistant message length:', assistantMessage.length);
      console.log('[Google ADK] Session ID:', actualSessionId);

      // Return assistant message and session ID
      return {
        message: {
          role: 'assistant',
          content: assistantMessage || 'I processed your request.',
        },
        sessionId: actualSessionId,
      };

    } catch (error: any) {
      console.error('[Google ADK] Error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: this.getErrorMessage(error),
          code: error.code,
        });
      } else {
        const errorMessage = {
          type: 'error',
          content: this.getErrorMessage(error),
          code: error.code,
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
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.status === 401) {
      return 'Authentication error. Please check API configuration.';
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return 'Connection timeout. Please try again.';
    }

    return error.message || 'An unexpected error occurred. Please try again.';
  }
}

/* ============================================================================
 * TOOL CONVERSION CODE (PRESERVED FOR FUTURE USE)
 * ============================================================================
 *
 * Uncomment and integrate this code when ready to add tools support
 *

import {
  getAllToolDefinitions,
  formatToolResponse,
  validateWithZod,
} from '@carto/maps-ai-tools';
import { getCustomToolNames, getCustomTool, initializeMCPTools } from './custom-tools.js';
import * as z from 'zod';
import { FunctionTool } from '@google/adk';

// In constructor, add:
private allToolDefinitions: any[] = [];
private adkTools: FunctionTool[] = [];
private initialized: boolean = false;

// Initialize method with tools:
private async initialize() {
  if (this.initialized) {
    return;
  }

  try {
    console.log('[Google ADK] Initializing tools and agent...');

    // Initialize MCP tools first
    await initializeMCPTools();

    // Get CARTO library tool definitions (in OpenAI Chat format)
    const cartoToolDefinitions = getAllToolDefinitions();

    // Get all custom tool names (now includes MCP tools)
    const customToolNames = getCustomToolNames();

    // Convert custom tools to OpenAI Chat format (for prompt generation)
    const customToolDefinitions = customToolNames.map(toolName => {
      const customTool = getCustomTool(toolName);

      // Determine if schema needs conversion
      let parameters: any;
      try {
        // First, check if tool has jsonSchema property (from MCP)
        if (customTool.jsonSchema) {
          console.log(`[Google ADK] Using JSON Schema for MCP tool: ${toolName}`);
          parameters = customTool.jsonSchema;
        }
        // Check if it's a Zod object schema
        else if (customTool.schema && typeof customTool.schema === 'object' && '_def' in customTool.schema) {
          console.log(`[Google ADK] Converting Zod schema for tool: ${toolName}`);
          parameters = z.toJSONSchema(customTool.schema, { target: 'openapi-3.0' });
        } else if (customTool.schema && typeof customTool.schema === 'object') {
          console.log(`[Google ADK] Using plain JSON Schema for tool: ${toolName}`);
          parameters = customTool.schema;
        } else {
          console.warn(`[Google ADK] No valid schema found for ${toolName}, using empty schema`);
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
        console.error(`[Google ADK] Error processing schema for ${toolName}:`, error);
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

    // Combine all tool definitions (for prompt generation)
    const chatFormatTools = [...cartoToolDefinitions, ...customToolDefinitions];
    this.allToolDefinitions = chatFormatTools;

    // Convert all tools to ADK FunctionTool format
    this.adkTools = this.convertToADKTools(cartoToolDefinitions, customToolDefinitions);

    // Create agent WITH tools
    this.agent = new LlmAgent({
      model: liteLlmModel,
      name: 'map_assistant_agent',
      description: 'AI assistant for deck.gl map visualization and data exploration',
      tools: this.adkTools, // Add tools here
    });

    this.initialized = true;
    console.log('[Google ADK] Total tools:', this.adkTools.length);
  } catch (error) {
    console.error('[Google ADK] Error initializing:', error);
    throw error;
  }
}

// Convert OpenAI tool definitions to ADK FunctionTool format
private convertToADKTools(
  cartoTools: any[],
  customTools: any[]
): FunctionTool[] {
  const adkTools: FunctionTool[] = [];

  // Convert CARTO library tools (frontend-executed)
  for (const tool of cartoTools) {
    try {
      const toolFunc = tool.function || tool;
      console.log(`[Google ADK] Converting CARTO tool: ${toolFunc.name}`);
      const adkTool = this.createADKFunctionTool(
        toolFunc.name,
        toolFunc.description,
        toolFunc.parameters,
        false, // CARTO tools are frontend-executed
        undefined
      );
      adkTools.push(adkTool);
    } catch (error) {
      console.error(`[Google ADK] Error converting CARTO tool ${tool.function?.name}:`, error);
    }
  }

  // Convert custom tools
  for (const tool of customTools) {
    try {
      const toolFunc = tool.function || tool;
      const customTool = getCustomTool(toolFunc.name);

      const adkTool = this.createADKFunctionTool(
        toolFunc.name,
        toolFunc.description,
        toolFunc.parameters,
        !!customTool.execute, // Has execute function = backend-executed
        customTool.execute
      );
      adkTools.push(adkTool);
    } catch (error) {
      console.error(`[Google ADK] Error converting custom tool ${tool.function?.name}:`, error);
    }
  }

  return adkTools;
}

// Create an ADK FunctionTool from OpenAI-style definition
private createADKFunctionTool(
  name: string,
  description: string,
  parametersSchema: any,
  isBackendExecuted: boolean,
  executeFunc?: (args: any) => Promise<any>
): FunctionTool {
  // Convert JSON Schema to Zod schema
  const zodSchema = this.jsonSchemaToZod(parametersSchema);

  // Normalize the JSON Schema
  const normalizedSchema = parametersSchema || {};
  if (!normalizedSchema.properties) {
    normalizedSchema.type = 'object';
    normalizedSchema.properties = {};
  }

  // Create FunctionTool
  const toolOptions: any = {
    name,
    description,
    execute: async (params: any) => {
      if (isBackendExecuted && executeFunc) {
        // Backend-executed tool
        console.log(`[Google ADK] Executing backend tool: ${name}`);
        const result = await executeFunc(params);
        return result;
      } else {
        // Frontend-executed tool - return marker
        console.log(`[Google ADK] Marking frontend tool for execution: ${name}`);
        return {
          __frontend_tool__: true,
          toolName: name,
          params,
        };
      }
    },
  };

  // Add parameters if zodSchema is defined
  if (zodSchema !== undefined) {
    toolOptions.parameters = zodSchema;
  }

  // Store original JSON Schema for LiteLLM conversion
  (toolOptions as any).__jsonSchema = normalizedSchema;

  const tool = new FunctionTool(toolOptions);

  // Attach JSON schema to the tool instance for litellm-model.ts to use
  (tool as any).__jsonSchema = normalizedSchema;

  return tool;
}

// Convert JSON Schema to Zod schema
private jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> | undefined {
  const shape: Record<string, z.ZodTypeAny> = {};

  if (!jsonSchema || !jsonSchema.properties || Object.keys(jsonSchema.properties).length === 0) {
    return z.object({});
  }

  for (const [key, propSchema] of Object.entries(jsonSchema.properties as Record<string, any>)) {
    let zodType: z.ZodTypeAny;

    switch (propSchema.type) {
      case 'string':
        zodType = z.string();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'number':
        zodType = z.number();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'integer':
        zodType = z.number().int();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'boolean':
        zodType = z.boolean();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'array':
        zodType = z.array(z.any());
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'object':
        zodType = z.object({}).passthrough();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      default:
        zodType = z.any();
    }

    // Make optional if not in required array
    if (!jsonSchema.required || !jsonSchema.required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

// In streamChatCompletion, handle tool calls in the event loop:
if (part.functionCall) {
  const toolName = part.functionCall.name;
  if (!toolName) {
    console.warn('[Google ADK] Function call without name, skipping');
    continue;
  }
  const toolArgs = part.functionCall.args || {};

  console.log(`[Google ADK] Function call: ${toolName}`, toolArgs);

  // Check if this is a backend tool or frontend tool
  const customTool = getCustomTool(toolName);
  const isBackendTool = customTool && customTool.execute;

  if (!isBackendTool) {
    // Frontend-executed tool (CARTO library tools)
    console.log(`[Google ADK] Sending frontend tool call: ${toolName}`);

    // Validate with Zod
    const validation = validateWithZod(toolName, toolArgs);

    if (!validation.valid) {
      console.error(`[Google ADK] Validation failed for ${toolName}:`, validation.errors);
      const errorMessage = {
        type: 'tool_call',
        toolName,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid parameters: ${validation.errors.join(', ')}`,
        },
        callId: `call_${Date.now()}`,
      };
      res.write(JSON.stringify(errorMessage) + '\n');
      continue;
    }

    // Send tool call to frontend
    const toolResponse = formatToolResponse(toolName, {
      data: validation.data,
      message: `Executing ${toolName}`,
    });

    const toolMessage = {
      type: 'tool_call',
      ...toolResponse,
      callId: `call_${Date.now()}`,
    };
    res.write(JSON.stringify(toolMessage) + '\n');
  } else {
    // Backend-executed tool - result already processed by execute function
    console.log(`[Google ADK] Backend tool executed: ${toolName}`);
  }
}

// Handle function responses (from backend tools)
if (part.functionResponse) {
  const toolName = part.functionResponse.name;
  const toolResult = part.functionResponse.response;

  console.log(`[Google ADK] Function response from: ${toolName}`);

  // Send tool result to client for visibility
  const toolMessage = {
    type: 'tool_result',
    toolName,
    data: toolResult,
    message: `Executed ${toolName}`,
    callId: `call_${Date.now()}`,
  };
  res.write(JSON.stringify(toolMessage) + '\n');
}

* ============================================================================
*/
