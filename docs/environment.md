# Environment Configuration

Environment variable reference for all backend and frontend integrations.

---

## Backend Variables

All three backend integrations (OpenAI Agents SDK, Vercel AI SDK, Google ADK) use the same environment variables.

| Variable | Required | Description | Notes |
|----------|----------|-------------|-------|
| `CARTO_AI_API_BASE_URL` | Yes | OpenAI-compatible LLM endpoint URL | |
| `CARTO_AI_API_KEY` | Yes | API key for the LLM endpoint | |
| `CARTO_AI_API_MODEL` | No | Model name (default: `gpt-4o`) | |
| `CARTO_AI_API_TYPE` | No | API type: `chat` or `responses` | **Vercel AI SDK only** — use `chat` for LiteLLM proxies, `responses` for native OpenAI Agents API (default: `chat`) |
| `PORT` | No | Server port (default: `3003`) | |
| `CARTO_MCP_URL` | No | MCP server URL for remote tools | |
| `CARTO_MCP_API_KEY` | No | MCP server API key | |
| `MCP_WHITELIST_CARTO` | No | Comma-separated list of MCP tools to include (all if unset) | |
| `CARTO_LDS_API_BASE_URL` | No | CARTO LDS geocoding endpoint | |
| `CARTO_LDS_API_KEY` | No | CARTO LDS API key | |
| `MCP_MOCK_MODE` | No | Use fixture-backed MCP tools for testing | |

### Setup

Copy the example file and configure your credentials:

```bash
cp .env.example .env
```

Example `.env` configuration:

```bash
# Required: LLM provider (OpenAI-compatible endpoint)
CARTO_AI_API_BASE_URL=https://your-endpoint.example.com/v1
CARTO_AI_API_KEY=your-api-key
CARTO_AI_API_MODEL=gpt-4o

# Optional: server port (default: 3003)
PORT=3003

# Optional: MCP server for additional tools
CARTO_MCP_URL=https://your-mcp-server.com/mcp
CARTO_MCP_API_KEY=your-mcp-api-key
MCP_WHITELIST_CARTO=tool1,tool2

# Optional: CARTO LDS geocoding
CARTO_LDS_API_BASE_URL=https://gcp-us-east1.api.carto.com/v3/lds/geocoding/geocode
CARTO_LDS_API_KEY=your-lds-api-key

# Optional: MCP mock mode for testing
MCP_MOCK_MODE=true
```

---

## Frontend Variables

Frontends use two different configuration approaches depending on the framework.

### Angular

Angular uses a TypeScript environment file: `src/environments/environment.ts`.

**Setup:**

```bash
cp src/environments/environment.example src/environments/environment.ts
```

**Configuration:**

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'https://gcp-us-east1.api.carto.com',
  accessToken: 'YOUR_CARTO_ACCESS_TOKEN',
  connectionName: 'carto_dw',
  wsUrl: 'ws://localhost:3003/ws',
  httpApiUrl: 'http://localhost:3003/api/chat',
  useHttp: false,
};
```

### Vite-Based (React, Vue, Vanilla)

Vite frontends use a `.env` file with `VITE_` prefixed variables.

**Setup:**

```bash
cp .env.example .env
```

**Configuration:**

```bash
VITE_API_BASE_URL=https://gcp-us-east1.api.carto.com
VITE_API_ACCESS_TOKEN=YOUR_CARTO_ACCESS_TOKEN
VITE_CONNECTION_NAME=carto_dw
VITE_WS_URL=ws://localhost:3003/ws
VITE_HTTP_API_URL=http://localhost:3003/api/chat
VITE_USE_HTTP=false
```

### Frontend Variables Reference

| Angular Property | Vite Variable | Description |
|------------------|---------------|-------------|
| `production` | N/A | Enable production optimizations (Angular only) |
| `apiBaseUrl` | `VITE_API_BASE_URL` | CARTO API endpoint URL |
| `accessToken` | `VITE_API_ACCESS_TOKEN` | CARTO API access token |
| `connectionName` | `VITE_CONNECTION_NAME` | Data warehouse connection name (e.g., `carto_dw`) |
| `wsUrl` | `VITE_WS_URL` | Backend WebSocket URL (e.g., `ws://localhost:3003/ws`) |
| `httpApiUrl` | `VITE_HTTP_API_URL` | Backend HTTP URL (fallback for Server-Sent Events) |
| `useHttp` | `VITE_USE_HTTP` | Use HTTP instead of WebSocket (`false` recommended) |

---

## Google ADK Note

> [!NOTE]
> The Google ADK backend requires `npm install --force` due to peer dependency conflicts. See [Getting Started](getting-started.md#google-adk) for details.

---

## See Also

- [Getting Started](getting-started.md) — Full setup instructions for backend and frontend
- [WebSocket Protocol](websocket-protocol.md) — Message format reference
