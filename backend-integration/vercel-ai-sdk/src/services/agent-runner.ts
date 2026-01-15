/**
 * Agent Runner for Vercel AI SDK v6
 *
 * Uses ToolLoopAgent for streaming agent execution
 */

import { ToolLoopAgent, stepCountIs, type ModelMessage } from 'ai';
import { WebSocket } from 'ws';
import { getAllTools, getAllToolNames, isFrontendToolResult } from '../agent/tools.js';
import { getProvider } from '../agent/providers.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';
import type { FrontendToolResult } from '@carto/maps-ai-tools';

/**
 * Create a Map Control Agent using ToolLoopAgent
 *
 * Uses all available tools (local + MCP)
 */
let stepCounter = 0;

function createMapAgent(initialState?: InitialState, provider?: string) {
  const model = getProvider(provider);
  const tools = getAllTools();
  const toolNames = getAllToolNames();
  stepCounter = 0;

  return new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt(toolNames, initialState),
    tools,
    stopWhen: stepCountIs(50), // Stop after 50 steps max (MCP async jobs need polling)
    onStepFinish: (stepResult) => {
      stepCounter++;
      console.log(`[Agent] Step ${stepCounter} finished with ${stepResult.toolCalls.length} tool calls`);
    },
  });
}

/**
 * Run the map agent and stream results via WebSocket
 */
export async function runMapAgent(
  userMessage: string,
  ws: WebSocket,
  sessionId: string,
  conversationHistory: ConversationMessage[],
  initialState?: InitialState,
  provider?: string
): Promise<ConversationMessage | null> {
  const messageId = `msg_${Date.now()}`;

  try {
    // Create the agent with all available tools (local + MCP)
    const agent = createMapAgent(initialState, provider);

    // Build messages array from history, adding the new user message
    const messages: ModelMessage[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    // Stream the agent response - must await the stream() call first
    const streamResult = await agent.stream({
      messages,
    });

    let fullText = '';

    // Process the stream
    for await (const part of streamResult.fullStream) {
      // Debug: log all stream events
      if (part.type !== 'text-delta') {
        console.log(`[Agent] Stream event: ${part.type}`, JSON.stringify(part).substring(0, 300));
      }

      switch (part.type) {
        case 'text-delta': {
          // AI SDK v6: part.text is the actual delta (not accumulated)
          const delta = part.text;
          if (delta) {
            fullText += delta;
            ws.send(
              JSON.stringify({
                type: 'stream_chunk',
                content: delta,
                messageId,
                isComplete: false,
              })
            );
          }
          break;
        }

        case 'tool-call':
          // Notify client that a tool is being called
          console.log(`[Agent] Tool call: ${part.toolName}`);
          ws.send(
            JSON.stringify({
              type: 'tool_call_start',
              toolName: part.toolName,
              input: part.input,
              callId: part.toolCallId,
            })
          );
          break;

        case 'tool-result':
          // Check if this is a frontend tool result (local map tools)
          if (isFrontendToolResult(part.output)) {
            const frontendResult = part.output as FrontendToolResult;
            ws.send(
              JSON.stringify({
                type: 'tool_call',
                toolName: frontendResult.toolName,
                data: frontendResult.data,
                callId: part.toolCallId,
                message: `Executing ${frontendResult.toolName}`,
              })
            );
          } else {
            // MCP tool result - log and notify client
            console.log(`[Agent] MCP tool result for ${part.toolName}:`, JSON.stringify(part.output).substring(0, 200));
            ws.send(
              JSON.stringify({
                type: 'mcp_tool_result',
                toolName: part.toolName,
                result: part.output,
                callId: part.toolCallId,
              })
            );
          }
          break;

        case 'finish-step':
          console.log(`[Agent] Step completed for session ${sessionId}`);
          break;

        case 'error':
          console.error('[Agent] Stream error:', part.error);
          ws.send(
            JSON.stringify({
              type: 'error',
              content: String(part.error),
            })
          );
          break;
      }
    }

    // Send completion
    ws.send(
      JSON.stringify({
        type: 'stream_chunk',
        content: '',
        messageId,
        isComplete: true,
      })
    );

    // Get final text for history
    const text = await streamResult.text;
    return {
      role: 'assistant',
      content: text || fullText || 'I performed the requested actions.',
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('[Agent] Error:', err);
    ws.send(
      JSON.stringify({
        type: 'error',
        content: err.message || 'An error occurred',
        code: err.code,
      })
    );
    return null;
  }
}
