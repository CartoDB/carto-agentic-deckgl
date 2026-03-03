/**
 * MCP Tools wrapper for Google ADK
 *
 * Connects to MCP servers and provides tools as FunctionTool[] for ADK.
 *
 * Key differences from OpenAI Agents SDK version:
 * - Uses FunctionTool from @google/adk (not tool() from @openai/agents)
 * - execute returns objects (not JSON.stringify strings)
 * - Zod schema passes directly to FunctionTool (no JSON Schema conversion needed)
 * - No normalizeMCPSchema() needed (ADK is more lenient than OpenAI API)
 */

import { FunctionTool } from '@google/adk';
import {
  getMCPClient,
  getAllMCPClients,
  closeAllMCPClients,
  parseMCPServerConfigs,
} from '../services/mcp-client.js';

// Track initialization state
let mcpInitialized = false;
let mcpToolCache: FunctionTool[] = [];

/**
 * Initialize MCP clients from environment configuration
 */
export async function initializeMCPClients(): Promise<void> {
  if (mcpInitialized) {
    return;
  }

  const configs = parseMCPServerConfigs();

  if (configs.length === 0) {
    mcpInitialized = true;
    return;
  }

  for (const config of configs) {
    try {
      const client = await getMCPClient(config);
      const toolDefs = client.getToolDefinitions(config.whitelist);

      // Convert to Google ADK FunctionTool format
      for (const def of toolDefs) {
        mcpToolCache.push(
          new FunctionTool({
            name: def.name,
            description: def.description,
            parameters: def.inputSchema, // Zod v4 schema from mcp-client.ts
            execute: async (args) => {
              const result = await def.execute(args as Record<string, unknown>);
              // Return object directly (not JSON.stringify like OpenAI version)
              if (typeof result === 'string') {
                try {
                  return JSON.parse(result);
                } catch {
                  return { text: result };
                }
              }
              return result as Record<string, unknown>;
            },
          })
        );
      }

      console.log(`[MCP:${config.name}] ${toolDefs.length} tools loaded`);
    } catch (error) {
      console.error(`[MCP:${config.name}] failed to initialize -`, (error as Error).message);
    }
  }

  mcpInitialized = true;
}

/**
 * Get all MCP tools as FunctionTool array
 */
export function getMCPTools(): FunctionTool[] {
  return [...mcpToolCache];
}

/**
 * Get MCP tool names
 */
export function getMCPToolNames(): string[] {
  return mcpToolCache.map((t) => t.name);
}

/**
 * Check if MCP is initialized
 */
export function isMCPInitialized(): boolean {
  return mcpInitialized;
}

/**
 * Close all MCP connections
 */
export async function closeMCPConnections(): Promise<void> {
  await closeAllMCPClients();
  mcpToolCache = [];
  mcpInitialized = false;
}

/**
 * Get MCP status info for health checks
 */
export function getMCPStatus(): {
  initialized: boolean;
  servers: string[];
  toolCount: number;
} {
  const clients = getAllMCPClients();
  return {
    initialized: mcpInitialized,
    servers: Array.from(clients.keys()),
    toolCount: mcpToolCache.length,
  };
}
