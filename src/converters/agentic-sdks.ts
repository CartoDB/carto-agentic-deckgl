/**
 * Agentic SDK Converters
 *
 * Converts CARTO map tools to formats compatible with various agentic frameworks:
 * - OpenAI Agents SDK (@openai/agents)
 * - Google ADK (@google/adk)
 * - Vercel AI SDK (ai)
 *
 * These converters allow the same tool definitions to be used across different
 * AI agent frameworks while maintaining type safety and validation.
 */

import { tools, type ToolName } from '../definitions/tools';
import { validateWithZod } from '../core/validation';

/**
 * Tool definition for OpenAI Agents SDK
 * Compatible with the tool() helper from @openai/agents
 */
export interface OpenAIAgentToolDef {
  name: string;
  description: string;
  parameters: import('zod').ZodTypeAny;
  execute: (args: unknown) => Promise<string>;
}

/**
 * Tool definition for Google ADK
 * Compatible with FunctionTool from @google/adk
 */
export interface GoogleADKToolDef {
  name: string;
  description: string;
  parameters: import('zod').ZodTypeAny;
  execute: (args: unknown) => Promise<Record<string, unknown>>;
}

/**
 * Tool definition for Vercel AI SDK v6
 * Compatible with tool() from 'ai'
 * Note: AI SDK v6 uses 'inputSchema' instead of 'parameters'
 */
export interface VercelAIToolDef {
  description: string;
  inputSchema: import('zod').ZodTypeAny;
  execute: (args: unknown) => Promise<Record<string, unknown>>;
}

/**
 * Frontend tool marker - indicates tool should be executed on frontend
 */
export interface FrontendToolResult {
  __frontend_tool__: true;
  toolName: string;
  data: unknown;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

/**
 * Create a frontend tool result that signals execution should happen client-side
 */
function createFrontendToolResult(toolName: string, data: unknown): FrontendToolResult {
  return {
    __frontend_tool__: true,
    toolName,
    data,
  };
}

/**
 * Convert CARTO tools to OpenAI Agents SDK format
 *
 * Usage with @openai/agents:
 * ```typescript
 * import { tool } from '@openai/agents';
 * import { getToolsForOpenAIAgents } from '@carto/agentic-deckgl';
 *
 * const toolDefs = getToolsForOpenAIAgents();
 * const agentTools = toolDefs.map(def => tool(def));
 * ```
 */
export function getToolsForOpenAIAgents(
  toolNames?: ToolName[]
): OpenAIAgentToolDef[] {
  const names = toolNames || (Object.keys(tools) as ToolName[]);

  return names.map((name) => {
    const toolDef = tools[name];
    return {
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.schema,
      execute: async (args: unknown): Promise<string> => {
        // Validate using Zod
        const validation = validateWithZod(name, args);
        if (!validation.valid) {
          return JSON.stringify({
            error: true,
            message: validation.errors.join(', '),
          });
        }

        // Return frontend tool marker for client-side execution
        return JSON.stringify(createFrontendToolResult(name, validation.data));
      },
    };
  });
}

/**
 * Convert CARTO tools to Google ADK format
 *
 * Usage with @google/adk:
 * ```typescript
 * import { FunctionTool } from '@google/adk';
 * import { getToolsForGoogleADK } from '@carto/agentic-deckgl';
 *
 * const toolDefs = getToolsForGoogleADK();
 * const adkTools = toolDefs.map(def => new FunctionTool(def));
 * ```
 */
export function getToolsForGoogleADK(
  toolNames?: ToolName[]
): GoogleADKToolDef[] {
  const names = toolNames || (Object.keys(tools) as ToolName[]);

  return names.map((name) => {
    const toolDef = tools[name];
    return {
      name: toolDef.name,
      description: toolDef.description,
      parameters: toolDef.schema,
      execute: async (args: unknown): Promise<Record<string, unknown>> => {
        // Validate using Zod
        const validation = validateWithZod(name, args);
        if (!validation.valid) {
          return {
            error: true,
            message: validation.errors.join(', '),
          };
        }

        // Return frontend tool marker for client-side execution
        return createFrontendToolResult(name, validation.data);
      },
    };
  });
}

/**
 * Convert CARTO tools to Vercel AI SDK format
 *
 * Usage with Vercel AI SDK:
 * ```typescript
 * import { tool } from 'ai';
 * import { getToolsForVercelAI } from '@carto/agentic-deckgl';
 *
 * const toolDefs = getToolsForVercelAI();
 * const vercelTools = Object.fromEntries(
 *   toolDefs.map(def => [def.name, tool(def)])
 * );
 * ```
 */
export function getToolsForVercelAI(
  toolNames?: ToolName[]
): Array<VercelAIToolDef & { name: string }> {
  const names = toolNames || (Object.keys(tools) as ToolName[]);

  return names.map((name) => {
    const toolDef = tools[name];
    return {
      name: toolDef.name,
      description: toolDef.description,
      inputSchema: toolDef.schema,
      execute: async (args: unknown): Promise<Record<string, unknown>> => {
        // Validate using Zod
        const validation = validateWithZod(name, args);
        if (!validation.valid) {
          return {
            error: true,
            message: validation.errors.join(', '),
          };
        }

        // Return frontend tool marker for client-side execution
        return createFrontendToolResult(name, validation.data);
      },
    };
  });
}

/**
 * Get tools as a record/object for Vercel AI SDK
 * This is the format expected by streamText({ tools: ... })
 *
 * Usage:
 * ```typescript
 * import { streamText } from 'ai';
 * import { getToolsRecordForVercelAI } from '@carto/agentic-deckgl';
 *
 * const result = await streamText({
 *   model,
 *   tools: getToolsRecordForVercelAI(),
 *   ...
 * });
 * ```
 */
export function getToolsRecordForVercelAI(
  toolNames?: ToolName[]
): Record<string, VercelAIToolDef> {
  const toolDefs = getToolsForVercelAI(toolNames);
  return Object.fromEntries(
    toolDefs.map((def) => [def.name, {
      description: def.description,
      inputSchema: def.inputSchema,
      execute: def.execute,
    }])
  );
}

/**
 * Check if a tool result indicates frontend execution
 */
export function isFrontendToolResult(
  result: unknown
): result is FrontendToolResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '__frontend_tool__' in result &&
    (result as FrontendToolResult).__frontend_tool__ === true
  );
}

/**
 * Parse a frontend tool result from a string (for OpenAI Agents SDK)
 */
export function parseFrontendToolResult(
  resultString: string
): FrontendToolResult | null {
  try {
    const parsed = JSON.parse(resultString);
    if (isFrontendToolResult(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
