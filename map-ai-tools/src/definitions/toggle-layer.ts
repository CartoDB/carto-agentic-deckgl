import { ToolDefinition } from '../core/types';

export const TOGGLE_LAYER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'toggle_layer',
    description: 'Show or hide a map layer by its name. Available layers: Airports.',
    parameters: {
      type: 'object',
      properties: {
        layerName: {
          type: 'string',
          description: 'The name of the layer to toggle (e.g., "Airports")'
        },
        visible: {
          type: 'boolean',
          description: 'Whether the layer should be visible (true) or hidden (false)'
        }
      },
      required: ['layerName', 'visible']
    }
  }
};
