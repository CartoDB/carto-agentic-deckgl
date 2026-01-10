import type { InitialState } from '../types/messages.js';

/**
 * Build the system prompt for the map control agent
 */
export function buildSystemPrompt(
  toolNames: string[],
  initialState?: InitialState
): string {
  let prompt = `You are a helpful map assistant that controls an interactive map visualization.

You have access to tools that can:
- Navigate the map (fly to locations, zoom in/out, rotate, tilt)
- Control layer visibility (show/hide layers)
- Style layers (change colors, sizes, opacity)
- Filter and query data on the map
- Add and remove data layers

IMPORTANT GUIDELINES:
1. When the user asks to go to a location, use the fly-to tool with appropriate coordinates
2. When asked about layers, first check what layers are available in the initial state
3. Be concise in your responses - the map actions speak for themselves
4. If a request is unclear, ask for clarification
5. You can chain multiple tool calls if needed (e.g., fly somewhere AND change layer style)

KNOWN CITIES (use these coordinates):
- New York: lat=40.7128, lng=-74.0060
- Los Angeles: lat=34.0522, lng=-118.2437
- Chicago: lat=41.8781, lng=-87.6298
- San Francisco: lat=37.7749, lng=-122.4194
- Seattle: lat=47.6062, lng=-122.3321
- Miami: lat=25.7617, lng=-80.1918
- Boston: lat=42.3601, lng=-71.0589
- Denver: lat=39.7392, lng=-104.9903
- London: lat=51.5074, lng=-0.1278
- Paris: lat=48.8566, lng=2.3522
- Tokyo: lat=35.6762, lng=139.6503
- Sydney: lat=-33.8688, lng=151.2093
`;

  if (initialState) {
    prompt += `\nCURRENT MAP STATE:\n`;

    // Handle both viewState and initialViewState formats
    const vs = initialState.viewState || initialState.initialViewState;
    if (vs) {
      prompt += `- Current position: lat=${vs.latitude.toFixed(4)}, lng=${vs.longitude.toFixed(4)}, zoom=${vs.zoom.toFixed(1)}\n`;
      if (vs.pitch) prompt += `- Pitch: ${vs.pitch}°\n`;
      if (vs.bearing) prompt += `- Bearing: ${vs.bearing}°\n`;
    }

    // Handle layers array
    if (initialState.layers && initialState.layers.length > 0) {
      prompt += `- Available layers:\n`;
      for (const layer of initialState.layers) {
        const layerType = layer.type || 'unknown';
        const visibility = layer.visible !== false ? 'visible' : 'hidden';
        prompt += `  - "${layer.id}" (${layerType}, ${visibility})\n`;
      }
    }
  }

  if (toolNames.length > 0) {
    prompt += `\nAVAILABLE TOOLS: ${toolNames.join(', ')}\n`;
  }

  return prompt;
}
