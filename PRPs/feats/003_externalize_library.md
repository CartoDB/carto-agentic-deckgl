# Feature Request: Externalize Map Tools Library

## FEATURE:

**As a** developer integrating AI-powered map controls into applications,
**I want** a standalone vanilla JavaScript library that encapsulates tool definitions, implementations, and usage prompts,
**So that** I can easily reuse this functionality across multiple projects without duplicating code, and extend it with custom business logic specific to my application needs.

### Core Requirements:

1. **Standalone Library Package**
   - Pure vanilla JavaScript with minimal external dependencies
   - Isomorphic design: works in both browser (frontend) and Node.js (backend) environments
   - Exports tool definitions compatible with OpenAI function calling format
   - Exports tool executors that interact with deck.gl/MapLibre map instances
   - Exports system prompt fragments describing tool usage for AI context

2. **Tool Definition System**
   - Provides default map control tools: `zoom_map`, `fly_to_location`, `toggle_layer`
   - OpenAI function schema definitions for each tool
   - Tool implementation functions that accept map controller instances

3. **Extensibility API**
   - Allow clients to add custom tools with their own schemas and implementations
   - Allow clients to disable/remove predefined tools
   - Allow clients to wrap/extend existing tool implementations with custom business logic
   - Allow clients to extend or modify the system prompt before sending to backend

4. **Configuration Interface**
   - Simple initialization API: `createMapToolsLibrary(config)`
   - Configuration options:
     - `tools`: array of tool definitions to include/exclude
     - `customTools`: array of additional tool definitions
     - `toolInterceptors`: hooks to modify tool execution
     - `promptExtensions`: additional context for system prompts

### Expected Behavior:

- **Frontend Usage**: Import library, initialize with map controller, execute tools received from OpenAI responses
- **Backend Usage**: Import library, access tool definitions to register with OpenAI API, include prompt fragments in system message
- **Custom Extension**: Developers can add domain-specific tools (e.g., `search_property`, `calculate_route`) alongside default map tools
- **Business Logic Injection**: Developers can intercept tool execution to add logging, analytics, validation, or custom behavior

## EXAMPLES:

### Example 1: Basic Frontend Integration
```javascript
import { createMapTools } from '@my-org/map-ai-tools';

const mapTools = createMapTools({
  mapController: myMapController,
  tools: ['zoom_map', 'fly_to_location', 'toggle_layer']
});

// Execute tool calls from OpenAI response
websocket.on('tool_call', (message) => {
  mapTools.execute(message.tool, message.parameters);
});
```

### Example 2: Complete LLM Message Flow to Tool Execution
```javascript
import { createMapTools } from '@my-org/map-ai-tools';
import { MapController } from './map-controller';
import { WebSocketClient } from './websocket-client';
import { ChatUI } from './chat-ui';

// Initialize the map controller
const mapController = new MapController(deckglInstance, mapLibreInstance);

// Initialize the map tools library
const mapTools = createMapTools({
  mapController: mapController,
  tools: ['zoom_map', 'fly_to_location', 'toggle_layer'],

  // Optional: Add hooks for UI feedback
  toolInterceptors: {
    beforeExecute: (toolName, params) => {
      chatUI.addActionMessage(`Executing: ${toolName}...`);
    },
    afterExecute: (toolName, result) => {
      if (result.success) {
        chatUI.addActionMessage(`✓ ${toolName} completed`);
      }
    },
    onError: (toolName, error) => {
      chatUI.addErrorMessage(`✗ ${toolName} failed: ${error.message}`);
    }
  }
});

// Setup WebSocket client
const ws = new WebSocketClient('ws://localhost:3000');
const chatUI = new ChatUI();

// Handle incoming messages from backend
ws.on('message', async (message) => {
  const data = JSON.parse(message);

  switch(data.type) {
    case 'stream_chunk':
      // Display streaming text from LLM
      chatUI.appendToAssistantMessage(data.content, data.messageId);

      if (data.isComplete) {
        chatUI.finalizeAssistantMessage(data.messageId);
      }
      break;

    case 'tool_call':
      // LLM has requested a tool execution
      // Message structure: { type: 'tool_call', tool: 'zoom_map', parameters: {...}, callId: '...' }

      try {
        // Execute the tool using the library
        const result = await mapTools.execute(data.tool, data.parameters);

        // Optionally send result back to backend for context
        // (if your architecture requires tool results in conversation history)
        if (result.success) {
          ws.send({
            type: 'tool_result',
            callId: data.callId,
            result: result.data
          });
        }

      } catch (error) {
        console.error(`Tool execution failed for ${data.tool}:`, error);

        // Send error back to backend
        ws.send({
          type: 'tool_error',
          callId: data.callId,
          error: error.message
        });
      }
      break;

    case 'error':
      chatUI.addErrorMessage(data.content);
      break;
  }
});

// Example: User sends a message
chatUI.onUserMessage((message) => {
  ws.send({
    type: 'chat_message',
    content: message,
    timestamp: Date.now()
  });
});

// Example WebSocket messages received from backend:

// 1. Streaming text response
// { type: 'stream_chunk', content: 'I'll zoom the map for you', messageId: 'msg-123', isComplete: false }
// { type: 'stream_chunk', content: '.', messageId: 'msg-123', isComplete: true }

// 2. Tool execution request
// {
//   type: 'tool_call',
//   tool: 'zoom_map',
//   parameters: { level: 12 },
//   callId: 'call-abc-123'
// }

// 3. Another tool execution
// {
//   type: 'tool_call',
//   tool: 'fly_to_location',
//   parameters: { longitude: -74.0060, latitude: 40.7128, zoom: 12 },
//   callId: 'call-def-456'
// }
```

**Flow Explanation:**
1. **Backend processes user message** → OpenAI returns streaming response with tool calls
2. **Backend sends `tool_call` messages** → Frontend receives via WebSocket
3. **Frontend calls `mapTools.execute()`** → Library validates parameters and calls appropriate tool executor
4. **Tool executor interacts with MapController** → Map visual state updates (zoom, pan, layer toggle)
5. **Interceptor hooks fire** → UI shows action messages for user feedback
6. **Result returned** → Optionally sent back to backend for conversation context

### Example 3: Backend Tool Registration
```javascript
import { getToolDefinitions, getSystemPrompt } from '@my-org/map-ai-tools';

const tools = getToolDefinitions(['zoom_map', 'fly_to_location']);
const systemPrompt = getSystemPrompt(tools);

const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
  ],
  tools: tools
});
```

### Example 4: Extending with Custom Tools
```javascript
import { createMapTools } from '@my-org/map-ai-tools';

const mapTools = createMapTools({
  mapController: myMapController,
  customTools: [
    {
      name: 'highlight_property',
      definition: {
        name: 'highlight_property',
        description: 'Highlights a specific property on the map',
        parameters: {
          type: 'object',
          properties: {
            propertyId: { type: 'string', description: 'Property ID' }
          },
          required: ['propertyId']
        }
      },
      executor: async (params, mapController) => {
        const property = await fetchProperty(params.propertyId);
        mapController.highlightFeature(property);
      }
    }
  ]
});
```

### Example 5: Intercepting Tool Execution
```javascript
const mapTools = createMapTools({
  mapController: myMapController,
  toolInterceptors: {
    beforeExecute: (toolName, params) => {
      analytics.track('tool_execution', { tool: toolName });
      console.log(`Executing ${toolName}`, params);
    },
    afterExecute: (toolName, result) => {
      console.log(`Completed ${toolName}`, result);
    }
  }
});
```

### Example 6: Extending System Prompt
```javascript
const tools = getToolDefinitions();
const systemPrompt = getSystemPrompt(tools, {
  additionalContext: `
    This application is for real estate viewing. Properties in the following cities:
    - Miami: luxury condos, beach properties
    - New York: commercial buildings, penthouses
  `,
  cityCoordinates: customCityList
});
```

## DOCUMENTATION:

### Relevant Implementation Documentation:
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling) - For tool schema format
- [deck.gl API Reference](https://deck.gl/docs/api-reference/core/deck) - For map controller integration
- [MapLibre GL JS API](https://maplibre.org/maplibre-gl-js/docs/API/) - For base map interactions
- Current implementation references:
  - `backend/src/services/tool-definitions.ts` - Existing tool schemas
  - `frontend/src/commands/tool-executor.js` - Current tool execution logic
  - `frontend/src/map/map-controller.js` - Map manipulation methods

### Documentation to be Created After Implementation:
- **Library API Documentation**: Complete API reference with all configuration options, methods, and types
- **Migration Guide**: Step-by-step guide for migrating existing applications to use the library
- **Integration Examples**: Full working examples for different frameworks (vanilla JS, React, Vue)
- **Custom Tool Development Guide**: Tutorial on creating and registering custom tools
- **Package README**: Installation, quick start, and basic usage
- **TypeScript Type Definitions**: `.d.ts` files for TypeScript projects
- **Backend Integration Guide**: Specific guide for Node.js/Express integration

## OTHER CONSIDERATIONS:

### Architectural Implications:
1. **Breaking Changes**: This refactor will significantly change how tools are defined and executed in the current application. Requires careful migration path.
2. **Dependency Injection**: The library shouldn't directly depend on deck.gl or MapLibre. Tool executors should accept a generic map controller interface that clients implement.
3. **Build System**: Need to configure bundler (Rollup/Webpack) to output both ESM and CommonJS formats for maximum compatibility.

### Technical Requirements:
1. **Isomorphic Design Constraints**:
   - No DOM dependencies in backend-consumable code
   - Conditional exports in package.json for Node vs. browser environments
   - Environment detection for code paths that differ between server/client

2. **Versioning Strategy**:
   - Follow semantic versioning strictly
   - Deprecation warnings before removing features
   - Maintain backwards compatibility for at least one major version

3. **Bundle Size Considerations**:
   - Keep core library minimal (<10KB gzipped)
   - Tree-shakeable exports so clients only bundle tools they use
   - No unnecessary polyfills (target modern browsers/Node.js 16+)

4. **Testing Requirements**:
   - Unit tests for tool definitions and executors
   - Integration tests with mock map controller
   - Test matrix for Node.js and browser environments

### Security Considerations:
- Tool executors should validate parameters to prevent injection attacks
- Sandboxing for custom tool execution to prevent malicious code
- Rate limiting hooks for tool execution to prevent abuse

### Common Pitfalls to Avoid:
1. **Don't tightly couple to OpenAI**: Design tool definitions to be AI-provider agnostic
2. **Don't assume sync execution**: Tool executors should support async operations
3. **Don't ignore error handling**: Every tool execution should have proper error boundaries
4. **Don't forget about TypeScript users**: Provide comprehensive type definitions even if library is JavaScript

### Dependencies to Consider:
- **Minimal core dependencies**: Ideally zero runtime dependencies
- **Peer dependencies**: deck.gl and MapLibre should be peer dependencies, not direct dependencies
- **Dev dependencies**: Bundler, testing framework, TypeScript for type generation

### Alternative Approaches Considered:
1. **Plugin Architecture**: Instead of single library, create a plugin system where each tool is a separate package. Rejected due to increased complexity for simple use cases.
2. **Framework-Specific Libraries**: Create React/Vue specific versions. Rejected in favor of framework-agnostic core with optional framework wrappers later.

### Performance Considerations:
- Lazy loading of tool executors to reduce initial bundle size
- Caching of tool definitions to avoid repeated computation
- Debouncing for rapid tool execution calls

### Deployment Strategy:
- Publish to npm registry as scoped package
- Automated CI/CD for releases
- Changelog generation from conventional commits
- Documentation site hosted on GitHub Pages or similar
