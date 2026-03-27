# Backend Examples

> Three AI SDK integrations for the agentic map backend — all share the same WebSocket protocol.

## SDK Comparison

| SDK | Key Feature | Dev Command | README |
|-----|-------------|-------------|--------|
| OpenAI Agents SDK | Agent + Runner pattern, MCP Mock Mode | `npm run dev` | [README](openai-agents-sdk/README.md) |
| Vercel AI SDK v6 | streamText + maxSteps, OpenAI-compatible providers | `npm run dev` | [README](vercel-ai-sdk/README.md) |
| Google ADK | LlmAgent + InMemoryRunner, CartoLiteLlm bridge | `npm run dev` | [README](google-adk/README.md) |

## Shared Architecture

All backends share the same directory structure (`server.ts`, `services/`, `agent/`, `prompts/`, `semantic/`), the same WebSocket/HTTP protocol, and the same tool definitions from `@carto/agentic-deckgl`. Any backend works with any frontend.

## Shared Documentation

- [Getting Started](../../docs/getting-started.md#available-backends) — Installation and dev commands
- [Environment Configuration](../../docs/environment.md#backend-variables) — Backend environment variables
- [Tool System](../../docs/tools.md) — set-deck-state, set-marker, set-mask-layer, MCP tools
- [WebSocket Protocol](../../docs/websocket-protocol.md) — Message types, endpoints, session management
- [System Prompt](../../docs/system-prompt.md) — Library and custom prompt layers
- [Semantic Layer](../../docs/semantic-layer.md) — YAML configuration and loader functions
