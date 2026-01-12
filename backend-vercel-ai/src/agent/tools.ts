/**
 * Tool definitions for Vercel AI SDK v6
 *
 * Uses map-ai-tools converters for Vercel AI SDK format
 * Combines local map tools with remote MCP server tools
 */

import { tool, type Tool } from 'ai';
import {
  getToolsForVercelAI,
  isFrontendToolResult,
  type VercelAIToolDef,
} from '@carto/maps-ai-tools';
import { getMCPTools, getMCPToolNames } from './mcp-tools.js';

/**
 * Create local map tools for Vercel AI SDK v6
 *
 * Returns tools in the format expected by ToolLoopAgent
 */
export function createMapTools(): Record<string, Tool> {
  const toolDefs = getToolsForVercelAI();

  return Object.fromEntries(
    toolDefs.map((def: VercelAIToolDef & { name: string }) => [
      def.name,
      tool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: def.execute,
      }),
    ])
  );
}

/**
 * Get all tools (local map tools + MCP tools)
 *
 * Local tools take precedence over MCP tools on name conflicts.
 */
export function getAllTools(): Record<string, Tool> {
  const mcpTools = getMCPTools();
  const localTools = createMapTools();

  // Local tools override MCP tools on conflict
  return { ...mcpTools, ...localTools };
}

/**
 * Get all tool names for system prompt
 */
export function getAllToolNames(): string[] {
  const localNames = getToolsForVercelAI().map((t: VercelAIToolDef & { name: string }) => t.name);
  const mcpNames = getMCPToolNames();

  // Deduplicate
  return [...new Set([...localNames, ...mcpNames])];
}

/**
 * Get local tool names only
 */
export function getToolNames(): string[] {
  return getToolsForVercelAI().map((t: VercelAIToolDef & { name: string }) => t.name);
}

// Re-export utilities
export { isFrontendToolResult };
