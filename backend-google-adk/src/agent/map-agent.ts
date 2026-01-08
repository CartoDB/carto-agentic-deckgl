/**
 * Map Control Agent definition for Google ADK
 */

import { LlmAgent } from '@google/adk';
import { createMapTools, getToolNames } from './tools.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState } from '../types/messages.js';

/**
 * Create a map control agent with the given initial state
 */
export function createMapAgent(initialState?: InitialState): LlmAgent {
  const tools = createMapTools();
  const toolNames = getToolNames();

  return new LlmAgent({
    name: 'map_controller',
    model: process.env.GOOGLE_MODEL || 'gemini-2.5-flash',
    description: 'Controls an interactive map with AI-powered natural language commands',
    instruction: buildSystemPrompt(toolNames, initialState),
    tools,
  });
}
