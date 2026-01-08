/**
 * Tool definitions for OpenAI Agents SDK
 *
 * Converts CARTO map-ai-tools to OpenAI Agents SDK format
 */

import { tool } from '@openai/agents';
import {
  tools as cartoTools,
  validateWithZod,
  getToolsForOpenAIAgents,
  parseFrontendToolResult,
} from '@carto/maps-ai-tools';

/**
 * Create map tools for OpenAI Agents SDK
 *
 * Each tool validates input and returns a JSON string with frontend execution marker
 */
export function createMapTools() {
  const toolDefs = getToolsForOpenAIAgents();

  return toolDefs.map((def: {
    name: string;
    description: string;
    parameters: import('zod').ZodTypeAny;
    execute: (args: unknown) => Promise<string>;
  }) =>
    tool({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: def.execute,
    })
  );
}

/**
 * Get tool names for system prompt
 */
export function getToolNames(): string[] {
  return Object.keys(cartoTools);
}

// Re-export utilities
export { parseFrontendToolResult, validateWithZod };
