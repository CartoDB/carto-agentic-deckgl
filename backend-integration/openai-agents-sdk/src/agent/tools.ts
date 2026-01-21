/**
 * Tool definitions for OpenAI Agents SDK
 *
 * Uses map-ai-tools converters for OpenAI Agents SDK format.
 * Combines local map tools with remote MCP server tools.
 *
 * CONSOLIDATED PATTERN: Uses 6 tools instead of 40+
 *
 * NOTE: OpenAI Agents SDK uses Zod 3 internally, but @carto/maps-ai-tools uses Zod 4.
 * We convert Zod schemas to JSON Schema to avoid compatibility issues.
 */

import { tool, type Tool } from '@openai/agents';
import { z } from 'zod';
import {
  getToolsForOpenAIAgents,
  consolidatedToolNames,
  parseFrontendToolResult,
  isFrontendToolResult,
  type OpenAIAgentToolDef,
  type ToolName,
} from '@carto/maps-ai-tools';
import { getMCPTools, getMCPToolNames } from './mcp-tools.js';

/**
 * JSON Object Schema type expected by OpenAI Agents SDK
 */
type JsonObjectSchemaNonStrict = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: true;
};

/**
 * Convert a Zod 4 schema to JSON Schema in the format expected by OpenAI Agents SDK
 * This is needed because OpenAI Agents SDK expects Zod 3 or JSON Schema
 */
function zodToJsonSchema(zodSchema: z.ZodTypeAny): JsonObjectSchemaNonStrict {
  try {
    // Zod 4 has built-in toJsonSchema method
    const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>;

    // Ensure the schema has the required structure for OpenAI Agents SDK
    return {
      type: 'object',
      properties: (jsonSchema.properties as Record<string, unknown>) || {},
      required: (jsonSchema.required as string[]) || [],
      additionalProperties: true,
    };
  } catch (error) {
    console.error('Failed to convert Zod schema to JSON Schema:', error);
    // Return a minimal valid schema as fallback
    return { type: 'object', properties: {}, required: [], additionalProperties: true };
  }
}

/**
 * Create local map tools for OpenAI Agents SDK
 *
 * Uses CONSOLIDATED tools pattern (6 tools instead of 40+):
 * - geocode
 * - set-map-view
 * - set-basemap
 * - set-deck-state
 * - take-map-screenshot
 * - carto-query
 */
export function createMapTools(): Tool[] {
  // Get tool definitions from map-ai-tools
  const toolDefs = getToolsForOpenAIAgents(consolidatedToolNames as ToolName[]);

  // Convert to OpenAI Agents SDK tool format
  // Use JSON Schema instead of Zod schema to avoid Zod 3/4 compatibility issues
  return toolDefs.map((def: OpenAIAgentToolDef) => {
    const jsonSchema = zodToJsonSchema(def.parameters);

    return tool({
      name: def.name,
      description: def.description,
      parameters: jsonSchema,
      strict: false,
      execute: def.execute,
    });
  });
}

/**
 * Get local tool names (consolidated 6 tools)
 */
export function getLocalToolNames(): string[] {
  return [...consolidatedToolNames];
}

/**
 * Get all tools (local map tools + MCP tools)
 *
 * Local tools take precedence over MCP tools on name conflicts.
 */
export function getAllTools(): Tool[] {
  const mcpTools = getMCPTools();
  const localTools = createMapTools();

  // Merge: local tools override MCP tools with same name
  const toolMap = new Map<string, Tool>();

  // Add MCP tools first
  for (const t of mcpTools) {
    toolMap.set(t.name, t);
  }

  // Local tools override MCP tools
  for (const t of localTools) {
    toolMap.set(t.name, t);
  }

  return Array.from(toolMap.values());
}

/**
 * Get all tool names for system prompt
 * Returns consolidated tool names + MCP tool names
 */
export function getAllToolNames(): string[] {
  const localNames = getLocalToolNames();
  const mcpNames = getMCPToolNames();

  // Deduplicate
  return [...new Set([...localNames, ...mcpNames])];
}

// Re-export utilities
export { parseFrontendToolResult, isFrontendToolResult };
