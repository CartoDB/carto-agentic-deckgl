// backend/src/routes/litellm-chat.ts
import { Router, Request, Response } from 'express';
import { LiteLLMService } from '../services/litellm-service.js';
import { ConversationManager } from '../services/conversation-manager.js';
import { randomUUID } from 'crypto';

// Lazy initialization
let liteLLMService: LiteLLMService | null = null;
let conversationManager: ConversationManager | null = null;

function getServices() {
  if (!liteLLMService) {
    liteLLMService = new LiteLLMService();
  }
  if (!conversationManager) {
    conversationManager = new ConversationManager();
  }
  return { liteLLMService, conversationManager };
}

export const liteLLMChatRouter = Router();

/**
 * POST /api/litellm-chat
 *
 * LiteLLM Chat endpoint using LiteLLM responses API directly
 * Supports previous_response_id for Gemini Responses API chaining
 *
 * Request body:
 * - message: string (required) - User's chat message
 * - sessionId: string (optional) - Session ID for conversation history
 *
 * Response: Streaming text response
 */
liteLLMChatRouter.post('/', async (req: Request, res: Response) => {
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

    console.log(`[API] /api/litellm-chat request for session: ${session}`);

    // Get services
    const services = getServices();

    // Add user message to conversation history
    services.conversationManager.addMessage(session, {
      role: 'user',
      content: message
    });

    // Get conversation history
    const messagesRaw = services.conversationManager.getConversation(session);

    // Convert to simple message format for LiteLLM
    const messages = messagesRaw.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    }));

    // Get previous response ID for Gemini Responses API chaining
    const previousResponseId = services.conversationManager.getLastResponseId(session);

    // Stream response from LiteLLM
    const result = await services.liteLLMService.streamChatCompletion(
      messages,
      res,
      previousResponseId
    );

    // Add assistant response to conversation history and save response ID
    if (result) {
      services.conversationManager.addMessage(session, result.message);

      // Save response ID for next request (Gemini Responses API chaining)
      if (result.responseId) {
        services.conversationManager.setResponseId(session, result.responseId);
        console.log(`[API] Saved response ID for session ${session}:`, result.responseId);
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
