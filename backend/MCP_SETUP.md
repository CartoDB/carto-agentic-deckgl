# Multiple MCP Servers Setup Guide

This backend supports connecting to multiple MCP (Model Context Protocol) servers simultaneously. All MCP tools will be available to OpenAI through the `/api/openai-chat` endpoint.

## Configuration

### Option 1: Multiple MCP Servers (Recommended)

Add the `MCP_SERVERS` environment variable to your `.env` file:

```bash
MCP_SERVERS=name1:url1:apikey1,name2:url2:apikey2,name3:url3:apikey3
```

**Format breakdown:**
- Each server is separated by a comma (`,`)
- Each server config has three parts separated by colons (`:`)
  1. **name** - A unique identifier for the server (e.g., "carto", "weather", "analytics")
  2. **url** - The MCP server endpoint URL
  3. **apikey** - The API key/token for authentication (optional)

**Example with multiple CARTO servers:**

```bash
MCP_SERVERS=carto_maps:https://gcp-us-east1.api.carto.com/mcp/ac_7xhfwyml:your_api_key,carto_analytics:https://gcp-us-east1.api.carto.com/mcp/ac_analytics:your_other_key
```

**Example with mixed servers:**

```bash
MCP_SERVERS=carto:https://gcp-us-east1.api.carto.com/mcp/ac_7xhfwyml:carto_key,weather:https://weather-mcp.example.com:weather_key,custom:https://my-mcp-server.com:custom_key
```

### Option 2: Single MCP Server (Legacy)

For backwards compatibility, you can still use individual environment variables:

```bash
CARTO_MCP_URL=https://gcp-us-east1.api.carto.com/mcp/ac_7xhfwyml
CARTO_MCP_API_KEY=your_carto_mcp_api_key_here
```

This will automatically create a server named "carto".

**Note:** If `MCP_SERVERS` is set, the legacy variables are ignored.

## How It Works

### Server Initialization

1. When the backend starts, it parses the `MCP_SERVERS` environment variable
2. For each configured server:
   - Creates an HTTP connection to the MCP server
   - Fetches available tools from that server
   - Registers all tools with a unique prefix

### Tool Naming

Tools from MCP servers are automatically prefixed with the server name to avoid conflicts:

```
Original tool: get_weather
After registration: carto_get_weather

Original tool: analyze_data
After registration: analytics_analyze_data
```

This ensures that if multiple MCP servers provide tools with the same name, they won't conflict.

### Example Logs

When starting the server with multiple MCP servers configured:

```
[Custom Tools] Initializing MCP tools...
[Custom Tools] Found 3 MCP server(s) to initialize
[Custom Tools] Connecting to MCP server: carto (https://gcp-us-east1.api.carto.com/mcp/ac_7xhfwyml)
[MCP] Connecting to MCP server: https://gcp-us-east1.api.carto.com/mcp/ac_7xhfwyml
[MCP] Connected successfully
[MCP] Found tools: 5
[MCP] - get_layers: Retrieve map layers
[MCP] - update_viewport: Update map viewport
...
[Custom Tools] Added MCP tool: carto_get_layers
[Custom Tools] Added MCP tool: carto_update_viewport
[Custom Tools] Initialized 5 tools from carto
[Custom Tools] Connecting to MCP server: weather (https://weather-mcp.example.com)
...
[Custom Tools] Initialized 15 MCP tools from 3 server(s)
```

## Usage in OpenAI Chat

Once configured, all MCP tools are automatically available to the AI model:

```bash
curl -X POST http://localhost:3000/api/openai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Use the carto tools to show me all available layers",
    "sessionId": "test-session"
  }'
```

The AI will see all tools with their descriptions prefixed with the server name:

- `carto_get_layers` - [carto] Retrieve map layers
- `carto_update_viewport` - [carto] Update map viewport
- `weather_get_forecast` - [weather] Get weather forecast
- etc.

## Error Handling

- If one MCP server fails to connect, the others will still be initialized
- Failed servers are logged but don't prevent the application from starting
- The app will continue to work with whatever MCP servers successfully connected

## Security Notes

1. **API Keys**: Never commit your `.env` file with real API keys
2. **Network**: Ensure your backend can reach all configured MCP server URLs
3. **Authentication**: Each MCP server may have different authentication requirements

## Troubleshooting

### No tools are loading

Check the backend logs for:
```
[Custom Tools] No MCP servers configured
```

**Solution:** Add `MCP_SERVERS` to your `.env` file

### Connection errors

Check the backend logs for:
```
[Custom Tools] Failed to initialize MCP server <name>: <error>
```

**Solutions:**
- Verify the MCP server URL is correct and reachable
- Check if the API key is valid
- Ensure the MCP server is running and accepting connections

### Tools not appearing in OpenAI

1. Restart the backend server to re-initialize MCP connections
2. Check that the OpenAI Responses service initialization logs show the correct tool count
3. Verify the tools are registered in the logs:
   ```
   [OpenAI Responses] Total tools: X
   [OpenAI Responses] Custom tools: Y
   ```

## Advanced Configuration

### Server-Specific Settings

If you need different configurations per server (like different headers or timeout settings), you can extend the `MCPServerConfig` interface in `src/services/mcp-client.ts` to include additional options.

### Custom Transport

The current implementation uses HTTP transport. If you need SSE (Server-Sent Events) or WebSocket transport, you can modify the `createHTTPTransport` method in `src/services/mcp-client.ts`.
