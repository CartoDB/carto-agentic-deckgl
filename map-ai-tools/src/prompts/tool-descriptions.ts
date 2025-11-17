import { ToolDefinition } from '../core/types';

/**
 * Generate tool descriptions section for system prompt
 */
export function generateToolDescriptions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';

  const descriptions = tools.map(tool => {
    const func = tool.function;
    return `- ${func.name}: ${func.description}`;
  }).join('\n');

  return `\nAvailable map control functions:\n${descriptions}`;
}
