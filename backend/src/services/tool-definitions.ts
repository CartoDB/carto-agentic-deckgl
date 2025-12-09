// backend/src/services/tool-definitions.ts
// Re-export from @carto/maps-ai-tools library

export {
  getAllToolDefinitions,
  getToolDefinitions,
  getToolDefinition,
  TOOL_NAMES,
  toolsDictionary,
  BUILTIN_TOOLS,
} from '@carto/maps-ai-tools';

export type { ToolName } from '@carto/maps-ai-tools';

// Alias for backward compatibility
export { getAllToolDefinitions as getToolSchemas } from '@carto/maps-ai-tools';
