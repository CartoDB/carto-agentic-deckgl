# OpenAI Integration with Streaming and Tool Calling

## FEATURE:

As a **user of the interactive map chat application**, I want to **converse with an AI assistant powered by OpenAI that can understand natural language and intelligently control the map** so that **I can interact with the map using conversational language instead of memorizing specific command syntax**.

### Core Requirements:

**Backend OpenAI Integration:**
- Forward all incoming chat messages to the OpenAI Chat Completions API (streaming mode)
- Configure OpenAI API key via environment variable (`OPENAI_API_KEY`)
- Implement a system prompt that wraps user messages to provide context about the map application
- Stream responses from OpenAI back to the frontend in real-time as tokens arrive
- Define map control functions as OpenAI tools (function calling):
  - `zoom_map` - Control zoom level (in/out by N levels)
  - `fly_to_location` - Navigate to coordinates or named locations
  - `toggle_layer` - Show/hide map layers (points layer)

**OpenAI Tool Calling Integration:**
- Register map functions as tools in the OpenAI API request
- LLM autonomously decides when to call tools based on user intent
- Parse tool call responses from OpenAI
- Forward tool execution commands to frontend via WebSocket
- Continue conversation flow after tool execution

**Frontend Streaming Support:**
- Receive and display streaming text responses token-by-token as they arrive
- Handle tool call messages separately from text responses
- Execute map commands when tool calls are received
- Maintain conversation context showing both AI responses and tool actions

**Environment Configuration:**
- Store OpenAI API key securely in backend `.env` file
- Never expose API key to frontend
- Validate API key presence on backend startup

### Expected Behavior:

1. User types natural language message (e.g., "Can you show me San Francisco and zoom in a bit?")
2. Backend receives message via WebSocket
3. Backend forwards to OpenAI with:
   - System prompt providing map context
   - User message
   - Available tool definitions
   - Streaming enabled
4. OpenAI processes request and may:
   - Return streaming text response
   - Call one or more tools (fly_to_location, zoom_map)
   - Return both text and tool calls
5. Backend streams response chunks to frontend
6. Frontend displays streaming text in chat
7. If tool calls present, backend sends tool execution commands
8. Frontend executes map commands and displays action confirmation
9. Conversation continues naturally

### Technical Implementation:

**OpenAI API Configuration:**
```
Model: gpt-4o or gpt-4-turbo
Stream: true
Tools: [zoom_map, fly_to_location, toggle_layer]
Temperature: 0.7
```

**System Prompt Template:**
```
You are a helpful AI assistant integrated with an interactive map application.
Users can ask you to control the map or ask general questions.

Available map controls:
- Zoom in/out on the map
- Fly to specific locations (cities or coordinates)
- Show/hide the points layer

Be conversational and helpful. When users want to control the map, use the
provided tools. Explain what you're doing when executing map commands.
```

---

## EXAMPLES:

### Example 1: Conversational Map Control

**User Input:**
```
"Hey! Can you show me New York City?"
```

**Expected Flow:**
1. Backend sends to OpenAI with tools
2. OpenAI decides to call `fly_to_location` tool with params: `{location: "New York"}`
3. Backend receives:
   - Streaming text: "Sure! Let me navigate to New York City for you."
   - Tool call: `fly_to_location(location="New York")`
4. Frontend displays:
   - Streaming text in chat: "Sure! Let me navigate to New York City for you."
   - Executes map command: flies to NYC coordinates
   - Shows confirmation: "✓ Flew to New York City"

### Example 2: Multiple Tool Calls

**User Input:**
```
"Show me San Francisco and zoom in a bit"
```

**Expected Flow:**
1. OpenAI returns:
   - Text: "I'll navigate to San Francisco and zoom in for you."
   - Tool call 1: `fly_to_location(location="San Francisco")`
   - Tool call 2: `zoom_map(direction="in", levels=2)`
2. Frontend:
   - Displays streaming text
   - Executes fly to San Francisco
   - Executes zoom in by 2 levels
   - Shows: "✓ Flew to San Francisco" and "✓ Zoomed in by 2 levels"

### Example 3: General Conversation (No Tools)

**User Input:**
```
"What's the weather like today?"
```

**Expected Flow:**
1. OpenAI responds with text only (no tool calls)
2. Backend streams: "I'm a map assistant and don't have access to weather data..."
3. Frontend displays streaming response
4. No map commands executed

### Example 4: Complex Request

**User Input:**
```
"I want to see all the cities in the US, but start by showing me the west coast"
```

**Expected Flow:**
1. OpenAI responds:
   - Text: "I'll show you the points layer and navigate to the west coast..."
   - Tool call 1: `toggle_layer(layer_id="points", visible=true)`
   - Tool call 2: `fly_to_location(coordinates=[-120, 37], zoom=6)`
2. Frontend executes both commands and displays streaming conversation

### Example 5: Streaming Response

**Frontend Display (as tokens arrive):**
```
Bot: Sure
Bot: Sure!
Bot: Sure! Let
Bot: Sure! Let me
Bot: Sure! Let me help
Bot: Sure! Let me help you
Bot: Sure! Let me help you with
Bot: Sure! Let me help you with that
Bot: Sure! Let me help you with that.
✓ Flew to Chicago
Bot: Sure! Let me help you with that. I've
Bot: Sure! Let me help you with that. I've navigated
Bot: Sure! Let me help you with that. I've navigated to Chicago for you!
```

---

## DOCUMENTATION:

### Required API Documentation:

**OpenAI Chat Completions API:**
- [Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat/create)
- [Streaming Guide](https://platform.openai.com/docs/api-reference/streaming)
- [Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Tool Use Documentation](https://platform.openai.com/docs/guides/function-calling/function-calling-with-structured-outputs)

**OpenAI Node.js SDK:**
- [Official SDK Repository](https://github.com/openai/openai-node)
- [Streaming Example](https://github.com/openai/openai-node#streaming-responses)
- [Function Calling Example](https://github.com/openai/openai-node#function-calling)

**WebSocket Streaming Patterns:**
- [Server-Sent Events vs WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Streaming over WebSocket](https://javascript.info/websocket)

### Message Protocol Documentation:

**Streaming Text Message (Backend → Frontend):**
```typescript
{
  type: 'stream_chunk',
  content: string,      // Token(s) from OpenAI
  messageId: string,    // Unique ID for this AI response
  isComplete: boolean   // True on final chunk
}
```

**Tool Call Message (Backend → Frontend):**
```typescript
{
  type: 'tool_call',
  tool: 'zoom_map' | 'fly_to_location' | 'toggle_layer',
  parameters: {
    // Tool-specific parameters
  },
  callId: string
}
```

**Tool Result Message (Frontend → Backend):**
```typescript
{
  type: 'tool_result',
  callId: string,
  result: 'success' | 'error',
  message?: string
}
```

### Documentation to be Created:

After implementation, create:
- **OpenAI Integration Guide**: Setup, configuration, and API key management
- **Tool Definitions Reference**: Complete specification of all map control tools
- **Streaming Implementation Guide**: How streaming works between OpenAI, backend, and frontend
- **Prompt Engineering Guide**: System prompt customization and best practices
- **Cost Monitoring Guide**: Tracking OpenAI API usage and costs
- **Error Handling Guide**: Handling API errors, rate limits, and timeouts
- **Security Best Practices**: API key rotation, request validation, rate limiting

---

## OTHER CONSIDERATIONS:

### Security & API Key Management:

**Critical Security Requirements:**
- **Never expose OpenAI API key to frontend** - all calls must go through backend
- Store API key in backend `.env` file with restrictive permissions (600)
- Use separate API keys for development, staging, and production
- Implement API key rotation strategy
- Add `.env` to `.gitignore` to prevent accidental commits
- Provide `.env.example` template without actual keys
- Validate API key on server startup and fail fast if missing

**Rate Limiting & Abuse Prevention:**
- Implement per-user message rate limiting (e.g., max 10 messages/minute)
- Set maximum token limits on OpenAI requests (max_tokens parameter)
- Monitor and alert on unusual usage patterns
- Consider implementing conversation history limits

### OpenAI API Considerations:

**Model Selection:**
- **gpt-4o**: Recommended - best balance of cost, speed, and capability
- **gpt-4-turbo**: Alternative - slightly cheaper, still excellent
- **gpt-3.5-turbo**: Budget option - faster but less capable with tools
- Make model configurable via environment variable

**Token Management:**
- System prompt tokens count toward each request
- Tool definitions add significant token overhead
- Conversation history accumulates tokens quickly
- Implement sliding window for conversation history (e.g., last 10 messages)
- Set reasonable `max_tokens` limit (e.g., 500) to control costs

**Streaming Implementation Gotchas:**
- Streaming responses come as delta chunks, not complete messages
- Tool calls may arrive across multiple chunks
- Must buffer and parse tool call JSON incrementally
- Handle network interruptions gracefully
- Implement timeout for streaming responses (e.g., 30 seconds)

### Tool Calling Implementation:

**Tool Definition Best Practices:**
- Use clear, descriptive function names
- Provide detailed parameter descriptions
- Include parameter validation schemas
- Make parameters strongly typed
- Provide examples in descriptions
- Keep tool count reasonable (3-7 tools optimal)

**Tool Execution Flow:**
1. OpenAI returns tool call in streaming response
2. Backend parses tool call (name + arguments)
3. Backend validates tool name and parameters
4. Backend sends tool execution command to frontend
5. Frontend executes map command
6. Frontend sends result back to backend
7. Backend sends tool result to OpenAI (optional for follow-up)

**Example Tool Definition:**
```json
{
  "type": "function",
  "function": {
    "name": "fly_to_location",
    "description": "Navigate the map to a specific location by city name or coordinates",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "City name (e.g., 'New York', 'San Francisco')"
        },
        "coordinates": {
          "type": "array",
          "items": {"type": "number"},
          "minItems": 2,
          "maxItems": 2,
          "description": "Optional [longitude, latitude] coordinates"
        },
        "zoom": {
          "type": "integer",
          "description": "Optional zoom level (0-20)",
          "minimum": 0,
          "maximum": 20
        }
      },
      "required": []
    }
  }
}
```

### Frontend Streaming Implementation:

**Challenges:**
- Must accumulate streaming chunks into message buffer
- Update UI incrementally as chunks arrive
- Handle chunk containing both text and tool calls
- Preserve message identity across chunks
- Auto-scroll chat to show latest content

**Implementation Pattern:**
```javascript
// Pseudo-code
let messageBuffer = {};

wsClient.onMessage((data) => {
  if (data.type === 'stream_chunk') {
    if (!messageBuffer[data.messageId]) {
      messageBuffer[data.messageId] = '';
    }
    messageBuffer[data.messageId] += data.content;
    chatUI.updateStreamingMessage(data.messageId, messageBuffer[data.messageId]);

    if (data.isComplete) {
      delete messageBuffer[data.messageId];
    }
  }
});
```

### Backend Changes Required:

**Message Handler Refactoring:**
- Replace simple echo logic with OpenAI integration
- Add streaming response handling
- Implement tool call parsing and forwarding
- Add conversation history management
- Add error handling for OpenAI API failures

**New Dependencies:**
- `openai` package (official SDK)
- Enhanced error handling for API errors
- Token counting utilities (optional but recommended)

### Cost Implications:

**Pricing Considerations:**
- GPT-4o: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens
- GPT-3.5-turbo: ~10x cheaper but less capable
- Tool definitions add ~200-500 tokens per request
- System prompt adds ~100-200 tokens per request
- Average conversation: 50-200 tokens per exchange

**Cost Control Strategies:**
- Set `max_tokens` limit to prevent runaway responses
- Implement conversation history pruning
- Consider caching system prompt (if using compatible model)
- Monitor usage with OpenAI dashboard
- Set up billing alerts
- Use cheaper models for simple queries (if implementing model routing)

### Error Handling Requirements:

**API Error Scenarios:**
- Invalid API key → Fail server startup with clear error
- Rate limit exceeded → Return user-friendly message, retry with backoff
- Network timeout → Retry once, then show error message
- Invalid tool call → Log error, continue conversation
- Malformed streaming response → Close stream, log error

**Error Messages for Users:**
- Generic: "I'm having trouble connecting. Please try again."
- Rate limit: "I'm receiving too many requests. Please wait a moment."
- Timeout: "This is taking longer than expected. Let me try again."

### Performance Considerations:

**Latency Concerns:**
- First token latency: typically 500-1500ms
- Streaming helps perceived performance
- Tool calls add additional latency
- Consider showing "typing" indicator while waiting

**Optimization Strategies:**
- Keep system prompt concise
- Prune conversation history aggressively
- Use shorter model names in configuration
- Consider response caching for common queries (complex)

### Testing Considerations:

**Unit Tests Needed:**
- Tool call parsing from streaming chunks
- Tool validation (name, parameters)
- Conversation history management
- Error handling for various API errors

**Integration Tests:**
- End-to-end message flow with OpenAI
- Streaming response assembly
- Tool call execution flow
- Error recovery scenarios

**Manual Testing Checklist:**
- Simple text responses work
- Tool calls execute correctly
- Multiple tool calls in one response
- Streaming displays smoothly
- Error messages display appropriately
- Rate limiting works
- Cost stays within budget

### Architecture Decisions:

**Conversation History:**
- Store in memory (simple but lost on restart)
- Store in database (persistent but adds complexity)
- Recommendation: Start with in-memory, add persistence later

**Tool Result Feedback Loop:**
- Option 1: Don't send tool results back to OpenAI (simpler)
- Option 2: Send results for follow-up conversation (more natural)
- Recommendation: Start without feedback, add if needed

**Frontend Tool Execution:**
- Option 1: Frontend executes tools independently
- Option 2: Frontend requests backend to validate first
- Recommendation: Frontend executes directly for lower latency

### Migration from Echo to OpenAI:

**Backward Compatibility:**
- Keep echo functionality as fallback if OpenAI fails
- Add feature flag to enable/disable OpenAI
- Allow gradual rollout with A/B testing

**Rollback Plan:**
- Keep previous echo implementation in separate branch
- Document rollback procedure
- Test rollback in staging environment

### Common Pitfalls AI Assistants Miss:

1. **Streaming Chunk Boundaries**: Tool calls may be split across multiple chunks - must buffer and parse incrementally
2. **Tool Call Format**: OpenAI tool calls use specific JSON structure - validate format carefully
3. **Token Accumulation**: Conversation history grows fast - implement aggressive pruning
4. **Error Recovery**: OpenAI API can fail mid-stream - handle gracefully without crashing
5. **CORS in Production**: WebSocket connections need proper CORS for deployed environments
6. **API Key in Logs**: Never log API keys, even in debug mode
7. **Tool Parameter Validation**: Always validate tool parameters before sending to frontend
8. **Streaming State Management**: Track which message is currently streaming to avoid UI glitches
9. **Empty Tool Calls**: OpenAI may occasionally return malformed tool calls - handle gracefully
10. **Rate Limit Headers**: Monitor OpenAI rate limit headers to implement proactive throttling

---

## Implementation Priority:

**Phase 1 (MVP):**
- Basic OpenAI integration with streaming
- Single tool: fly_to_location
- Simple system prompt
- Error handling basics

**Phase 2:**
- Add zoom_map and toggle_layer tools
- Conversation history (5 messages)
- Improved error messages
- Rate limiting

**Phase 3:**
- Tool result feedback loop
- Persistent conversation history
- Cost monitoring dashboard
- Advanced prompt engineering

---

## Success Metrics:

- [ ] User sends message, receives streaming AI response
- [ ] AI can successfully call tools based on natural language
- [ ] Map executes commands from AI tool calls
- [ ] Streaming text displays smoothly without glitches
- [ ] API key never exposed to frontend
- [ ] Error messages displayed appropriately
- [ ] Conversation feels natural and contextual
- [ ] Average response latency < 2 seconds
- [ ] Monthly OpenAI costs stay within budget
- [ ] No API key leaks or security incidents
