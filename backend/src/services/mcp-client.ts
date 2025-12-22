// backend/src/services/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { CustomSSETransport } from './custom-sse-transport.js';

interface MCPToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  jsonSchema: any; // Store original JSON Schema for OpenAI
  execute: (args: any) => Promise<any>;
}

export class MCPClient {
  private client: Client | null = null;
  private tools: Map<string, Tool> = new Map();
  private connected: boolean = false;
  private mcpUrl: string;
  private apiKey?: string;

  constructor(mcpUrl: string, apiKey?: string) {
    this.mcpUrl = mcpUrl;
    this.apiKey = apiKey;
  }

  /**
   * Connect to the MCP server and fetch available tools
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.log('[MCP] Already connected');
      return;
    }

    try {
      console.log('[MCP] Connecting to MCP server:', this.mcpUrl);

      // Create custom SSE transport with authentication headers
      const headers: Record<string, string> = {};

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const transport = new CustomSSETransport({
        url: this.mcpUrl,
        headers
      });

      // Create MCP client
      this.client = new Client({
        name: 'carto-mcp-client',
        version: '1.0.0',
      }, {
        capabilities: {}
      });

      // Connect to the server
      await this.client.connect(transport);

      console.log('[MCP] Connected successfully');

      // Fetch available tools
      await this.fetchTools();

      this.connected = true;
    } catch (error) {
      console.error('[MCP] Connection error:', error);
      throw new Error(`Failed to connect to MCP server: ${(error as Error).message}`);
    }
  }


  /**
   * Fetch available tools from the MCP server
   */
  private async fetchTools(): Promise<void> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    try {
      console.log('[MCP] Fetching available tools...');

      const response = await this.client.listTools();

      console.log('[MCP] Found tools:', response.tools.length);

      // Store tools in a map for easy access
      this.tools.clear();
      for (const tool of response.tools) {
        this.tools.set(tool.name, tool);
        console.log(`[MCP] - ${tool.name}: ${tool.description}`);
      }
    } catch (error) {
      console.error('[MCP] Error fetching tools:', error);
      throw error;
    }
  }

  /**
   * Get all tools converted to custom tool format
   * @param whitelist Optional array of tool names to include (filters out others)
   */
  getToolDefinitions(whitelist?: string[]): MCPToolDefinition[] {
    const definitions: MCPToolDefinition[] = [];

    for (const [name, tool] of this.tools.entries()) {
      // Skip if whitelist is provided and tool is not in it
      if (whitelist && whitelist.length > 0 && !whitelist.includes(name)) {
        console.log(`[MCP] Skipping tool ${name} (not in whitelist)`);
        continue;
      }

      try {
        // Sanitize tool name for OpenAI (only a-zA-Z0-9_-)
        const sanitizedName = this.sanitizeToolName(name);

        // Convert MCP tool schema (JSON Schema) to Zod schema for validation
        const zodSchema = this.jsonSchemaToZod(tool.inputSchema);

        // Store both Zod (for validation) and original JSON Schema (for OpenAI)
        definitions.push({
          name: sanitizedName,
          description: tool.description || `MCP tool: ${name}`,
          schema: zodSchema,
          jsonSchema: tool.inputSchema, // Keep original JSON Schema
          execute: async (args: any) => {
            return await this.executeTool(name, args);
          },
        });

        console.log(`[MCP] Added tool: ${name} -> ${sanitizedName}`);
      } catch (error) {
        console.error(`[MCP] Error converting tool ${name}:`, error);
      }
    }

    return definitions;
  }

  /**
   * Sanitize tool name to match OpenAI's requirements: ^[a-zA-Z0-9_-]+$
   */
  private sanitizeToolName(name: string): string {
    // Replace any character that's not a-z, A-Z, 0-9, _, or - with underscore
    return name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Convert JSON Schema to Zod schema
   * This is a simplified converter - you may need to extend it based on your needs
   */
  private jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
    const shape: Record<string, z.ZodTypeAny> = {};

    if (!jsonSchema || typeof jsonSchema !== 'object' || !jsonSchema.properties) {
      // Return empty object schema if no properties defined
      return z.object({});
    }

    const properties = jsonSchema.properties as Record<string, any>;
    const required = (jsonSchema.required as string[]) || [];

    for (const [key, value] of Object.entries(properties)) {
      const prop = value as any;

      // Convert JSON Schema types to Zod types
      let zodType: z.ZodTypeAny;

      switch (prop.type) {
        case 'string':
          zodType = z.string();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case 'boolean':
          zodType = z.boolean();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case 'array':
          // Simplified array handling
          zodType = z.array(z.any());
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case 'object':
          // Simplified object handling
          zodType = z.record(z.string(), z.any());
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        default:
          zodType = z.any();
      }

      // Handle optional fields
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
  async executeTool(toolName: string, args: any): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    if (!this.tools.has(toolName)) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      console.log(`[MCP] Executing tool: ${toolName}`, args);

      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      console.log(`[MCP] Tool execution result:`, response);

      // Extract content from response
      const content = response.content as any[];
      if (content && Array.isArray(content) && content.length > 0) {
        // Return the first content item
        const firstContent = content[0];

        if (firstContent.type === 'text') {
          return { text: firstContent.text };
        } else if (firstContent.type === 'resource') {
          return { resource: firstContent };
        } else {
          return firstContent;
        }
      }

      return response;
    } catch (error) {
      console.error(`[MCP] Error executing tool ${toolName}:`, error);
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
        console.log('[MCP] Disconnected');
      } catch (error) {
        console.error('[MCP] Error disconnecting:', error);
      }
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// Multiple MCP server configuration
export interface MCPServerConfig {
  name: string;
  url: string;
  apiKey?: string;
  whitelist?: string[]; // Optional: only load these tools
}

// Store multiple MCP client instances
const mcpClientInstances: Map<string, MCPClient> = new Map();

/**
 * Initialize and get a specific MCP client by name
 */
export async function getMCPClient(config: MCPServerConfig): Promise<MCPClient> {
  const { name, url, apiKey } = config;

  // Return existing client if already initialized
  if (mcpClientInstances.has(name)) {
    return mcpClientInstances.get(name)!;
  }

  // Create new client
  const client = new MCPClient(url, apiKey);

  // Connect on first access
  if (!client.isConnected()) {
    await client.connect();
  }

  // Store client instance
  mcpClientInstances.set(name, client);

  return client;
}

/**
 * Get all initialized MCP clients
 */
export function getAllMCPClients(): Map<string, MCPClient> {
  return mcpClientInstances;
}

/**
 * Parse MCP server configurations from environment variables
 * Supports format:
 * MCP_SERVERS=carto:https://...:apikey,other:https://...:apikey2
 * MCP_WHITELIST_CARTO=tool1,tool2,tool3 (optional, filters tools for 'carto' server)
 *
 * Or individual variables:
 * CARTO_MCP_URL, CARTO_MCP_API_KEY (legacy format)
 */
export function parseMCPServerConfigs(): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  // Check for new format: MCP_SERVERS
  const mcpServersEnv = process.env.MCP_SERVERS;
  if (mcpServersEnv) {
    const serverEntries = mcpServersEnv.split(',').map(s => s.trim());

    for (const entry of serverEntries) {
      const parts = entry.split(':');
      if (parts.length >= 2) {
        const name = parts[0];
        const url = parts.slice(1, -1).join(':'); // Handle URLs with colons
        const apiKey = parts[parts.length - 1];

        // Check for whitelist env variable for this server
        // e.g., MCP_WHITELIST_CARTO for server named "carto"
        const whitelistEnvKey = `MCP_WHITELIST_${name.toUpperCase()}`;
        const whitelistEnv = process.env[whitelistEnvKey];
        const whitelist = whitelistEnv ? whitelistEnv.split(',').map(t => t.trim()) : undefined;

        configs.push({
          name,
          url: url || parts[1], // Fallback if no API key
          apiKey: apiKey !== url ? apiKey : undefined,
          whitelist
        });
      }
    }
  }

  // Check for legacy single server format
  if (configs.length === 0 && process.env.CARTO_MCP_URL) {
    const whitelistEnv = process.env.MCP_WHITELIST_CARTO;
    const whitelist = whitelistEnv ? whitelistEnv.split(',').map(t => t.trim()) : undefined;

    configs.push({
      name: 'carto',
      url: process.env.CARTO_MCP_URL,
      apiKey: process.env.CARTO_MCP_API_KEY,
      whitelist
    });
  }

  return configs;
}
