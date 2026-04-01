# Google ADK Backend

> **Experimental** backend server using Google Agent Development Kit (ADK) for AI orchestration with WebSocket streaming.

## Quick Start

```bash
npm install --force   # --force needed for ADK peer dependency conflicts
cp .env.example .env
# Edit .env with your credentials (see docs/ENVIRONMENT.md)
npm run dev           # http://localhost:3003
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
    (LlmAgent + InMemoryRunner)
         |
    +-----------+-----------+
    |           |           |
providers.ts  tools.ts   system-prompt.ts
(CartoLiteLlm (tool      (prompt builder)
 singleton)    aggregation)
    |          |
    |   +---------+---------+
    |   |         |         |
    | local    custom     MCP
    | tools    tools      tools
    | (from    (geocode)  (remote
    | library)            servers)
    |
 models/carto-litellm.ts
 (BaseLlm -> OpenAI Chat Completions)
```

### Request Flow

1. **Client connects** via WebSocket (`/ws`) or sends HTTP POST (`/api/chat`)
2. **Server creates session** with a `ConversationManager` for history tracking
3. **User sends message** with current map state (`initialState`)
4. **Server builds system prompt** using `buildSystemPrompt()` from `@carto/agentic-deckgl` plus semantic context and custom instructions
5. **Agent runner** creates an `LlmAgent` with tools and uses `InMemoryRunner.runAsync()` with `StreamingMode.SSE`
6. **ADK handles the tool loop internally** -- unlike the other backends, there is no manual tool loop
7. **Streaming events** contain `Content.parts[]` with text, functionCall, or functionResponse
   - Text chunks are streamed back to the client (deltas computed from accumulated text)
   - `set-deck-state` tool calls are forwarded to the frontend for execution
   - Backend-only tools (geocoding) are executed server-side
   - MCP tool calls are forwarded to the MCP server
8. **Frontend executes tool** and sends result back
9. **Agent continues** until the AI is done

---

## Key Patterns

### CartoLiteLlm Bridge

The `CartoLiteLlm` class (`models/carto-litellm.ts`) extends ADK's `BaseLlm` to bridge ADK's `Content/Part` format with OpenAI's Chat Completions API. This is the major unique feature of this backend — it enables any OpenAI-compatible LLM via LiteLLM proxy, even though ADK natively expects Google Gemini models.

Key responsibilities:

- **ADK Content[] to OpenAI messages** -- Converts ADK's flat `Part[]` arrays into OpenAI's structured message format (multiple `functionCalls` become a single assistant message with `tool_calls[]`, each `functionResponse` becomes a separate tool message)
- **FunctionDeclarations to OpenAI tools** -- Converts Google schema types (`OBJECT`, `STRING`, etc.) to JSON Schema for the Chat Completions API
- **Tool call ID round-tripping** -- Maintains a `toolCallIdMap` to track the mapping between ADK-generated function call IDs and OpenAI's `tool_call_id` values
- **Streaming and non-streaming** -- Supports both modes, yielding `LlmResponse` objects with `partial`/`turnComplete` flags
- **Google schema type conversion** -- Maps Google's type enum (`OBJECT`, `STRING`, `NUMBER`, `INTEGER`, `BOOLEAN`, `ARRAY`) to JSON Schema types

### Agent Runner

The agent runner (`services/agent-runner.ts`) orchestrates the AI interaction using ADK's `LlmAgent` + `InMemoryRunner`:

- Creates an `LlmAgent` with system prompt, model (`CartoLiteLlm`), and tools
- Uses `InMemoryRunner.runAsync()` with `StreamingMode.SSE` for streaming
- ADK handles the tool execution loop internally (no manual tool loop needed)
- Key differences from other backends:
  - **Accumulated text, not deltas** -- ADK sends accumulated text in events; the runner computes deltas by tracking `lastTextLength`
  - **Content.parts[] events** -- Events contain `text`, `functionCall`, or `functionResponse` parts
  - **`isFrontendToolResult()`** -- Works on objects directly (no `JSON.parse` needed, unlike OpenAI Agents SDK's `parseFrontendToolResult`)
  - **Conversation history as context prefix** -- Conversation history is embedded as a context prefix in the user message
- Sanitizes malformed keys and strips credentials before forwarding to the frontend

### Tool Conversion

The consolidated tools (`set-deck-state`, `set-marker`, `set-mask-layer`) are converted to Google ADK format using `getToolsForGoogleADK()` from `@carto/agentic-deckgl/converters`. Unlike the OpenAI Agents SDK backend, no `zodV4ToJsonSchema()` workaround is needed — ADK handles Zod schemas natively.

### Installation Note

`npm install --force` is required due to peer dependency conflicts in `@google/adk`. This is a known limitation of the ADK package and does not affect functionality.

### MCP Table Name Caching

When an MCP async workflow completes (`async_workflow_job_get_results`), the agent runner extracts the `workflowOutputTableName` from the tool call input parameters. This table name identifies where the MCP workflow stored its output in CARTO.

The table name is stored in conversation history with a `[MCP Result Table Available]` marker:
> `[MCP Result Table Available] The MCP workflow result is stored in table "<table>". When the user asks to filter or mask by this area, call set-mask-layer { action: "set", tableName: "<table>" }.`

When the user later asks to "filter by this area" or "mask the map to this region", the AI retrieves the cached table name and calls `set-mask-layer { action: "set", tableName: "<table>" }`. The frontend fetches the geometry directly from the CARTO table via `vectorTableSource`.

The agent runner also extracts coordinates from the MCP result (via `extractCoordinatesFromMcpResult()`) for centering the map. If the LLM fails to add a layer with the MCP table, a fallback `VectorTileLayer` is auto-injected.

---

## Shared Documentation

- [Getting Started](../../../docs/GETTING_STARTED.md) — Prerequisites, installation, running
- [Environment Configuration](../../../docs/ENVIRONMENT.md#backend-variables) — Backend environment variables
- [Tool System](../../../docs/TOOLS.md) — set-deck-state, set-marker, set-mask-layer, MCP tools
- [Communication Protocol](../../../docs/COMMUNICATION_PROTOCOL.md) — Message types, endpoints, session management
- [System Prompt](../../../docs/SYSTEM_PROMPT.md) — Library and custom prompt layers
- [Semantic Layer](../../../docs/SEMANTIC_LAYER_GUIDE.md) — YAML configuration and loader functions
