/**
 * MCP Tools wrapper for OpenAI Agents SDK
 *
 * Connects to MCP servers and provides tools in OpenAI Agents SDK format.
 *
 * NOTE: OpenAI API requires all properties to be in the 'required' array.
 * We normalize MCP tool schemas to ensure compatibility.
 */

import { tool, type Tool } from '@openai/agents';
import {
  getMCPClient,
  getAllMCPClients,
  closeAllMCPClients,
  parseMCPServerConfigs,
} from '../services/mcp-client.js';

/**
 * JSON Object Schema type expected by OpenAI Agents SDK
 */
type JsonObjectSchemaNonStrict = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: true;
};

/**
 * Normalize MCP tool schema to be compatible with OpenAI API
 * OpenAI requires all properties to be listed in 'required' array
 */
function normalizeMCPSchema(inputSchema: unknown): JsonObjectSchemaNonStrict {
  const schema = inputSchema as Record<string, unknown>;

  // Get properties from schema
  const properties = (schema.properties as Record<string, unknown>) || {};

  // OpenAI API requires ALL properties to be in required array
  const required = Object.keys(properties);

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

// Track initialization state
let mcpInitialized = false;
let mcpToolCache: Tool[] = [];

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

      // Convert to OpenAI Agents SDK format
      for (const def of toolDefs) {
        // Normalize schema to ensure all properties are in required array
        const normalizedSchema = normalizeMCPSchema(def.inputSchema);

        mcpToolCache.push(
          tool({
            name: def.name,
            description: def.description,
            parameters: normalizedSchema,
            strict: false,
            execute: async (args: unknown): Promise<string> => {
              const result = await def.execute(args as Record<string, unknown>);
              return typeof result === 'string' ? result : JSON.stringify(result);
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
 * Get all MCP tools in OpenAI Agents SDK format
 */
export function getMCPTools(): Tool[] {
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
