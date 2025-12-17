// backend/src/routes/vercel-chat.ts
import { Router, Request, Response } from 'express';
import { VercelAIService } from '../services/vercel-ai-service.js';
import { ConversationManager } from '../services/conversation-manager.js';
import { randomUUID } from 'crypto';

// Lazy initialization
let vercelAIService: VercelAIService | null = null;
let conversationManager: ConversationManager | null = null;

function getServices() {
  if (!vercelAIService) {
    vercelAIService = new VercelAIService();
  }
  if (!conversationManager) {
    conversationManager = new ConversationManager();
  }
  return { vercelAIService, conversationManager };
}

export const vercelChatRouter = Router();

/**
 * POST /api/vercel-chat
 *
 * Vercel Chat endpoint using Vercel AI SDK with CARTO LiteLLM
 *
 * Request body:
 * - message: string (required) - User's chat message
 * - sessionId: string (optional) - Session ID for conversation history
 *
 * Response: Streaming text response
 */
vercelChatRouter.post('/', async (req: Request, res: Response) => {
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

    console.log(`[API] /api/vercel-chat request for session: ${session}`);

    // Get services
    const services = getServices();

    // Add user message to conversation history
    services.conversationManager.addMessage(session, {
      role: 'user',
      content: message
    });

    // Get conversation history
    const messages = services.conversationManager.getConversation(session);

    // Get previous response ID for Gemini Responses API chaining
    const previousResponseId = services.conversationManager.getLastResponseId(session);

    // Stream response from Vercel AI SDK
    const result = await services.vercelAIService.streamChatCompletion(
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
