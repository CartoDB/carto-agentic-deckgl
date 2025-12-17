# PRP: Vercel AI SDK Integration with CARTO LiteLLM

**Feature**: Add REST endpoint using Vercel AI SDK to connect to CARTO's LiteLLM server
**Date**: 2025-12-12
**Complexity**: Medium
**Estimated Confidence**: 8/10

---

## 1. Context & Background

### 1.1 Goal
Create a new REST endpoint `/api/ai-chat` that uses **Vercel AI SDK** instead of the OpenAI SDK to communicate with CARTO's LiteLLM proxy. This provides an alternative communication method alongside the existing WebSocket implementation.

**KISS Principle**: Keep implementation simple - this is a prototype. Reuse existing patterns and services.

### 1.2 Why This Approach
- **Vercel AI SDK**: Modern AI framework with better streaming support and tool calling
- **LiteLLM Proxy**: CARTO's proxy supports multiple AI providers (Gemini, GPT, etc.)
- **REST API**: Stateless alternative to WebSocket for different use cases
- **No Frontend Changes**: Backend-only modification, existing WebSocket stays untouched

### 1.3 Reference Materials

**Documentation**:
- Vercel AI SDK streamText: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- OpenAI Compatible Providers: https://ai-sdk.dev/providers/openai-compatible-providers
- LiteLLM Response Headers: https://docs.litellm.ai/docs/proxy/response_headers
- LiteLLM Cost Tracking: https://docs.litellm.ai/docs/proxy/cost_tracking
- LiteLLM Streaming: https://docs.litellm.ai/stream

**Codebase References**:
- `/home/jacrisol/github/ps-frontend-tools-poc/test_vercel.js` - Working example of Vercel AI SDK with CARTO LiteLLM
- `/home/jacrisol/github/ps-frontend-tools-poc/backend/src/services/openai-service.ts` - Existing OpenAI integration pattern
- `/home/jacrisol/github/ps-frontend-tools-poc/backend/src/services/conversation-manager.ts` - Session history management
- `/home/jacrisol/github/ps-frontend-tools-poc/backend/src/services/message-handler.ts` - Message orchestration pattern
- `/home/jacrisol/github/ps-frontend-tools-poc/backend/src/server.ts` - Express server setup
- `/home/jacrisol/github/ps-frontend-tools-poc/backend/src/index.ts` - Environment variable validation

---

## 2. Implementation Blueprint

### 2.1 High-Level Approach

```
1. Install Vercel AI SDK dependencies (@ai-sdk/openai, ai)
2. Create VercelAIService class (mirrors OpenAIService structure)
3. Add POST /api/ai-chat endpoint in server.ts
4. Add GEMINI_API_KEY validation in index.ts
5. Update package.json and .env
6. Test with curl
```

### 2.2 Architecture Pattern

```
REST Request → Express Endpoint → VercelAIService
                                        ↓
                            ConversationManager (get history)
                                        ↓
                            Vercel AI SDK streamText()
                                        ↓
                            LiteLLM Proxy → Gemini
                                        ↓
                            Stream back to client
                                        ↓
                            Extract cost from headers
                                        ↓
                            Save to ConversationManager
```

### 2.3 Session Management (KISS)

LiteLLM is **stateless** - doesn't maintain conversation history. Backend handles this:

1. Client sends `sessionId` in request body
2. Backend retrieves conversation history from `ConversationManager`
3. Backend sends **full history** to LiteLLM (system prompt + all messages)
4. Backend saves assistant response back to `ConversationManager`

---

## 3. File-by-File Implementation

### 3.1 NEW FILE: `backend/src/services/vercel-ai-service.ts`

**Purpose**: Service class that wraps Vercel AI SDK, similar to OpenAIService

**Implementation Pattern** (based on test_vercel.js and OpenAIService):

```typescript
// backend/src/services/vercel-ai-service.ts
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { Response } from 'express';
import {
  getAllToolDefinitions,
  TOOL_NAMES,
  formatToolResponse,
  validateWithZod,
} from '@carto/maps-ai-tools';
import { buildSystemPrompt } from '../prompts/system-prompt.js';

export class VercelAIService {
  private carto: any;
  private model: any;
  private tools: any[];
  private systemPrompt: string;

  constructor() {
    // Validate required env vars
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    // Create OpenAI-compatible provider for CARTO LiteLLM
    this.carto = createOpenAI({
      baseURL: process.env.CARTO_LITELLM_URL,
      apiKey: apiKey,
      headers: {
        'x-litellm-api-key': apiKey,
      },
    });

    this.model = this.carto(process.env.GEMINI_MODEL);

    // Get tools and build system prompt
    const toolDefinitions = getAllToolDefinitions();
    this.tools = this.convertToolsToVercelFormat(toolDefinitions);
    this.systemPrompt = buildSystemPrompt(toolDefinitions);
  }

  /**
   * Convert OpenAI tool format to Vercel AI SDK format
   * OpenAI: {type: 'function', function: {name, description, parameters}}
   * Vercel: {[toolName]: {description, parameters: zodSchema}}
   */
  private convertToolsToVercelFormat(toolDefinitions: any[]): any {
    // For now, return undefined to keep it simple
    // Tools can be added in phase 2 after basic streaming works
    return undefined;
  }

  /**
   * Stream chat completion with full conversation history
   */
  async streamChatCompletion(
    messages: any[],
    res: Response
  ): Promise<any | null> {
    console.log('[VercelAI] Starting streamChatCompletion...');

    let contentAccumulator = '';

    try {
      // Stream response using Vercel AI SDK
      const result = streamText({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        // tools: this.tools,  // Uncomment after tool conversion implemented
      });

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Stream text chunks to client
      for await (const textPart of result.textStream) {
        contentAccumulator += textPart;
        res.write(textPart);
      }

      // End the response stream
      res.end();

      // Get full response and usage data
      const response = await result.response;
      const usage = await result.usage;

      // Extract cost metrics from LiteLLM headers
      const costMetrics = this.extractCostMetrics(response.headers);

      console.log('[VercelAI] Cost Metrics:', costMetrics);
      console.log('[VercelAI] Usage:', usage);

      // Return assistant message for conversation history
      return {
        role: 'assistant',
        content: contentAccumulator || 'I processed your request.',
      };

    } catch (error: any) {
      console.error('[VercelAI] Stream error:', error);

      if (!res.headersSent) {
        res.status(500).json({
          error: this.getErrorMessage(error),
          code: error.code
        });
      }

      return null;
    }
  }

  /**
   * Extract cost and usage metrics from LiteLLM response headers
   */
  private extractCostMetrics(headers: any): {
    original: number;
    discount: number;
    final: number;
    keySpend: number;
  } {
    const costOriginal = parseFloat(headers['x-litellm-response-cost-original'] || '0');
    const discount = parseFloat(headers['x-litellm-response-cost-discount-amount'] || '0');
    const keySpend = parseFloat(headers['x-litellm-key-spend'] || '0');

    return {
      original: costOriginal,
      discount,
      final: costOriginal - discount,
      keySpend
    };
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (error.status === 401) {
      return "Authentication error. Please check API configuration.";
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return "Connection timeout. Please try again.";
    }
    return "Failed to process request. Please try again.";
  }
}
```

**Key Design Decisions**:
- Constructor validates `GEMINI_API_KEY` early (fail fast)
- Uses `createOpenAI()` with custom baseURL (same as test_vercel.js)
- Reuses `buildSystemPrompt()` from existing code
- `convertToolsToVercelFormat()` placeholder (tools can be phase 2)
- Streams text directly to Express response object
- Extracts cost from headers after streaming completes
- Returns assistant message for conversation history

### 3.2 MODIFY: `backend/src/server.ts`

**Add endpoint after health check** (line 18):

```typescript
// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket/websocket-server.js';
import { VercelAIService } from './services/vercel-ai-service.js';
import { ConversationManager } from './services/conversation-manager.js';
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

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // AI Chat endpoint (NEW)
  app.post('/api/ai-chat', async (req, res) => {
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

      console.log(`[API] /api/ai-chat request for session: ${session}`);

      // Get services
      const services = getServices();

      // Add user message to conversation history
      services.conversationManager.addMessage(session, {
        role: 'user',
        content: message
      });

      // Get conversation history
      const messages = services.conversationManager.getConversation(session);

      // Stream response from Vercel AI SDK
      const assistantMessage = await services.vercelAIService.streamChatCompletion(
        messages,
        res
      );

      // Add assistant response to conversation history
      if (assistantMessage) {
        services.conversationManager.addMessage(session, assistantMessage);
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

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket
  setupWebSocket(server);

  return server;
}
```

**Key Points**:
- Lazy service initialization (same pattern as message-handler.ts)
- Validates request body (message is required)
- Auto-generates sessionId if not provided
- Reuses ConversationManager for history
- Follows same flow as WebSocket handler
- Error handling prevents double responses

### 3.3 MODIFY: `backend/src/index.ts`

**Add GEMINI_API_KEY validation** (line 8):

```typescript
// backend/src/index.ts
import dotenv from 'dotenv';
import { createServer } from './server.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'GEMINI_API_KEY'];
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please create a .env file with the required variables.');
  console.error('See .env.example for template.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = createServer();

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
  console.log(`🤖 Gemini Model: ${process.env.GEMINI_MODEL || 'carto::gemini-2.5-flash'}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🔗 REST API endpoint: http://localhost:${PORT}/api/ai-chat`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`=================================`);
});
```

**Changes**:
- Add `'GEMINI_API_KEY'` to required env vars
- Add Gemini model to console output
- Add REST API endpoint to console output

### 3.4 MODIFY: `backend/package.json`

**Add dependencies**:

```json
{
  "dependencies": {
    "@ai-sdk/openai": "^latest",
    "ai": "^latest",
    // ... existing dependencies
  }
}
```

### 3.5 MODIFY: `backend/.env`

**Add new environment variables**:

```bash
# Existing
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o
PORT=3000

# New - Required
GEMINI_API_KEY=your_gemini_api_key_here
CARTO_LITELLM_URL=https://litellm-gcp-us-east1.api.carto.com/v1
GEMINI_MODEL=carto::gemini-2.5-flash
```

---

## 4. Critical Implementation Details

### 4.1 Streaming Response Handling

**Vercel AI SDK Pattern** (from test_vercel.js):
```typescript
const result = streamText({
  model: carto('carto::gemini-2.5-flash'),
  messages: [...]
});

// Stream text
for await (const textPart of result.textStream) {
  res.write(textPart);  // Write to Express response
}

res.end();  // Close stream

// Get full response for headers
const response = await result.response;
const usage = await result.usage;
```

**Important**: Must call `res.end()` after streaming loop completes.

### 4.2 Cost Tracking

**LiteLLM Headers** (from documentation):
- `x-litellm-response-cost-original`: Cost before discount
- `x-litellm-response-cost-discount-amount`: Discount amount
- `x-litellm-key-spend`: Total spend for this API key

**Access Pattern**:
```typescript
const response = await result.response;
const headers = response.headers;
const cost = parseFloat(headers['x-litellm-response-cost-original'] || '0');
```

### 4.3 Message Format

**Good News**: Vercel AI SDK uses same message format as OpenAI:
```typescript
{
  role: 'system' | 'user' | 'assistant',
  content: string
}
```

Can reuse `ConversationManager` directly without conversion!

### 4.4 Tool Calling (Phase 2)

**Current**: Tools commented out in initial implementation

**Future**: Convert OpenAI tool format to Vercel AI SDK format:

**OpenAI Format** (from getAllToolDefinitions()):
```typescript
{
  type: 'function',
  function: {
    name: 'fly-to',
    description: '...',
    parameters: {
      type: 'object',
      properties: {...},
      required: [...]
    }
  }
}
```

**Vercel AI Format**:
```typescript
{
  'fly-to': {
    description: '...',
    parameters: zodSchema  // Zod schema object
  }
}
```

**Conversion Strategy**:
1. Import Zod schemas from `@carto/maps-ai-tools`
2. Map tool names to schemas
3. Pass to `streamText({tools: {...}})`

---

## 5. Common Pitfalls & Solutions

### 5.1 Response Already Sent Error

**Problem**: Calling `res.json()` or `res.end()` multiple times

**Solution**: Check `res.headersSent` before sending error responses
```typescript
if (!res.headersSent) {
  res.status(500).json({error: 'message'});
}
```

### 5.2 Headers Not Available

**Problem**: Trying to access `response.headers` before streaming completes

**Solution**: Always `await result.response` AFTER the streaming loop

### 5.3 Conversation History Not Maintained

**Problem**: Not saving assistant message to ConversationManager

**Solution**: Always call `addMessage()` after getting response:
```typescript
if (assistantMessage) {
  conversationManager.addMessage(sessionId, assistantMessage);
}
```

### 5.4 Environment Variable Missing

**Problem**: Server starts but crashes on first request

**Solution**: Validate `GEMINI_API_KEY` in index.ts at startup (fail fast)

---

## 6. Testing Strategy

### 6.1 Validation Gates (Executable)

```bash
# 1. Type check
cd backend
npx tsc --noEmit

# 2. Install dependencies
npm install

# 3. Start server
npm run dev

# 4. Test endpoint (in new terminal)
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, what can you help me with?",
    "sessionId": "test-session-123"
  }'

# Expected: Streaming text response about map capabilities

# 5. Test conversation history
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me airports in New York",
    "sessionId": "test-session-123"
  }'

# Expected: Response references previous context

# 6. Verify existing WebSocket still works
# Open frontend and test chat
```

### 6.2 Success Criteria

✅ **Type Check**: No TypeScript errors
✅ **Server Starts**: Shows both endpoints in console
✅ **Streaming Works**: curl receives text incrementally
✅ **History Maintained**: Second message has context from first
✅ **Cost Tracking**: Console logs show cost metrics
✅ **WebSocket Intact**: Existing frontend still works
✅ **Error Handling**: Invalid requests return 400/500 properly

### 6.3 Manual Testing Checklist

- [ ] Install dependencies successfully
- [ ] Server starts without errors
- [ ] Console shows REST API endpoint
- [ ] curl request returns streaming response
- [ ] Conversation history works across requests
- [ ] Cost metrics logged to console
- [ ] Invalid message returns 400 error
- [ ] Missing GEMINI_API_KEY prevents startup
- [ ] Existing WebSocket endpoint still functional

---

## 7. Implementation Order

**Follow this exact order**:

1. **Install dependencies**
   ```bash
   cd backend
   npm install @ai-sdk/openai ai
   ```

2. **Add environment variables**
   - Edit `backend/.env`
   - Add GEMINI_API_KEY, CARTO_LITELLM_URL, GEMINI_MODEL

3. **Update index.ts**
   - Add GEMINI_API_KEY validation
   - Update console logs

4. **Create vercel-ai-service.ts**
   - Copy structure from openai-service.ts
   - Implement constructor with createOpenAI
   - Implement streamChatCompletion
   - Implement extractCostMetrics
   - Leave tools undefined for now

5. **Update server.ts**
   - Add imports
   - Add lazy service initialization
   - Add POST /api/ai-chat endpoint

6. **Type check**
   ```bash
   npx tsc --noEmit
   ```

7. **Test**
   ```bash
   npm run dev
   # In another terminal:
   curl -X POST http://localhost:3000/api/ai-chat \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello", "sessionId": "test"}'
   ```

8. **Verify existing WebSocket**
   - Start frontend
   - Send chat message
   - Confirm still works

---

## 8. Troubleshooting Guide

### Issue: "GEMINI_API_KEY is required"
**Cause**: Missing environment variable
**Fix**: Add to `backend/.env`

### Issue: "Cannot find module '@ai-sdk/openai'"
**Cause**: Dependencies not installed
**Fix**: `npm install @ai-sdk/openai ai`

### Issue: curl hangs without response
**Cause**: Forgot `res.end()` after streaming
**Fix**: Check vercel-ai-service.ts line with res.end()

### Issue: "Response already sent"
**Cause**: Multiple res.write() or res.json() calls
**Fix**: Check `res.headersSent` before sending errors

### Issue: No cost metrics in logs
**Cause**: Headers accessed before streaming completes
**Fix**: Ensure `await result.response` happens AFTER streaming loop

### Issue: Conversation loses context
**Cause**: Not saving assistant message to ConversationManager
**Fix**: Check addMessage() call after streamChatCompletion

---

## 9. Future Enhancements (Out of Scope)

These are **NOT** required for initial implementation:

- [ ] Tool calling support (phase 2)
- [ ] Return cost metrics in response body
- [ ] Frontend integration with REST endpoint
- [ ] Session cleanup/expiration
- [ ] Rate limiting per session
- [ ] Request logging middleware
- [ ] Unit tests
- [ ] Integration tests

---

## 10. Documentation Updates Needed

After implementation:
- [ ] Update main README.md with REST endpoint usage
- [ ] Update CLAUDE.md with Vercel AI SDK patterns
- [ ] Create API documentation for /api/ai-chat
- [ ] Update .env.example with new variables

---

## 11. Quality Checklist

- [x] All necessary context included (docs, code references)
- [x] Validation gates are executable
- [x] References existing patterns (OpenAIService, ConversationManager)
- [x] Clear implementation path (step-by-step)
- [x] Error handling documented
- [x] Troubleshooting guide provided
- [x] Testing strategy defined
- [x] Common pitfalls identified
- [x] Implementation order specified

---

## 12. Confidence Score: 8/10

**Why 8/10?**

**Strengths** (adds confidence):
- ✅ Working reference implementation (test_vercel.js)
- ✅ Clear existing patterns to follow (OpenAIService)
- ✅ Well-researched documentation links
- ✅ Simple scope (tools deferred to phase 2)
- ✅ Reusable components (ConversationManager)
- ✅ Executable validation gates

**Risks** (reduces confidence):
- ⚠️ Streaming to Express response - not tested yet
- ⚠️ Cost header extraction timing - may need adjustment
- ⚠️ Error handling edge cases - may need refinement

**Mitigation**:
- Follow test_vercel.js pattern exactly for streaming
- Test incrementally (type check → basic endpoint → streaming → history)
- Use curl to verify each step before moving forward

**Expected Outcome**: One-pass implementation should succeed with minor adjustments to error handling or streaming details.

---

## Sources Referenced

- [Vercel AI SDK streamText Documentation](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [OpenAI Compatible Providers Guide](https://ai-sdk.dev/providers/openai-compatible-providers)
- [LiteLLM Response Headers](https://docs.litellm.ai/docs/proxy/response_headers)
- [LiteLLM Cost Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking)
- [LiteLLM Streaming Documentation](https://docs.litellm.ai/stream)
