# Frontend Examples

> Four framework integrations for AI-powered deck.gl map control via natural language chat.

## Framework Comparison

| Framework | State Pattern | Dev Command | README |
|-----------|---------------|-------------|--------|
| Angular 20 | RxJS BehaviorSubject | `pnpm start` | [README](angular/README.md) |
| React 19 | Context + useReducer | `pnpm dev` | [README](react/README.md) |
| Vue 3 | Composables (reactive refs) | `pnpm dev` | [README](vue/README.md) |
| Vanilla JS | EventEmitter | `pnpm dev` | [README](vanilla/README.md) |

## Shared Architecture

All frontends share the same 6-component layout (MapView, ChatPanel, LayerToggle, ZoomControls, Snackbar, ConfirmationDialog), use JSONConverter for deck.gl JSON spec resolution, and connect to the backend via WebSocket. Any backend works with any frontend.

## Shared Documentation

- [Getting Started](../../docs/GETTING_STARTED.md#available-frontends) — Installation and dev commands
- [Environment Configuration](../../docs/ENVIRONMENT.md#frontend-variables) — Frontend environment variables
- [Tool System](../../docs/TOOLS.md) — set-deck-state, set-marker, set-mask-layer
- [Communication Protocol](../../docs/COMMUNICATION_PROTOCOL.md) — Message types and flow
- [System Prompt](../../docs/SYSTEM_PROMPT.md) — Prompt architecture
- [Semantic Layer](../../docs/SEMANTIC_LAYER_GUIDE.md) — Data catalog configuration
