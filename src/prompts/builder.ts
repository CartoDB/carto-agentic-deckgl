/**
 * System prompt builder for map control agent
 */

import { TOOL_NAMES } from '../definitions/dictionary.js';
import { toolPrompts } from './tool-prompts.js';
import { sharedSections } from './shared-sections.js';
import type { BuildSystemPromptOptions, MapState, UserContext } from './types.js';

/**
 * Ordered list of tools for consistent prompt generation
 */
const ORDERED_TOOLS = [
  TOOL_NAMES.SET_DECK_STATE,
  TOOL_NAMES.SET_MARKER,
  TOOL_NAMES.SET_MASK_LAYER,
];

/**
 * Build the system prompt for the map control agent
 *
 * Uses CONSOLIDATED tool pattern (1 tool instead of 40+)
 */
export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const {
    toolNames,
    initialState,
    userContext,
    semanticContext,
    mcpToolNames,
    additionalPrompt,
  } = options;

  let prompt = `You are a helpful map assistant that controls an interactive deck.gl map visualization.

## AVAILABLE TOOLS

You have 3 consolidated tools for complete map control:

`;

  // Add tool prompts dynamically based on available tools
  for (const toolName of ORDERED_TOOLS) {
    if (toolNames.includes(toolName) && toolPrompts[toolName]) {
      prompt += toolPrompts[toolName].prompt + '\n\n';
    }
  }

  // Add workflow patterns and guidelines
  prompt += sharedSections.workflowPatterns + '\n\n';
  prompt += sharedSections.guidelines + '\n\n';

  // Add current state context
  if (initialState) {
    prompt += buildMapStateSection(initialState);
  }

  // List available tools
  if (toolNames.length > 0) {
    prompt += `\n## TOOLS AVAILABLE: ${toolNames.join(', ')}\n`;
  }

  // Add CARTO MCP tool instructions if those tools are available
  const hasMcpTools = mcpToolNames && mcpToolNames.length > 0;
  const hasAsyncWorkflowTools = mcpToolNames
    ? mcpToolNames.includes('async_workflow_job_get_status_v1_0_0') &&
      mcpToolNames.includes('async_workflow_job_get_results_v1_0_0')
    : false;

  if (hasMcpTools) {
    prompt += '\n' + sharedSections.mcpInstructions + '\n';

    if (hasAsyncWorkflowTools) {
      prompt += sharedSections.mcpAsyncWorkflow + '\n';
      prompt += '\n' + sharedSections.mcpLayerIsolation + '\n';
    } else {
      prompt += sharedSections.mcpAsyncUnavailable + '\n';
    }

    prompt += '\n' + sharedSections.mcpCriticalRules + '\n';
  }

  // Inject semantic context if provided (app-specific)
  if (semanticContext) {
    prompt += '\n' + semanticContext;
  }

  // Inject user context if provided
  if (userContext) {
    prompt += buildUserContextSection(userContext);
  }

  // Inject additional prompt if provided (app-specific)
  if (additionalPrompt) {
    prompt += '\n' + additionalPrompt;
  }

  return prompt;
}

/**
 * Build map state section for the system prompt
 */
export function buildMapStateSection(state: MapState): string {
  let section = `\n## CURRENT MAP STATE\n`;

  // Handle both viewState and initialViewState formats
  const vs = state.viewState || state.initialViewState;
  if (vs) {
    section += `- Position: lat=${vs.latitude.toFixed(4)}, lng=${vs.longitude.toFixed(4)}, zoom=${vs.zoom.toFixed(1)}\n`;
    if (vs.pitch) section += `- Pitch: ${vs.pitch}\u00B0\n`;
    if (vs.bearing) section += `- Bearing: ${vs.bearing}\u00B0\n`;
  }

  // Handle layers array - show stacking order clearly
  // Filter out system layers (__ prefix) like the location marker
  const displayLayers = (state.layers || []).filter(l => {
    const id = (l.id as string) || '';
    return !id.startsWith('__');
  });
  if (displayLayers.length > 0) {
    section += `- Current layers (render order, BOTTOM to TOP):\n`;
    const layerCount = displayLayers.length;
    for (let i = 0; i < layerCount; i++) {
      const layer = displayLayers[i];
      const layerType = layer.type || 'unknown';
      const visibility = layer.visible !== false ? 'visible' : 'hidden';
      const isActive = layer.id === state.activeLayerId ? ' \u2190 ACTIVE' : '';
      const position = i === 0 ? ' [BOTTOM]' : i === layerCount - 1 ? ' [TOP]' : '';
      section += `  ${i + 1}. "${layer.id}" (${layerType}, ${visibility})${position}${isActive}\n`;

      // Include style context if available (helps AI understand current styling)
      const styleContext = layer.styleContext as Record<string, unknown> | undefined;
      if (styleContext) {
        if (styleContext.filters) {
          section += `      Filters: ${JSON.stringify(styleContext.filters)}\n`;
        }
        if (styleContext.getFillColor) {
          section += `      Fill color styling: ${JSON.stringify(styleContext.getFillColor)}\n`;
        }
        if (styleContext.getLineColor) {
          section += `      Line color styling: ${JSON.stringify(styleContext.getLineColor)}\n`;
        }
      }
    }
  } else {
    section += `- No layers currently on map\n`;
  }

  // Show active layer prominently
  if (state.activeLayerId) {
    section += `- **Active layer**: "${state.activeLayerId}" (use this ID for style updates when user doesn't specify a layer)\n`;
  }

  return section;
}

/**
 * Build user context section for the system prompt
 */
export function buildUserContextSection(ctx: UserContext): string {
  let section = '\n## USER ANALYSIS CONTEXT\n\n';
  section += 'The user has configured an analysis session with the following parameters:\n\n';

  if (ctx.analysisTypeName) {
    section += `- **Analysis Type:** ${ctx.analysisTypeName}\n`;
  }

  if (ctx.country) {
    section += `- **Country:** ${ctx.country}\n`;
  }

  if (ctx.businessTypeName) {
    section += `- **POI Category:** ${ctx.businessTypeName}\n`;
  } else if (ctx.businessType) {
    section += `- **Business Type:** ${ctx.businessType}\n`;
  }

  if (ctx.selectedRadius && ctx.radiusUnit) {
    section += `- **Search Radius:** ${ctx.selectedRadius} ${ctx.radiusUnit}\n`;
  }

  if (ctx.demographics && ctx.demographics.length > 0) {
    section += `- **Target Demographics:** ${ctx.demographics.join(', ')}\n`;
  }

  if (ctx.proximityPriorities && ctx.proximityPriorities.length > 0) {
    section += `- **Proximity Priorities:**\n`;
    for (const p of ctx.proximityPriorities) {
      section += `  - ${p.name}: weight ${p.weight}/10\n`;
    }
  }

  if (ctx.targetArea) {
    if (ctx.targetArea.name) {
      section += `- **Target Area:** ${ctx.targetArea.name}\n`;
    }
    if (ctx.targetArea.bbox) {
      const [minLng, minLat, maxLng, maxLat] = ctx.targetArea.bbox;
      section += `- **Bounding Box:** [${minLng}, ${minLat}] to [${maxLng}, ${maxLat}]\n`;
    }
  }

  // Add location display
  if (ctx.selectedLocationName) {
    section += `- **Target Location:** ${ctx.selectedLocationName}\n`;
    if (ctx.customLocation) {
      section += `  (Custom: "${ctx.customLocation}")\n`;
    }
  }

  // Add FLY TO FIRST instruction if location is set
  const locationName = ctx.selectedLocationName || ctx.customLocation;
  if (locationName) {
    section += `
**CRITICAL BEHAVIOR - FLY TO LOCATION FIRST:**
The user has selected a target location: "${locationName}".
${ctx.locationCoordinates ? `Coordinates: [${ctx.locationCoordinates.longitude}, ${ctx.locationCoordinates.latitude}]` : ''}

Before executing ANY geo-related analysis (POI filtering, buffer analysis, spatial queries, etc.):
1. **ALWAYS fly to the target location FIRST** using set-deck-state with initialViewState (use provided coordinates or ask the user)
2. Wait for the fly animation to complete
3. Then proceed with the analysis tools
4. This ensures the user sees the location before results are displayed

The fly-to step is MANDATORY - do not skip it even if the user doesn't explicitly ask.
`;
  }

  // Add automatic layer creation instruction
  section += `
**CRITICAL BEHAVIOR - AUTO-CREATE LAYERS:**
Since the user has configured an analysis context, you MUST follow this rule:

When ANY MCP tool returns geo-related data (points, polygons, H3 cells, features with coordinates):
1. **ALWAYS create a new layer automatically** using set-deck-state
2. Do NOT wait for the user to ask "create a layer" or "show on map"
3. Choose an appropriate layer type based on the data (VectorTileLayer, H3TileLayer, etc.)
4. Use a descriptive layer ID based on the data content
5. Apply appropriate styling based on the POI category context

This applies to tools like: pois_filter, buffer analysis, spatial queries, geocoding results with multiple points, etc.
The user expects visual results on the map - always deliver them without being asked.
`;

  return section;
}
