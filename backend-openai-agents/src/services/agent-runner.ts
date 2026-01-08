/**
 * Agent Runner for WebSocket connections
 *
 * Executes the map agent and streams results via WebSocket
 */

import { run } from '@openai/agents';
import { WebSocket } from 'ws';
import { createMapAgent } from '../agent/map-agent.js';
import { parseFrontendToolResult } from '../agent/tools.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';

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
  const agent = createMapAgent(initialState);

  try {
    // Build input with conversation context
    const input =
      conversationHistory.length > 0
        ? [...conversationHistory, { role: 'user' as const, content: userMessage }]
        : userMessage;

    const result = await run(agent, input, { stream: true });

    let fullText = '';

    // Process streaming events - iterate over result directly
    for await (const event of result) {
      // Handle raw model stream events (text deltas)
      if (event.type === 'raw_model_stream_event') {
        const data = event.data as {
          type?: string;
          delta?: string;
        };
        if (data.type === 'output_text_delta' && data.delta) {
          fullText += data.delta;
          ws.send(
            JSON.stringify({
              type: 'stream_chunk',
              content: data.delta,
              messageId,
              isComplete: false,
            })
          );
        }
      }

      // Handle run item stream events (tool calls, handoffs, etc.)
      if (event.type === 'run_item_stream_event') {
        const item = event.item as {
          type?: string;
          output?: string;
          callId?: string;
        };

        // Check if this is a tool output item
        if (item.type === 'tool_call_output_item' && item.output) {
          const toolResult = parseFrontendToolResult(item.output);

          if (toolResult) {
            // Send to frontend for execution
            ws.send(
              JSON.stringify({
                type: 'tool_call',
                toolName: toolResult.toolName,
                data: toolResult.data,
                callId: item.callId || `tool_${Date.now()}`,
                message: `Executing ${toolResult.toolName}`,
              })
            );
          }
        }
      }
    }

    // Ensure stream is completed
    await result.completed;

    // Send completion signal
    ws.send(
      JSON.stringify({
        type: 'stream_chunk',
        content: '',
        messageId,
        isComplete: true,
      })
    );

    // Return final output for conversation history
    return {
      role: 'assistant',
      content: fullText || result.finalOutput || 'I performed the requested actions.',
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
