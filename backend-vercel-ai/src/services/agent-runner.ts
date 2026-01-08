/**
 * Agent Runner for Vercel AI SDK
 *
 * Uses streamText for streaming agent execution
 */

import { streamText, type TextStreamPart } from 'ai';
import { WebSocket } from 'ws';
import { createMapTools, isFrontendToolResult } from '../agent/tools.js';
import { getProvider } from '../agent/providers.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';
import type { FrontendToolResult } from '@carto/maps-ai-tools';

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
  const model = getProvider(provider);
  const tools = createMapTools();
  const toolNames = Object.keys(tools);

  try {
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: userMessage },
    ];

    const result = streamText({
      model,
      system: buildSystemPrompt(toolNames, initialState),
      messages,
      tools,
      maxSteps: 10, // Allow multiple tool calls
      // Handle tool results via onStepFinish
      onStepFinish: (event) => {
        const toolResults = event.toolResults as Array<{
          toolCallId: string;
          result: unknown;
        }> | undefined;

        if (toolResults && toolResults.length > 0) {
          for (const toolResult of toolResults) {
            const result = toolResult.result;
            if (isFrontendToolResult(result)) {
              const frontendResult = result as FrontendToolResult;
              ws.send(
                JSON.stringify({
                  type: 'tool_call',
                  toolName: frontendResult.toolName,
                  data: frontendResult.data,
                  callId: toolResult.toolCallId,
                  message: `Executing ${frontendResult.toolName}`,
                })
              );
            }
          }
        }
      },
    });

    let fullText = '';

    // Process the stream for text deltas
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullText += part.textDelta;
        ws.send(
          JSON.stringify({
            type: 'stream_chunk',
            content: part.textDelta,
            messageId,
            isComplete: false,
          })
        );
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
    const text = await result.text;
    return {
      role: 'assistant',
      content: text || fullText || 'I performed the requested actions.',
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('[Vercel AI] Error:', err);
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
