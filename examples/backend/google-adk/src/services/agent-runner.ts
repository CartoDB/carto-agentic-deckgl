/**
 * Agent Runner for Google ADK
 *
 * Creates an LlmAgent and uses ADK's `Runner` with a shared
 * `InMemorySessionService` so each WebSocket session keeps a persistent
 * ADK session across turns. History is owned by ADK, not embedded as
 * text in the user message — and a `TokenBasedContextCompactor` on the
 * agent summarizes older events when the session grows large.
 *
 * Key differences from OpenAI Agents SDK version:
 * - ADK handles the tool execution loop internally (no manual tool loop)
 * - Events contain Content.parts[] with text/functionCall/functionResponse
 * - ADK streaming sends accumulated text (not deltas) — compute delta ourselves
 * - isFrontendToolResult() works on objects directly (no JSON.parse needed)
 */

import {
  LlmAgent,
  Runner,
  isFinalResponse,
  isCompactedEvent,
  stringifyContent,
  StreamingMode,
  TokenBasedContextCompactor,
  LlmSummarizer,
  type BaseSessionService,
} from '@google/adk';
import { createUserContent } from '@google/genai';
import { WebSocket } from 'ws';
import { getAllTools, getAllToolNames, isFrontendToolResult } from '../agent/tools.js';
import { getCustomToolNames } from '../agent/custom-tools.js';
import { getModel } from '../agent/providers.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import {
  sanitizeMalformedKeys,
  stripCredentials,
  escapeAdkTemplateVars,
  extractCoordinatesFromMcpResult,
} from './utils.js';
import { ADK_APP_NAME } from './conversation-manager.js';
import type { InitialState } from '../types/messages.js';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Compaction thresholds. Defaults are conservative for any modern context
// window (gpt-4o is 128k, so 8k is ~6% — plenty of headroom). Override per
// deployment via env if you want compaction to kick in later or retain more
// raw events past the summary boundary.
const COMPACTION_TOKEN_THRESHOLD = envInt('CARTO_ADK_COMPACTION_TOKEN_THRESHOLD', 8000);
const COMPACTION_EVENT_RETENTION = envInt('CARTO_ADK_COMPACTION_EVENT_RETENTION', 4);

// Lazy module-level caches for static agent deps. Tools and tool names come
// from caches populated at server startup, and the compactor depends only on
// the (already-singleton) model — none of these vary across turns or sessions.
// The agent + runner themselves stay per-turn because the instruction embeds
// `initialState` (viewState, layers, activeLayerId).
let cachedTools: ReturnType<typeof getAllTools> | null = null;
let cachedToolNames: ReturnType<typeof getAllToolNames> | null = null;
let cachedCompactor: TokenBasedContextCompactor | null = null;
let cachedCustomToolNameSet: Set<string> | null = null;

function getStaticAgentDeps() {
  cachedTools ??= getAllTools();
  cachedToolNames ??= getAllToolNames();
  cachedCustomToolNameSet ??= new Set(getCustomToolNames());
  cachedCompactor ??= new TokenBasedContextCompactor({
    tokenThreshold: COMPACTION_TOKEN_THRESHOLD,
    eventRetentionSize: COMPACTION_EVENT_RETENTION,
    summarizer: new LlmSummarizer({ llm: getModel() }),
  });
  return {
    tools: cachedTools,
    toolNames: cachedToolNames,
    customToolNames: cachedCustomToolNameSet,
    compactor: cachedCompactor,
  };
}

// Verbose logging of full tool-result payloads is opt-in to avoid serializing
// (potentially multi-MB) MCP outputs into the log buffer on every backend call.
const DEBUG_TOOL_RESULTS = process.env.CARTO_ADK_DEBUG_TOOL_RESULTS === 'true';

/**
 * Run the map agent and stream results via WebSocket.
 *
 * ADK's `Runner` persists user + model events to the session itself, so this
 * function does not need to return the assistant turn. `appendContextNote`,
 * when provided, is called *after* the runner loop completes — appending
 * mid-iteration would mutate the same session the runner is reading.
 */
export async function runMapAgent(
  userMessage: string,
  ws: WebSocket,
  sessionId: string,
  sessionService: BaseSessionService,
  adkSessionId: string,
  initialState?: InitialState,
  appendContextNote?: (content: string) => Promise<void>,
): Promise<void> {
  const messageId = `msg_${Date.now()}`;

  try {
    const { tools, toolNames, customToolNames, compactor } = getStaticAgentDeps();
    const userContext = initialState?.userContext;

    // The agent is rebuilt per-turn because its instruction embeds
    // `initialState`. Tools and the compactor are shared singletons.
    const agent = new LlmAgent({
      name: 'MapControlAgent',
      model: getModel(),
      description: 'AI agent for map control and spatial analysis',
      instruction: escapeAdkTemplateVars(buildSystemPrompt(toolNames, initialState, userContext)),
      tools,
      contextCompactors: [compactor],
    });

    const runner = new Runner({ agent, appName: ADK_APP_NAME, sessionService });

    // Track state for WebSocket messaging
    let fullText = '';
    let lastSentLength = 0; // For computing text deltas from accumulated text
    let stepCounter = 0;

    // MCP layer tracking
    let pendingMcpTableName: string | null = null;
    let mcpResultCoordinates: { latitude: number; longitude: number } | null = null;
    let layerAddedWithMcpTable = false;
    // Notes captured during the run; flushed to the session after the
    // runner loop ends so we don't mutate the session mid-iteration.
    const pendingContextNotes: string[] = [];

    // Run agent with streaming against the persistent ADK session
    for await (const event of runner.runAsync({
      userId: sessionId,
      sessionId: adkSessionId,
      newMessage: createUserContent(userMessage),
      runConfig: { streamingMode: StreamingMode.SSE },
    })) {
      // CompactedEvents are internal ADK summaries produced by the context
      // compactor — already persisted in the session; never forward to the user.
      if (isCompactedEvent(event)) continue;
      if (!event.content?.parts) continue;

      for (const part of event.content.parts) {
        // --- Streaming text ---
        if (part.text && (event as any).partial) {
          // ADK sends accumulated text, compute delta
          const delta = part.text.substring(lastSentLength);
          lastSentLength = part.text.length;
          if (delta) {
            fullText += delta;
            ws.send(JSON.stringify({
              type: 'stream_chunk',
              content: delta,
              messageId,
              isComplete: false,
            }));
          }
        }

        // --- Tool calls ---
        if (part.functionCall) {
          const toolName = part.functionCall.name!;
          const callId = (part.functionCall as any).id || `call_${Date.now()}`;
          const inputArgs = part.functionCall.args || {};
          const sanitizedInput = sanitizeMalformedKeys(inputArgs);

          console.log(`[Agent] Tool call: ${toolName}`);

          // Track workflowOutputTableName from async_workflow_job_get_results calls
          if (toolName.includes('async_workflow_job_get_results')) {
            const input = inputArgs as Record<string, unknown>;
            if (input.workflowOutputTableName && typeof input.workflowOutputTableName === 'string') {
              pendingMcpTableName = input.workflowOutputTableName;
              console.log(`[Agent] Tracking MCP workflowOutputTableName: ${pendingMcpTableName}`);
            }
          }

          ws.send(JSON.stringify({
            type: 'tool_call_start',
            toolName,
            input: sanitizedInput,
            callId,
          }));
        }

        // --- Tool responses ---
        if (part.functionResponse) {
          stepCounter++;
          const toolName = part.functionResponse.name!;
          const callId = (part.functionResponse as any).id || `call_${Date.now()}`;
          const output = part.functionResponse.response;

          console.log(`[Agent] Step ${stepCounter} - Tool output for: ${toolName}`);

          // Check if frontend tool — isFrontendToolResult works on objects directly
          if (isFrontendToolResult(output)) {
            const frontendResult = output as { toolName: string; data: unknown };

            console.log(`[Agent] Frontend tool call detected: ${frontendResult.toolName}`);

            // Track if set-deck-state was called with a layer pointing at the
            // MCP result table. Short-circuit once confirmed and check the
            // canonical `layer.data.tableName` slot directly instead of
            // stringifying the whole layer spec.
            if (
              !layerAddedWithMcpTable &&
              frontendResult.toolName === 'set-deck-state' &&
              pendingMcpTableName
            ) {
              const data = frontendResult.data as { layers?: Array<{ data?: { tableName?: string } }> };
              if (Array.isArray(data.layers) && data.layers.some(
                (layer) => layer?.data?.tableName === pendingMcpTableName,
              )) {
                layerAddedWithMcpTable = true;
                console.log(`[Agent] Layer with MCP tableName confirmed in set-deck-state`);
              }
            }

            // Sanitize and strip credentials before sending to frontend
            const sanitizedData = stripCredentials(sanitizeMalformedKeys(frontendResult.data));
            ws.send(JSON.stringify({
              type: 'tool_call',
              toolName: frontendResult.toolName,
              data: sanitizedData,
              callId,
              message: `Executing ${frontendResult.toolName}`,
            }));
          } else {
            // Backend tool result - check if it's a custom tool or MCP tool
            const isCustomTool = customToolNames.has(toolName);
            const toolType = isCustomTool ? 'Custom' : 'MCP';

            console.log(`[Agent] ${toolType} tool result for ${toolName}:`);
            if (DEBUG_TOOL_RESULTS) {
              console.log(`[Agent] Result preview: ${JSON.stringify(output).substring(0, 5000)}`);
            }

            // Extract coordinates from MCP workflow results for fallback layer
            if (toolName.includes('async_workflow_job_get_results') && pendingMcpTableName) {
              const coords = extractCoordinatesFromMcpResult(output);
              if (coords) {
                mcpResultCoordinates = coords;
                console.log(`[Agent] Extracted coordinates from MCP result: lat=${coords.latitude}, lng=${coords.longitude}`);
              }

              // Buffer table name note; flushed after the runner loop ends
              // so we don't mutate the session ADK is iterating.
              pendingContextNotes.push(
                `[MCP Result Table Available] The MCP workflow result is stored in table "${pendingMcpTableName}". When the user asks to filter or mask by this area, call set-mask-layer { action: "set", tableName: "${pendingMcpTableName}" }.`,
              );
            }

            // Check for errors in result
            const resultObj = output as any;
            if (resultObj && typeof resultObj === 'object' && 'error' in resultObj && resultObj.error === true) {
              console.error(`[Agent] ${toolType} tool ${toolName} returned an error:`, resultObj.message);

              ws.send(JSON.stringify({
                type: isCustomTool ? 'custom_tool_result' : 'mcp_tool_result',
                toolName,
                result: stripCredentials(output),
                callId,
                success: false,
                error: resultObj.message || 'Tool execution failed',
              }));
            } else {
              ws.send(JSON.stringify({
                type: isCustomTool ? 'custom_tool_result' : 'mcp_tool_result',
                toolName,
                result: stripCredentials(output),
                callId,
              }));
            }
          }
        }
      }

      // --- Final response ---
      if (isFinalResponse(event)) {
        const finalText = stringifyContent(event).trim();
        if (finalText && finalText !== fullText) {
          // Send any remaining text not yet streamed
          const remaining = finalText.substring(fullText.length);
          if (remaining) {
            ws.send(JSON.stringify({
              type: 'stream_chunk',
              content: remaining,
              messageId,
              isComplete: false,
            }));
            fullText = finalText;
          }
        }
      }
    }

    // Log agent loop termination for debugging
    console.log('[Agent] Stream processing complete');
    console.log('[Agent] Final text length:', fullText.length);
    console.log('[Agent] Total steps:', stepCounter);

    // --- Fallback: auto-inject set-deck-state with layer if LLM failed to add it ---
    if (pendingMcpTableName && !layerAddedWithMcpTable) {
      console.log(`[Agent] WARNING: LLM did not add a layer for MCP table: ${pendingMcpTableName}`);
      console.log(`[Agent] Injecting fallback set-deck-state with VectorTileLayer`);

      const fallbackLayerSpec: Record<string, unknown> = {
        layers: [{
          '@@type': 'VectorTileLayer',
          id: `mcp-result-${Date.now()}`,
          data: {
            '@@function': 'vectorTableSource',
            tableName: pendingMcpTableName,
          },
          opacity: 0.6,
          getFillColor: [66, 135, 245, 120],
          stroked: true,
          getLineColor: [255, 255, 255, 200],
          lineWidthMinPixels: 1,
          pickable: true,
        }],
      };

      // Add view state if we have coordinates from the MCP result
      if (mcpResultCoordinates) {
        fallbackLayerSpec.initialViewState = {
          latitude: mcpResultCoordinates.latitude,
          longitude: mcpResultCoordinates.longitude,
          zoom: 14,
        };
      }

      ws.send(JSON.stringify({
        type: 'tool_call',
        toolName: 'set-deck-state',
        data: stripCredentials(fallbackLayerSpec),
        callId: `auto_layer_${Date.now()}`,
        message: 'Auto-adding MCP result layer',
      }));
      console.log(`[Agent] Fallback layer injected for table: ${pendingMcpTableName}`);
    }

    // Send completion
    ws.send(JSON.stringify({
      type: 'stream_chunk',
      content: '',
      messageId,
      isComplete: true,
    }));

    // Flush buffered notes now that the runner is no longer iterating
    // the session.
    if (appendContextNote && pendingContextNotes.length > 0) {
      for (const note of pendingContextNotes) {
        try {
          await appendContextNote(note);
        } catch (noteErr) {
          console.error('[Agent] Failed to append context note:', noteErr);
        }
      }
    }
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('[Agent] Error:', err);
    ws.send(JSON.stringify({
      type: 'error',
      content: err.message || 'An error occurred',
      code: err.code,
    }));
  }
}
