/**
 * Tool definitions for Vercel AI SDK v6
 *
 * Uses map-ai-tools converters for Vercel AI SDK format
 * Combines local map tools with remote MCP server tools
 *
 * CONSOLIDATED PATTERN: Uses 6 tools instead of 40+
 */

import { tool, type Tool } from 'ai';
import {
  getToolsForVercelAI,
  consolidatedToolNames,
  isFrontendToolResult,
  type VercelAIToolDef,
  type ToolName,
} from '@carto/maps-ai-tools';
import { getMCPTools, getMCPToolNames } from './mcp-tools.js';

/**
 * Create local map tools for Vercel AI SDK v6
 *
 * Uses CONSOLIDATED tools pattern (6 tools instead of 40+):
 * - geocode
 * - set-map-view
 * - set-basemap
 * - set-deck-state
 * - take-map-screenshot
 * - carto-query
 */
export function createMapTools(): Record<string, Tool> {
  // Pass consolidated tool names to filter to only 6 tools
  const toolDefs = getToolsForVercelAI(consolidatedToolNames as ToolName[]);

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
 * Returns consolidated tool names + MCP tool names
 */
export function getAllToolNames(): string[] {
  const localNames = [...consolidatedToolNames];
  const mcpNames = getMCPToolNames();

  // Deduplicate
  return [...new Set([...localNames, ...mcpNames])];
}

/**
 * Get local tool names only (consolidated 6 tools)
 */
export function getToolNames(): string[] {
  return [...consolidatedToolNames];
}

// Re-export utilities
export { isFrontendToolResult };
