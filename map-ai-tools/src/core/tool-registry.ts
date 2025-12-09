import { ToolDefinition, CustomToolDefinition } from './types';
import { BUILTIN_TOOLS } from '../definitions';
import { BUILTIN_EXECUTORS } from '../executors';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executors: Map<string, any> = new Map();

  constructor() {
    // Register built-in tools (now Zod-based)
    Object.entries(BUILTIN_TOOLS).forEach(([name, definition]) => {
      this.tools.set(name, definition);
    });

    // Register built-in executors
    Object.entries(BUILTIN_EXECUTORS).forEach(([name, executor]) => {
      this.executors.set(name, executor);
    });
  }

  /**
   * Register a custom tool
   */
  registerTool(customTool: CustomToolDefinition): void {
    this.tools.set(customTool.name, customTool.definition);
    this.executors.set(customTool.name, customTool.executor);
  }

  /**
   * Remove a tool from the registry
   */
  removeTool(toolName: string): void {
    this.tools.delete(toolName);
    this.executors.delete(toolName);
  }

  /**
   * Get tool definition by name
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get executor by tool name
   */
  getExecutor(toolName: string): any | undefined {
    return this.executors.get(toolName);
  }

  /**
   * Get all registered tool definitions
   */
  getAllTools(toolNames?: string[]): ToolDefinition[] {
    if (toolNames) {
      return toolNames
        .map(name => this.tools.get(name))
        .filter((tool): tool is ToolDefinition => tool !== undefined);
    }
    return Array.from(this.tools.values());
  }

  /**
   * Check if tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
