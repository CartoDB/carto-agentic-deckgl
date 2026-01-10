/**
 * Agent Runner for Vercel AI SDK v6
 *
 * Uses ToolLoopAgent for streaming agent execution
 */

import { ToolLoopAgent, stepCountIs, type ModelMessage } from 'ai';
import { WebSocket } from 'ws';
import { createMapTools, isFrontendToolResult } from '../agent/tools.js';
import { getProvider } from '../agent/providers.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';
import type { FrontendToolResult } from '@carto/maps-ai-tools';

/**
 * Create a Map Control Agent using ToolLoopAgent
 */
function createMapAgent(
  toolNames: string[],
  initialState?: InitialState,
  provider?: string
) {
  const model = getProvider(provider);
  const tools = createMapTools();

  return new ToolLoopAgent({
    model,
    instructions: buildSystemPrompt(toolNames, initialState),
    tools,
    stopWhen: stepCountIs(10), // Stop after 10 steps max
    onStepFinish: (stepResult) => {
      console.log(`[Agent] Step finished with ${stepResult.toolCalls.length} tool calls`);
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
  const tools = createMapTools();
  const toolNames = Object.keys(tools);

  try {
    // Create the agent
    const agent = createMapAgent(toolNames, initialState, provider);

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

        case 'tool-result':
          // Check if this is a frontend tool result
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
