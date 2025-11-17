import {
  MapToolsConfig,
  ExecutionContext,
  ExecutionResult,
  ToolInterceptors
} from './types';
import { ToolRegistry } from './tool-registry';
import { validateParameters } from './validation';

export class MapToolsExecutor {
  private registry: ToolRegistry;
  private context: ExecutionContext;
  private interceptors?: ToolInterceptors;

  constructor(config: MapToolsConfig) {
    this.registry = new ToolRegistry();

    // Filter tools if specified
    if (config.tools) {
      const allTools = this.registry.getToolNames();
      const toRemove = allTools.filter(name => !config.tools!.includes(name));
      toRemove.forEach(name => this.registry.removeTool(name));
    }

    // Register custom tools
    if (config.customTools) {
      config.customTools.forEach(tool => this.registry.registerTool(tool));
    }

    // Setup execution context
    this.context = {
      deck: config.deck,
      metadata: config.metadata
    };

    this.interceptors = config.toolInterceptors;
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, parameters: any): Promise<ExecutionResult> {
    try {
      // Get tool definition
      const definition = this.registry.getTool(toolName);
      if (!definition) {
        return {
          success: false,
          message: `Unknown tool: ${toolName}`,
          error: new Error(`Tool "${toolName}" not found in registry`)
        };
      }

      // Validate parameters
      const validation = validateParameters(toolName, parameters, definition);
      if (!validation.valid) {
        return {
          success: false,
          message: `Invalid parameters: ${validation.errors.join(', ')}`,
          error: new Error(validation.errors.join('; '))
        };
      }

      // Get executor
      const executor = this.registry.getExecutor(toolName);
      if (!executor) {
        return {
          success: false,
          message: `No executor found for tool: ${toolName}`,
          error: new Error(`Executor for "${toolName}" not registered`)
        };
      }

      // Before interceptor
      if (this.interceptors?.beforeExecute) {
        await this.interceptors.beforeExecute(toolName, parameters);
      }

      // Execute tool
      const result = await Promise.resolve(executor(parameters, this.context));

      // After interceptor
      if (this.interceptors?.afterExecute) {
        await this.interceptors.afterExecute(toolName, result);
      }

      return result;

    } catch (error) {
      const err = error as Error;

      // Error interceptor
      if (this.interceptors?.onError) {
        await this.interceptors.onError(toolName, err);
      }

      return {
        success: false,
        message: `Tool execution failed: ${err.message}`,
        error: err
      };
    }
  }

  /**
   * Get all available tool names
   */
  getAvailableTools(): string[] {
    return this.registry.getToolNames();
  }

  /**
   * Check if tool is available
   */
  hasTool(toolName: string): boolean {
    return this.registry.hasTool(toolName);
  }
}
