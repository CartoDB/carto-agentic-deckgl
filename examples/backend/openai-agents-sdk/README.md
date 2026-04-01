# OpenAI Agents SDK Backend

> Backend server using OpenAI Agents SDK for AI orchestration with WebSocket streaming.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your credentials (see docs/ENVIRONMENT.md)
npm run dev   # http://localhost:3003
```

---

## Architecture

```text
Client (WebSocket or HTTP)
         |
    server.ts
    (Express + WS)
         |
    agent-runner.ts
    (Agent + run() streaming)
         |
    +-----------+-----------+
    |           |           |
providers.ts  tools.ts   system-prompt.ts
(OpenAI       (tool      (prompt builder)
 client +      aggregation)
 model)        |
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
5. **Agent runner** creates an `Agent` with tools and calls `run()` with streaming enabled
6. **Streaming loop**: processes `RunItemStreamEvent` and `RunRawModelStreamEvent` events
   - Text chunks are streamed back to the client
   - `set-deck-state` tool calls are forwarded to the frontend for execution
   - Backend-only tools (geocoding) are executed server-side
   - MCP tool calls are forwarded to the MCP server
7. **Frontend executes tool** and sends result back
8. **Agent runner** continues the loop with tool results until the AI is done

---

## Key Patterns

### Agent Runner

The agent runner (`services/agent-runner.ts`) orchestrates the AI interaction using the OpenAI Agents SDK's `Agent` + `run()`:

- Creates an `Agent` instance with the system prompt, model, and tools
- Calls `run()` with streaming enabled to process the conversation
- Processes two event types:
  - `RunItemStreamEvent` -- handles `tool_called`, `tool_output`, and `message_output_created` events
  - `RunRawModelStreamEvent` -- streams text deltas to the client
- Handles non-streamed text via `message_output_created` fallback (for Chat Completions mode where deltas may not arrive)
- Uses `parseFrontendToolResult()` to distinguish frontend tool outputs from backend-executed ones
- Sanitizes malformed keys from certain AI providers (e.g., Gemini wraps `@@type` in quotes)
- Strips CARTO credentials from tool call data before sending to the frontend

### MCP Table Name Caching

When an MCP async workflow completes (`async_workflow_job_get_results`), the agent runner extracts the `workflowOutputTableName` from the tool call input parameters. This table name identifies where the MCP workflow stored its output in CARTO.

The table name is stored in conversation history with a `[MCP Result Table Available]` marker:
> `[MCP Result Table Available] The MCP workflow result is stored in table "<table>". When the user asks to filter or mask by this area, call set-mask-layer { action: "set", tableName: "<table>" }.`

When the user later asks to "filter by this area" or "mask the map to this region", the AI retrieves the cached table name and calls `set-mask-layer { action: "set", tableName: "<table>" }`. The frontend fetches the geometry directly from the CARTO table via `vectorTableSource`.

The agent runner also extracts coordinates from the MCP result (via `extractCoordinatesFromMcpResult()`) for centering the map. If the LLM fails to add a layer with the MCP table, a fallback `VectorTileLayer` is auto-injected.

### MCP Mock Mode

When `MCP_MOCK_MODE=true`, the backend uses fixture-backed MCP tools for testing (reference `npm run dev:mock-mcp` command). Mock fixtures are defined in `agent/mcp-mock-fixtures.ts` and return pre-defined responses for each MCP tool. Useful for testing and development without MCP credentials.

### Tool Conversion

The consolidated tools (`set-deck-state`, `set-marker`, `set-mask-layer`) are converted to OpenAI Agents SDK format using `getToolsForOpenAIAgents()` from `@carto/agentic-deckgl/converters`. A custom `zodV4ToJsonSchema()` converter is used because the SDK's built-in schema converter cannot handle `z.unknown()` used in flexible layer configs.

### FrontendToolResult

`parseFrontendToolResult()` routes tool outputs to frontend via WebSocket. Tools return a `FrontendToolResult` marker (`{ __frontend_tool__: true, toolName, data }`) to signal that the tool call should be forwarded to the frontend instead of executed server-side.

---

## Shared Documentation

- [Getting Started](../../../docs/GETTING_STARTED.md) — Prerequisites, installation, running
- [Environment Configuration](../../../docs/ENVIRONMENT.md#backend-variables) — Backend environment variables
- [Tool System](../../../docs/TOOLS.md) — set-deck-state, set-marker, set-mask-layer, MCP tools
- [Communication Protocol](../../../docs/COMMUNICATION_PROTOCOL.md) — Message types, endpoints, session management
- [System Prompt](../../../docs/SYSTEM_PROMPT.md) — Library and custom prompt layers
- [Semantic Layer](../../../docs/SEMANTIC_LAYER_GUIDE.md) — YAML configuration and loader functions
