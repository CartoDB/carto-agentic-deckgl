// backend/src/routes/openai-chat.ts
import { Router, Request, Response } from 'express';
import { OpenAIResponsesService } from '../services/openai-responses-service.js';
import { ConversationManager } from '../services/conversation-manager.js';
import { randomUUID } from 'crypto';

// Lazy initialization
let openAIService: OpenAIResponsesService | null = null;
let conversationManager: ConversationManager | null = null;

function getServices() {
  if (!openAIService) {
    openAIService = new OpenAIResponsesService();
  }
  if (!conversationManager) {
    conversationManager = new ConversationManager();
  }
  return { openAIService, conversationManager };
}

export const openAIChatRouter = Router();

/**
 * POST /api/openai-chat
 *
 * OpenAI Chat endpoint using OpenAI Responses API
 * Supports previous_response_id for conversation context chaining
 *
 * Request body:
 * - message: string (required) - User's chat message
 * - sessionId: string (optional) - Session ID for conversation history
 *
 * Response: Streaming text response with tool calls
 */
openAIChatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: message is required and must be a string'
      });
    }

    // Generate sessionId if not provided
    const session = sessionId || randomUUID();

    console.log(`[API] /api/openai-chat request for session: ${session}`);

    // Get services
    const services = getServices();

    // Add user message to conversation history
    services.conversationManager.addMessage(session, {
      role: 'user',
      content: message
    });

    // Get conversation history
    const messagesRaw = services.conversationManager.getConversation(session);

    // Convert to simple message format
    const messages = messagesRaw.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    // Get previous response ID for Responses API chaining
    const previousResponseId = services.conversationManager.getLastResponseId(session);

    // Stream response from OpenAI Responses API
    const result = await services.openAIService.streamChatCompletion(
      messages,
      res,
      previousResponseId
    );

    // Add assistant response to conversation history and save response ID
    if (result) {
      services.conversationManager.addMessage(session, result.message);

      // Save response ID for next request (Responses API chaining)
      // Also track if there were tool calls (can't use previous_response_id if so)
      if (result.responseId) {
        services.conversationManager.setResponseId(session, result.responseId, result.hadToolCalls || false);
        console.log(`[API] Saved response ID for session ${session}:`, result.responseId);
        if (result.hadToolCalls) {
          console.log(`[API] Response had tool calls - previous_response_id will be skipped next time`);
        }
      }
    }

  } catch (error: any) {
    console.error('[API] Error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});
