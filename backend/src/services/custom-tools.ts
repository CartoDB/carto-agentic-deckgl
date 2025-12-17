// backend/src/services/custom-tools.ts
import { z } from 'zod';

/**
 * Custom backend tools following the same structure as CARTO tools
 * Each tool has: name, description, and schema (Zod schema)
 *
 * IMPORTANT LIMITATION:
 * When using Gemini via CARTO LiteLLM, custom tools with execute functions
 * may not work due to API response format incompatibility. The Gemini API
 * returns "text: null" when calling tools, which causes Vercel AI SDK validation
 * errors. Custom tools are still defined and sent to the AI, but execution fails.
 *
 * Workarounds:
 * 1. Use OpenAI API directly (recommended for custom tools)
 * 2. Contact CARTO about standard OpenAI-compatible response format
 * 3. Remove execute functions and handle tool calls on the frontend
 * 4. Accept that custom backend tools won't work with current setup
 * 5. Improve system prompt to be more specific about when to call tools
 */

export const weatherTool = {
  name: 'weather',
  description: 'Get the current weather in a specific location',
  schema: z.object({
    location: z.string().describe('The location to get the weather for (city name or address)'),
  }),
  execute: async ({ location }: { location: string }) => ({
    location,
    temperature: 72 + Math.floor(Math.random() * 21) - 10,
    condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
    humidity: 40 + Math.floor(Math.random() * 40),
  }),
};

// Export all custom tools as an object
export const customTools = {
  weather: weatherTool,
  // Add more custom tools here as needed
  // example: exampleTool,
} as const;

// Type for custom tool names
export type CustomToolName = keyof typeof customTools;

// Export tool names for easy access
export const getCustomToolNames = (): CustomToolName[] => {
  return Object.keys(customTools) as CustomToolName[];
};

// Helper to get a custom tool by name
export const getCustomTool = (toolName: string) => {
  return customTools[toolName as CustomToolName];
};
