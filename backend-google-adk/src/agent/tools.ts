/**
 * Tool definitions for Google ADK
 *
 * Defines core CARTO map tools using Google ADK's FunctionTool format
 * Uses Zod 3 (bundled with @google/adk) for schema definitions
 */

import { FunctionTool } from '@google/adk';
// Use Zod 3 for Google ADK compatibility
import { z } from 'zod/v3';

// Frontend tool result marker
interface FrontendToolResult {
  __frontend_tool__: true;
  toolName: string;
  data: unknown;
  [key: string]: unknown;
}

function createFrontendResult(toolName: string, data: unknown): FrontendToolResult {
  return { __frontend_tool__: true, toolName, data };
}

/**
 * Check if result is a frontend tool marker
 */
export function isFrontendToolResult(result: unknown): result is FrontendToolResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '__frontend_tool__' in result &&
    (result as FrontendToolResult).__frontend_tool__ === true
  );
}

// Helper to create tool with type casting for Zod compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTool(config: { name: string; description: string; parameters: any; execute: (args: any) => FrontendToolResult }): FunctionTool {
  return new FunctionTool(config);
}

/**
 * Create map tools for Google ADK
 */
export function createMapTools(): FunctionTool[] {
  return [
    // Navigation tools
    createTool({
      name: 'fly-to',
      description: 'Fly the map to a specific location with smooth animation.',
      parameters: z.object({
        lat: z.number().min(-90).max(90).describe('Latitude coordinate (-90 to 90)'),
        lng: z.number().min(-180).max(180).describe('Longitude coordinate (-180 to 180)'),
        zoom: z.number().min(0).max(22).default(12).describe('Zoom level (0-22). Default: 12'),
        pitch: z.number().min(0).max(85).default(0).describe('Map pitch in degrees (0-85). Default: 0'),
        bearing: z.number().min(-180).max(180).default(0).describe('Map bearing in degrees. Default: 0'),
        transitionDuration: z.number().min(0).default(1000).describe('Animation duration in ms. Default: 1000'),
      }),
      execute: (args) => createFrontendResult('fly-to', args),
    }),

    createTool({
      name: 'zoom-map',
      description: 'Zoom the map in or out.',
      parameters: z.object({
        direction: z.enum(['in', 'out']).describe('Zoom direction'),
        levels: z.number().min(1).max(10).default(1).describe('Number of zoom levels. Default: 1'),
      }),
      execute: (args) => createFrontendResult('zoom-map', args),
    }),

    createTool({
      name: 'set-view-state',
      description: 'Set absolute view state values like pitch, bearing, or exact zoom.',
      parameters: z.object({
        longitude: z.number().min(-180).max(180).optional().describe('Longitude'),
        latitude: z.number().min(-90).max(90).optional().describe('Latitude'),
        zoom: z.number().min(0).max(22).optional().describe('Zoom level'),
        pitch: z.number().min(0).max(85).optional().describe('Pitch in degrees'),
        bearing: z.number().min(-180).max(180).optional().describe('Bearing in degrees'),
        transitionDuration: z.number().min(0).default(500).describe('Animation duration. Default: 500'),
      }),
      execute: (args) => createFrontendResult('set-view-state', args),
    }),

    // Layer tools
    createTool({
      name: 'toggle-layer',
      description: 'Show or hide a map layer by its name or ID.',
      parameters: z.object({
        layerName: z.string().describe('The layer name or ID'),
        visible: z.boolean().describe('Whether the layer should be visible'),
      }),
      execute: (args) => createFrontendResult('toggle-layer', args),
    }),

    createTool({
      name: 'show-hide-layer',
      description: 'Show or hide a map layer.',
      parameters: z.object({
        layerId: z.string().describe('The layer ID'),
        visible: z.boolean().describe('true to show, false to hide'),
      }),
      execute: (args) => createFrontendResult('show-hide-layer', args),
    }),

    createTool({
      name: 'update-layer-style',
      description: 'Update visual styling of a map layer (colors, opacity, width).',
      parameters: z.object({
        layerId: z.string().describe('The layer ID to update'),
        fillColor: z.string().optional().describe('Fill color name or RGBA'),
        lineColor: z.string().optional().describe('Line/stroke color'),
        opacity: z.number().min(0).max(1).optional().describe('Opacity (0-1)'),
        visible: z.boolean().optional().describe('Visibility'),
        widthMinPixels: z.number().min(0).optional().describe('Minimum line width in pixels'),
      }),
      execute: (args) => createFrontendResult('update-layer-style', args),
    }),

    createTool({
      name: 'reset-visualization',
      description: 'Reset the visualization to its original state.',
      parameters: z.object({
        resetLayers: z.boolean().default(true).optional().describe('Reset layer styles'),
        resetViewState: z.boolean().default(false).optional().describe('Reset camera position'),
      }),
      execute: (args) => createFrontendResult('reset-visualization', args),
    }),
  ];
}

/**
 * Get tool names for system prompt
 */
export function getToolNames(): string[] {
  return [
    'fly-to',
    'zoom-map',
    'set-view-state',
    'toggle-layer',
    'show-hide-layer',
    'update-layer-style',
    'reset-visualization',
  ];
}
