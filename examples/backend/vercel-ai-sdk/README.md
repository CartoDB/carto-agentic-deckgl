# Vercel AI SDK Backend

> Backend server using Vercel AI SDK v6 for AI orchestration with WebSocket streaming.

---

## Architecture

```text
Client (WebSocket or HTTP)
         |
    server.ts
    (Express + WS)
         |
    agent-runner.ts
    (Vercel AI SDK streamText)
         |
    +-----------+-----------+
    |           |           |
providers.ts  tools.ts   system-prompt.ts
(LLM config)  (tool      (prompt builder)
              aggregation)
              |
    +---------+---------+
    |         |         |
  local    custom     MCP
  tools    tools      tools
  (from    (geocode)  (remote
  library)            servers)
```

### Request Flow

1. **Client connects** via WebSocket (`/ws`) or sends HTTP POST (`/api/chat`)
2. **Server creates session** with a `ConversationManager` for history tracking
3. **User sends message** with current map state (`initialState`)
4. **Server builds system prompt** using `buildSystemPrompt()` from `@carto/agentic-deckgl` plus semantic context and custom instructions
5. **Agent runner** calls `streamText()` from Vercel AI SDK with the tool definitions
6. **Streaming loop**: AI generates text chunks and tool calls
   - Text chunks are streamed back to the client
   - `set-deck-state` tool calls are forwarded to the frontend for execution
   - Backend-only tools (geocoding) are executed server-side
   - MCP tool calls are forwarded to the MCP server
7. **Frontend executes tool** and sends result back
8. **Agent runner** continues the loop with tool results until the AI is done

---

## Key Patterns

### Agent Runner

The `AgentRunner` (`services/agent-runner.ts`) orchestrates the AI interaction loop using Vercel AI SDK's `streamText`:

- Builds the complete message history (system prompt + conversation)
- Calls `streamText()` with all available tools
- Streams text chunks and tool calls back to the client
- Sanitizes malformed keys from certain AI providers (e.g., Gemini wraps `@@type` in quotes)
- Strips CARTO credentials from tool call data before sending to the frontend
- Tracks step count for the tool loop

Uses `streamText()` with `maxSteps` for multi-turn tool use, and `onChunk`/`onStepFinish` callbacks for streaming events.

### Provider Configuration

Uses `createOpenAICompatible()` from `@ai-sdk/openai-compatible` for custom LLM endpoints. The `CARTO_AI_API_TYPE` environment variable enables Vercel AI SDK-specific provider type selection (`chat` for LiteLLM proxies, `responses` for native OpenAI Agents API).

### Tool Conversion

The consolidated tools (`set-deck-state`, `set-marker`, `set-mask-layer`) are converted to Vercel AI SDK format using `getToolsForVercelAI()` from `@carto/agentic-deckgl/converters`. Vercel AI SDK has native Zod schema support, so no custom converter is needed.

### MCP Table Name Caching

When an MCP async workflow completes (`async_workflow_job_get_results`), the agent runner extracts the `workflowOutputTableName` from the tool call input parameters. This table name identifies where the MCP workflow stored its output in CARTO.

The table name is stored in conversation history with a `[MCP Result Table Available]` marker:
> `[MCP Result Table Available] The MCP workflow result is stored in table "<table>". When the user asks to filter or mask by this area, call set-mask-layer { action: "set", tableName: "<table>" }.`

When the user later asks to "filter by this area" or "mask the map to this region", the AI retrieves the cached table name and calls `set-mask-layer { action: "set", tableName: "<table>" }`. The frontend fetches the geometry directly from the CARTO table via `vectorTableSource`.

The agent runner also extracts coordinates from the MCP result (via `extractCoordinatesFromMcpResult()`) for centering the map. If the LLM fails to add a layer with the MCP table, a fallback `VectorTileLayer` is auto-injected.

---

## Shared Documentation

- [Getting Started](../../../docs/getting-started.md) — Prerequisites, installation, running
- [Environment Configuration](../../../docs/environment.md#backend-variables) — Backend environment variables
- [Tool System](../../../docs/tools.md) — set-deck-state, set-marker, set-mask-layer, MCP tools
- [WebSocket Protocol](../../../docs/websocket-protocol.md) — Message types, endpoints, session management
- [System Prompt](../../../docs/system-prompt.md) — Library and custom prompt layers
- [Semantic Layer](../../../docs/semantic-layer.md) — YAML configuration and loader functions
