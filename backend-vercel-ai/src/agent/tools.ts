/**
 * Tool definitions for Vercel AI SDK v6
 *
 * Uses map-ai-tools converters for Vercel AI SDK format
 */

import { tool, type Tool } from 'ai';
import {
  getToolsForVercelAI,
  isFrontendToolResult,
  type VercelAIToolDef,
} from '@carto/maps-ai-tools';

/**
 * Create map tools for Vercel AI SDK v6
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
 * Get tool names for system prompt
 */
export function getToolNames(): string[] {
  return getToolsForVercelAI().map((t: VercelAIToolDef & { name: string }) => t.name);
}

// Re-export utilities
export { isFrontendToolResult };
