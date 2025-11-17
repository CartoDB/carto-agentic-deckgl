export { BASE_SYSTEM_PROMPT } from './base-prompt';
export { generateToolDescriptions } from './tool-descriptions';
import { BASE_SYSTEM_PROMPT } from './base-prompt';
import { generateToolDescriptions } from './tool-descriptions';
import { ToolDefinition, PromptConfig } from '../core/types';

/**
 * Build complete system prompt with tool descriptions
 */
export function getSystemPrompt(tools: ToolDefinition[], config?: PromptConfig): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  // Add tool descriptions
  if (tools.length > 0) {
    sections.push(generateToolDescriptions(tools));
  }

  // Add optional context
  if (config?.additionalContext) {
    sections.push(`\n${config.additionalContext}`);
  }

  if (config?.customInstructions) {
    sections.push(`\n${config.customInstructions}`);
  }

  return sections.join('\n');
}
