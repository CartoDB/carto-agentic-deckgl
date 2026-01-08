/**
 * Tool definitions for Vercel AI SDK
 *
 * Uses map-ai-tools converters for Vercel AI SDK format
 */

import { tool, type CoreTool } from 'ai';
import {
  getToolsForVercelAI,
  isFrontendToolResult,
  type VercelAIToolDef,
} from '@carto/maps-ai-tools';

/**
 * Create map tools for Vercel AI SDK
 *
 * Returns tools in the format expected by streamText({ tools: ... })
 */
export function createMapTools(): Record<string, CoreTool> {
  const toolDefs = getToolsForVercelAI();

  return Object.fromEntries(
    toolDefs.map((def: VercelAIToolDef & { name: string }) => [
      def.name,
      tool({
        description: def.description,
        parameters: def.parameters,
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
