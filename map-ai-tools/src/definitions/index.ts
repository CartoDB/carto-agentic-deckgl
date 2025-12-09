import { ToolDefinition } from '../core/types';

// Export Zod-based tools (primary API)
export {
  tools,
  getToolNames,
  getTool,
  getToolDefinition,
  getAllToolDefinitions,
  getToolDefinitionsByNames,
  validateToolParams,
} from './tools';

export type { ToolName } from './tools';

// Export dictionary constants (backwards compatibility)
export {
  TOOL_NAMES,
  toolsDictionary,
  toolSchemas,
  // Deprecated aliases
  getToolSchema,
  getAllToolSchemas,
  getToolSchemasByNames,
} from './dictionary';

// Import for BUILTIN_TOOLS
import { tools, getAllToolDefinitions as getAll, getToolDefinition as getToolDef, type ToolName } from './tools';

/**
 * Registry of all built-in tools (kebab-case keys)
 * Now uses Zod-based tool definitions
 */
export const BUILTIN_TOOLS: Record<string, ToolDefinition> = Object.fromEntries(
  (Object.keys(tools) as ToolName[]).map(name => [name, getToolDef(name) as ToolDefinition])
) as Record<string, ToolDefinition>;

/**
 * Get tool definitions by name
 * @param toolNames - Array of tool names to include (default: all)
 */
export function getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
  if (toolNames) {
    return toolNames
      .filter(name => name in tools)
      .map(name => getToolDef(name as ToolName) as ToolDefinition);
  }
  return getAll() as ToolDefinition[];
}
