/**
 * Agent Runner for OpenAI Agents SDK
 *
 * Uses Agent class and run() with streaming for agent execution.
 *
 * Key differences from Vercel AI SDK:
 * - Uses Agent class instead of ToolLoopAgent
 * - Uses run(agent, input, { stream: true }) for streaming
 * - Stream events: raw_model_stream_event, run_item_stream_event
 * - Text deltas come from raw_model_stream_event
 */

import { Agent, run, type RunStreamEvent } from '@openai/agents';
import { WebSocket } from 'ws';
import { getAllTools, getAllToolNames, parseFrontendToolResult } from '../agent/tools.js';
import { getConfiguredModel } from '../agent/providers.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';

/**
 * Create a Map Control Agent using OpenAI Agents SDK
 *
 * Uses all available tools (local + MCP)
 */
function createMapAgent(initialState?: InitialState) {
  const tools = getAllTools();
  const toolNames = getAllToolNames();
  const model = getConfiguredModel();

  return new Agent({
    name: 'MapControlAgent',
    instructions: buildSystemPrompt(toolNames, initialState),
    model,
    tools,
  });
}

/**
 * Build input string with conversation context
 * The OpenAI Agents SDK expects a simple string or AgentInputItem[]
 * For simplicity, we'll format conversation history as a string prefix
 */
function buildInputWithHistory(
  userMessage: string,
  conversationHistory: ConversationMessage[]
): string {
  if (conversationHistory.length === 0) {
    return userMessage;
  }

  // Format history as context
  const historyContext = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n');

  return `Previous conversation:\n${historyContext}\n\nUser: ${userMessage}`;
}

/**
 * Run the map agent and stream results via WebSocket
 */
export async function runMapAgent(
  userMessage: string,
  ws: WebSocket,
  sessionId: string,
  conversationHistory: ConversationMessage[],
  initialState?: InitialState
): Promise<ConversationMessage | null> {
  const messageId = `msg_${Date.now()}`;

  try {
    // Create the agent with all available tools (local + MCP)
    const agent = createMapAgent(initialState);

    // Build input with conversation history context
    const input = buildInputWithHistory(userMessage, conversationHistory);

    // Run with streaming
    const stream = await run(agent, input, {
      stream: true,
      maxTurns: 50, // Match vercel-ai-sdk behavior for MCP async jobs
    });

    let fullText = '';
    let stepCounter = 0;

    // Process stream events
    for await (const event of stream) {
      if (event.type === 'raw_model_stream_event') {
        // Handle text deltas from the model
        const data = event.data as { type?: string; delta?: string };
        if (data.type === 'output_text_delta' && data.delta) {
          const delta = data.delta;
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
      } else if (event.type === 'run_item_stream_event') {
        // Handle tool calls and other run item events
        const runEvent = event as { type: string; name: string; item: unknown };

        if (runEvent.name === 'tool_called') {
          // Tool call started
          const item = runEvent.item as { type?: string; rawItem?: { name?: string; callId?: string; arguments?: string } };
          if (item?.rawItem) {
            console.log(`[Agent] Tool call: ${item.rawItem.name}`);
            ws.send(
              JSON.stringify({
                type: 'tool_call_start',
                toolName: item.rawItem.name,
                input: item.rawItem.arguments,
                callId: item.rawItem.callId,
              })
            );
          }
        } else if (runEvent.name === 'tool_output') {
          // Tool call completed
          const item = runEvent.item as {
            type?: string;
            output?: unknown;
            rawItem?: { name?: string; callId?: string };
          };

          if (item) {
            const outputStr =
              typeof item.output === 'string' ? item.output : JSON.stringify(item.output);
            const toolName = item.rawItem?.name;
            const callId = item.rawItem?.callId;

            // Check if this is a frontend tool result (local map tools)
            const frontendResult = parseFrontendToolResult(outputStr);

            if (frontendResult) {
              ws.send(
                JSON.stringify({
                  type: 'tool_call',
                  toolName: frontendResult.toolName,
                  data: frontendResult.data,
                  callId: callId,
                  message: `Executing ${frontendResult.toolName}`,
                })
              );
            } else {
              // MCP tool result - log and notify client
              console.log(
                `[Agent] MCP tool result for ${toolName}:`,
                outputStr.substring(0, 200)
              );
              ws.send(
                JSON.stringify({
                  type: 'mcp_tool_result',
                  toolName: toolName,
                  result: item.output,
                  callId: callId,
                })
              );
            }
          }
        }
      } else if (event.type === 'agent_updated_stream_event') {
        stepCounter++;
        console.log(`[Agent] Step ${stepCounter} - agent updated for session ${sessionId}`);
      }
    }

    // Wait for completion
    await stream.completed;

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
    const finalOutput = stream.finalOutput;
    return {
      role: 'assistant',
      content: (finalOutput as string) || fullText || 'I performed the requested actions.',
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
