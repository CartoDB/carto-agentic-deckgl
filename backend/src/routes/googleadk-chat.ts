// backend/src/routes/googleadk-chat.ts
import { Router, Request, Response } from 'express';
import { GoogleADKService } from '../services/google-adk-service.js';
import { randomUUID } from 'crypto';

// Lazy initialization
let adkService: GoogleADKService | null = null;

function getService() {
  if (!adkService) {
    adkService = new GoogleADKService();
  }
  return adkService;
}

export const googleADKChatRouter = Router();

/**
 * POST /api/googleadk-chat
 *
 * Google ADK Chat endpoint using Google Agent Development Kit
 * Supports session-based conversation context via InMemorySessionService
 * Supports CARTO library tools for map interaction
 *
 * Request body:
 * - message: string (required) - User's chat message
 * - sessionId: string (optional) - Session ID for conversation history. If not provided, a random UUID will be generated
 * - initialState: object (optional) - Map context (layers, view state, demo info) for dynamic system prompt
 *
 * Response: Streaming NDJSON response with text chunks and tool calls
 * Final chunk includes the sessionId for subsequent requests
 */
googleADKChatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, sessionId, initialState } = req.body;

    // Validate request
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: message is required and must be a string',
      });
    }

    console.log(`[API] /api/googleadk-chat request`);
    console.log(`[API] Session ID provided:`, sessionId || '(none - will generate)');
    console.log(`[API] Initial state provided:`, initialState ? 'yes' : 'no');

    // Get service
    const service = getService();

    // Stream response from Google ADK with CARTO tools
    // Service will generate sessionId if not provided
    // ADK SessionService handles conversation state automatically
    const result = await service.streamChatCompletion(
      message,
      res,
      sessionId,
      initialState
    );
    
    res.end();    

  } catch (error: any) {
    console.error('[API] Error:', error);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  }
});
