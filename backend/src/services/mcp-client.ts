/**
 * MCP Client for Vercel AI SDK v6
 *
 * Connects to remote MCP servers and provides tools with whitelist filtering.
 * Uses Streamable HTTP transport and Zod 4 for schema conversion.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool definition compatible with Vercel AI SDK
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodObject<Record<string, z.ZodType>>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// Server configuration
export interface MCPServerConfig {
  name: string;
  url: string;
  apiKey?: string;
  whitelist?: string[];
}

/**
 * MCP Client with whitelist support
 */
export class MCPClient {
  private client: Client | null = null;
  private tools: Map<string, Tool> = new Map();
  private connected = false;
  private readonly mcpUrl: string;
  private readonly apiKey?: string;
  private readonly serverName: string;

  constructor(config: MCPServerConfig) {
    this.mcpUrl = config.url;
    this.apiKey = config.apiKey;
    this.serverName = config.name;
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log(`[MCP:${this.serverName}] Already connected`);
      return;
    }

    try {
      // Build request headers for authentication
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Create Streamable HTTP transport (using SDK's built-in transport)
      const transport = new StreamableHTTPClientTransport(
        new URL(this.mcpUrl),
        {
          requestInit: {
            headers,
          },
        }
      );

      // Create MCP client
      this.client = new Client(
        {
          name: `vercel-ai-mcp-client-${this.serverName}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect and fetch tools
      await this.client.connect(transport);
      await this.fetchTools();
      this.connected = true;
    } catch (error) {
      console.error(`[MCP:${this.serverName}] Connection error:`, error);
      throw new Error(`Failed to connect to MCP server ${this.serverName}: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch available tools from the MCP server
   */
  private async fetchTools(): Promise<void> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    const response = await this.client.listTools();

    this.tools.clear();
    for (const tool of response.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Get tool definitions with optional whitelist filtering
   */
  getToolDefinitions(whitelist?: string[]): MCPToolDefinition[] {
    const definitions: MCPToolDefinition[] = [];
    let skippedCount = 0;

    for (const [name, tool] of this.tools.entries()) {
      // Skip if not in whitelist
      if (whitelist && whitelist.length > 0 && !whitelist.includes(name)) {
        skippedCount++;
        continue;
      }

      try {
        // Sanitize tool name (OpenAI requires ^[a-zA-Z0-9_-]+$)
        const sanitizedName = this.sanitizeToolName(name);

        // Convert JSON Schema to Zod using Zod 4's native support
        const inputSchema = this.jsonSchemaToZod(tool.inputSchema);

        definitions.push({
          name: sanitizedName,
          description: tool.description || `MCP tool: ${name}`,
          inputSchema,
          execute: async (args: Record<string, unknown>) => {
            return await this.executeTool(name, args);
          },
        });
      } catch (error) {
        console.error(`[MCP:${this.serverName}] Error converting tool ${name}:`, error);
      }
    }

    if (skippedCount > 0) {
      console.log(`[MCP:${this.serverName}] Skipped ${skippedCount} tools (not in whitelist)`);
    }

    return definitions;
  }

  /**
   * Sanitize tool name for OpenAI compatibility
   */
  private sanitizeToolName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Convert JSON Schema to Zod schema
   * Uses manual conversion to ensure compatibility with Vercel AI SDK
   */
  private jsonSchemaToZod(jsonSchema: unknown): z.ZodObject<Record<string, z.ZodType>> {
    const schema = jsonSchema as Record<string, unknown>;

    if (!schema || typeof schema !== 'object' || !schema.properties) {
      return z.object({});
    }

    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const required = (schema.required as string[]) || [];
    const shape: Record<string, z.ZodType> = {};

    for (const [key, prop] of Object.entries(properties)) {
      let zodType: z.ZodType;

      switch (prop.type) {
        case 'string':
          zodType = prop.description
            ? z.string().describe(prop.description as string)
            : z.string();
          break;
        case 'number':
        case 'integer':
          zodType = prop.description
            ? z.number().describe(prop.description as string)
            : z.number();
          break;
        case 'boolean':
          zodType = prop.description
            ? z.boolean().describe(prop.description as string)
            : z.boolean();
          break;
        case 'array':
          zodType = prop.description
            ? z.array(z.unknown()).describe(prop.description as string)
            : z.array(z.unknown());
          break;
        case 'object':
          zodType = prop.description
            ? z.record(z.string(), z.unknown()).describe(prop.description as string)
            : z.record(z.string(), z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * Execute a tool on the MCP server
   */
  async executeTool(toolName: string, args: unknown): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    if (!this.tools.has(toolName)) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    console.log(`[MCP:${this.serverName}] Executing: ${toolName}`);

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args as Record<string, unknown>,
      });

      console.log(`[MCP:${this.serverName}] Response received for: ${toolName}`);

      // Extract content from response
      const content = response.content as Array<{ type: string; text?: string; resource?: unknown }>;
      if (content && Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (first.type === 'text' && first.text) {
          // Try to parse as JSON
          try {
            const parsed = JSON.parse(first.text);
            console.log(`[MCP:${this.serverName}] Parsed result:`, JSON.stringify(parsed).substring(0, 150));
            return parsed;
          } catch {
            return { text: first.text };
          }
        }
        return first;
      }

      return response;
    } catch (error) {
      console.error(`[MCP:${this.serverName}] Error executing ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.connected = false;
      } catch {
        // Ignore disconnect errors
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server name
   */
  getServerName(): string {
    return this.serverName;
  }
}

// Store MCP client instances
const mcpClients: Map<string, MCPClient> = new Map();

/**
 * Get or create an MCP client by config
 */
export async function getMCPClient(config: MCPServerConfig): Promise<MCPClient> {
  const existing = mcpClients.get(config.name);
  if (existing?.isConnected()) {
    return existing;
  }

  const client = new MCPClient(config);
  await client.connect();
  mcpClients.set(config.name, client);

  return client;
}

/**
 * Get all MCP clients
 */
export function getAllMCPClients(): Map<string, MCPClient> {
  return mcpClients;
}

/**
 * Close all MCP clients
 */
export async function closeAllMCPClients(): Promise<void> {
  for (const [name, client] of mcpClients) {
    await client.disconnect();
    mcpClients.delete(name);
  }
}

/**
 * Parse MCP server configurations from environment variables
 *
 * Supports:
 * - CARTO_MCP_URL + CARTO_MCP_API_KEY (single server)
 * - MCP_WHITELIST_CARTO=tool1,tool2,tool3 (optional whitelist)
 */
export function parseMCPServerConfigs(): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  // Check for CARTO MCP server
  const cartoUrl = process.env.CARTO_MCP_URL;
  if (cartoUrl) {
    const whitelistEnv = process.env.MCP_WHITELIST_CARTO;
    const whitelist = whitelistEnv ? whitelistEnv.split(',').map((t) => t.trim()) : undefined;

    configs.push({
      name: 'carto',
      url: cartoUrl,
      apiKey: process.env.CARTO_MCP_API_KEY,
      whitelist,
    });
  }

  return configs;
}
