import { ToolDefinition } from '../core/types';

export const ZOOM_MAP_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'zoom_map',
    description: 'Control the map zoom level. Use this when the user wants to zoom in or out.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['in', 'out'],
          description: 'Zoom direction: "in" to zoom in, "out" to zoom out'
        },
        levels: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          default: 1,
          description: 'Number of zoom levels to change (default: 1)'
        }
      },
      required: ['direction']
    }
  }
};
