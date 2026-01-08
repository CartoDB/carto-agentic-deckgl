/**
 * Agent Runner for Google ADK
 *
 * Executes the map agent using InMemoryRunner and streams results
 */

import { WebSocket } from 'ws';
import { getOrCreateRunner } from './runner-manager.js';
import { isFrontendToolResult } from '../agent/tools.js';
import type { InitialState, ConversationMessage } from '../types/messages.js';

// Type for ADK Content
interface Content {
  role: string;
  parts: Array<{ text?: string }>;
}

// Type for ADK Event parts
interface EventPart {
  text?: string;
  functionResponse?: {
    response?: Record<string, unknown>;
  };
}

// Type for ADK Event
interface ADKEvent {
  content?: {
    parts?: EventPart[];
  };
  get_function_calls?: () => Array<{ name: string; args: unknown }>;
}

/**
 * Run the map agent and stream results via WebSocket
 */
export async function runMapAgent(
  userMessage: string,
  ws: WebSocket,
  sessionId: string,
  _conversationHistory: ConversationMessage[], // ADK manages conversation internally
  initialState?: InitialState
): Promise<ConversationMessage | null> {
  const messageId = `msg_${Date.now()}`;

  try {
    const { runner, adkSessionId } = await getOrCreateRunner(sessionId, initialState);

    // Create user message content
    const newMessage: Content = {
      role: 'user',
      parts: [{ text: userMessage }],
    };

    // Run agent and stream events
    const eventStream = runner.runAsync({
      userId: sessionId,
      sessionId: adkSessionId,
      newMessage,
    });

    let finalText = '';

    for await (const event of eventStream as AsyncIterable<ADKEvent>) {
      // Check for text content in event parts
      if (event.content?.parts) {
        for (const part of event.content.parts) {
          // Handle text parts (streaming response)
          if (part.text) {
            ws.send(
              JSON.stringify({
                type: 'stream_chunk',
                content: part.text,
                messageId,
                isComplete: false,
              })
            );
            finalText += part.text;
          }

          // Handle function call results (tool outputs)
          if (part.functionResponse) {
            const result = part.functionResponse.response;
            if (result && isFrontendToolResult(result)) {
              ws.send(
                JSON.stringify({
                  type: 'tool_call',
                  toolName: result.toolName,
                  data: result.data,
                  callId: `tool_${Date.now()}`,
                  message: `Executing ${result.toolName}`,
                })
              );
            }
          }
        }
      }

      // Log function calls for debugging
      const functionCalls = event.get_function_calls?.() || [];
      for (const call of functionCalls) {
        console.log(`[ADK] Tool call: ${call.name}`, call.args);
      }
    }

    // Send completion signal
    ws.send(
      JSON.stringify({
        type: 'stream_chunk',
        content: '',
        messageId,
        isComplete: true,
      })
    );

    return {
      role: 'assistant',
      content: finalText || 'I performed the requested actions.',
    };
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('[ADK Agent] Error:', err);
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
