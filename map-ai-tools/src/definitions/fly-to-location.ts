import { ToolDefinition } from '../core/types';

export const FLY_TO_LOCATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'fly_to_location',
    description: 'Navigate the map to a specific location using coordinates. The AI should convert city names or locations to coordinates.',
    parameters: {
      type: 'object',
      properties: {
        coordinates: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: 'Geographic coordinates as [longitude, latitude] in decimal degrees. Example: [-74.006, 40.7128] for New York City'
        },
        zoom: {
          type: 'number',
          description: 'Zoom level (0-20, default: 10)',
          minimum: 0,
          maximum: 20
        }
      },
      required: ['coordinates']
    }
  }
};
