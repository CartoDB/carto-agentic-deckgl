/**
 * MCP Tools wrapper for Vercel AI SDK v6
 *
 * Connects to MCP servers and provides tools in Vercel AI SDK format.
 */

import { tool, type Tool } from 'ai';
import {
  getMCPClient,
  getAllMCPClients,
  closeAllMCPClients,
  parseMCPServerConfigs,
} from '../services/mcp-client.js';

// Track initialization state
let mcpInitialized = false;
let mcpToolCache: Record<string, Tool> = {};

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

      // Convert to Vercel AI SDK format
      for (const def of toolDefs) {
        mcpToolCache[def.name] = tool({
          description: def.description,
          inputSchema: def.inputSchema,
          execute: def.execute,
        });
      }

      console.log(`[MCP] ${config.name}: ${toolDefs.length} tools loaded`);
    } catch (error) {
      console.error(`[MCP] ${config.name}: failed to initialize -`, (error as Error).message);
    }
  }

  mcpInitialized = true;
}

/**
 * Get all MCP tools in Vercel AI SDK format
 */
export function getMCPTools(): Record<string, Tool> {
  return { ...mcpToolCache };
}

/**
 * Get MCP tool names
 */
export function getMCPToolNames(): string[] {
  return Object.keys(mcpToolCache);
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
  mcpToolCache = {};
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
    toolCount: Object.keys(mcpToolCache).length,
  };
}
