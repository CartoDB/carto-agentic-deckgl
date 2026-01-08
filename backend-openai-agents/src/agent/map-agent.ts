/**
 * Map Control Agent definition
 */

import { Agent } from '@openai/agents';
import { createMapTools, getToolNames } from './tools.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState } from '../types/messages.js';

/**
 * Create a map control agent with the given initial state
 */
export function createMapAgent(initialState?: InitialState) {
  const tools = createMapTools();
  const toolNames = getToolNames();

  return new Agent({
    name: 'MapController',
    instructions: buildSystemPrompt(toolNames, initialState),
    tools,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  });
}
