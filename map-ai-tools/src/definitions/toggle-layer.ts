import { ToolDefinition } from '../core/types';

export const TOGGLE_LAYER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'toggle_layer',
    description: 'Show or hide map layers. Currently supports the points layer showing US cities.',
    parameters: {
      type: 'object',
      properties: {
        layer_id: {
          type: 'string',
          enum: ['points-layer'],
          description: 'The layer identifier. Use "points-layer" for the US cities layer.'
        },
        visible: {
          type: 'boolean',
          description: 'true to show the layer, false to hide it'
        }
      },
      required: ['layer_id', 'visible']
    }
  }
};
