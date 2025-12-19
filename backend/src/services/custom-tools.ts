// backend/src/services/custom-tools.ts
import { z } from 'zod';
import { getMCPClient, parseMCPServerConfigs } from './mcp-client.js';

/**
 * Custom backend tools following the same structure as CARTO tools
 * Each tool has: name, description, schema (Zod schema), and optional execute function
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

// Static custom tools
const staticCustomTools = {
  weather: weatherTool,
  // Add more custom tools here as needed
  // example: exampleTool,
} as const;

// Cache for all custom tools (static + MCP)
let allCustomToolsCache: Record<string, any> = { ...staticCustomTools };
let mcpToolsInitialized = false;

/**
 * Initialize and fetch MCP tools from all configured MCP servers
 * This should be called at server startup
 */
export async function initializeMCPTools() {
  if (mcpToolsInitialized) {
    return;
  }

  try {
    console.log('[Custom Tools] Initializing MCP tools...');

    // Parse MCP server configurations from environment
    const mcpConfigs = parseMCPServerConfigs();

    if (mcpConfigs.length === 0) {
      console.log('[Custom Tools] No MCP servers configured');
      mcpToolsInitialized = true;
      return;
    }

    console.log(`[Custom Tools] Found ${mcpConfigs.length} MCP server(s) to initialize`);

    let totalToolsAdded = 0;

    // Initialize each MCP server
    for (const config of mcpConfigs) {
      try {
        console.log(`[Custom Tools] Connecting to MCP server: ${config.name} (${config.url})`);
        if (config.whitelist) {
          console.log(`[Custom Tools] Whitelist for ${config.name}:`, config.whitelist);
        }

        const mcpClient = await getMCPClient(config);
        const mcpToolDefinitions = mcpClient.getToolDefinitions(config.whitelist);

        // Add MCP tools to cache with server name prefix
        for (const tool of mcpToolDefinitions) {
          // Prefix tool name with server name to avoid conflicts
          const prefixedToolName = `${config.name}_${tool.name}`;
          allCustomToolsCache[prefixedToolName] = {
            ...tool,
            name: prefixedToolName,
            description: `[${config.name}] ${tool.description}`
          };
          console.log(`[Custom Tools] Added MCP tool: ${prefixedToolName}`);
          totalToolsAdded++;
        }

        console.log(`[Custom Tools] Initialized ${mcpToolDefinitions.length} tools from ${config.name}`);
      } catch (error) {
        console.error(`[Custom Tools] Failed to initialize MCP server ${config.name}:`, error);
        // Continue with other servers even if one fails
      }
    }

    mcpToolsInitialized = true;
    console.log(`[Custom Tools] Initialized ${totalToolsAdded} MCP tools from ${mcpConfigs.length} server(s)`);
  } catch (error) {
    console.error('[Custom Tools] Failed to initialize MCP tools:', error);
    // Continue without MCP tools if initialization fails
    mcpToolsInitialized = true;
  }
}

// Export all custom tools as an object (synchronous access)
// Note: Call initializeMCPTools() first to include MCP tools
export const customTools = allCustomToolsCache;

// Type for custom tool names
export type CustomToolName = keyof typeof staticCustomTools | string;

/**
 * Export tool names for easy access (includes MCP tools after initialization)
 */
export const getCustomToolNames = (): string[] => {
  return Object.keys(allCustomToolsCache);
};

/**
 * Helper to get a custom tool by name (includes MCP tools after initialization)
 */
export const getCustomTool = (toolName: string) => {
  return allCustomToolsCache[toolName];
};
