/**
 * Agent Runner for HTTP/SSE connections
 *
 * Executes the map agent and streams results via Server-Sent Events
 */

import { Response } from 'express';
import { run } from '@openai/agents';
import { createMapAgent } from '../agent/map-agent.js';
import { parseFrontendToolResult } from '../agent/tools.js';
import type { InitialState } from '../types/messages.js';

/**
 * Run agent and stream results via HTTP SSE
 */
export async function runMapAgentHTTP(
  userMessage: string,
  res: Response,
  initialState?: InitialState
): Promise<void> {
  const messageId = `msg_${Date.now()}`;
  const agent = createMapAgent(initialState);

  const result = await run(agent, userMessage, { stream: true });

  // Process streaming events - iterate over result directly
  for await (const event of result) {
    // Handle raw model stream events (text deltas)
    if (event.type === 'raw_model_stream_event') {
      const data = event.data as {
        type?: string;
        delta?: string;
      };
      if (data.type === 'output_text_delta' && data.delta) {
        res.write(
          `data: ${JSON.stringify({
            type: 'stream_chunk',
            content: data.delta,
            messageId,
            isComplete: false,
          })}\n\n`
        );
      }
    }

    // Handle run item stream events (tool calls)
    if (event.type === 'run_item_stream_event') {
      const item = event.item as {
        type?: string;
        output?: string;
        callId?: string;
      };

      if (item.type === 'tool_call_output_item' && item.output) {
        const toolResult = parseFrontendToolResult(item.output);

        if (toolResult) {
          res.write(
            `data: ${JSON.stringify({
              type: 'tool_call',
              toolName: toolResult.toolName,
              data: toolResult.data,
              callId: item.callId || `tool_${Date.now()}`,
            })}\n\n`
          );
        }
      }
    }
  }

  // Ensure stream is completed
  await result.completed;

  // Send completion
  res.write(
    `data: ${JSON.stringify({
      type: 'stream_chunk',
      content: '',
      messageId,
      isComplete: true,
    })}\n\n`
  );
}
