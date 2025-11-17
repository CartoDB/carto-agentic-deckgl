# @map-tools/ai-tools

Isomorphic JavaScript library for AI-powered map controls using OpenAI function calling.

## Installation

```bash
npm install @map-tools/ai-tools
```

## Quick Start

### Backend (Node.js)

```typescript
import { getToolDefinitions, getSystemPrompt } from '@map-tools/ai-tools';

const tools = getToolDefinitions();
const prompt = getSystemPrompt(tools, {
  cityCoordinates: {
    'new york': [-74.006, 40.7128],
    'san francisco': [-122.4194, 37.7749]
  }
});

// Use with OpenAI
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: prompt },
    { role: 'user', content: 'Show me New York' }
  ],
  tools: tools
});
```

### Frontend (Browser)

```javascript
import { createMapTools } from '@map-tools/ai-tools';

const mapTools = createMapTools({
  mapController: myMapController,
  cityCoordinates: {
    'new york': [-74.006, 40.7128]
  }
});

// Execute tools from WebSocket
websocket.on('tool_call', async (message) => {
  const result = await mapTools.execute(message.tool, message.parameters);
  console.log(result);
});
```

## Features

- 🔄 **Isomorphic** - Works in both Node.js and browser environments
- 🎯 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🔌 **Extensible** - Easy to add custom tools and modify behavior
- 🎨 **Tree-shakeable** - Import only what you need for smaller bundles
- 📦 **Zero dependencies** - Minimal runtime footprint

## Built-in Tools

### zoom_map
Control map zoom level with in/out directions and configurable levels.

### fly_to_location
Navigate to specific locations using city names or coordinates.

### toggle_layer
Show or hide map layers dynamically.

## API

### createMapTools(config)

Create a map tools executor instance.

```typescript
const mapTools = createMapTools({
  mapController: IMapController,      // Required: Your map controller instance
  tools?: string[],                   // Optional: Tool names to include (default: all)
  customTools?: CustomToolDefinition[],// Optional: Additional custom tools
  cityCoordinates?: Record<string, [number, number]>, // Optional: City coordinates
  toolInterceptors?: ToolInterceptors, // Optional: Hooks for tool execution
  metadata?: Record<string, any>       // Optional: Additional context
});
```

### getToolDefinitions(toolNames?)

Get OpenAI function calling tool definitions.

```typescript
const tools = getToolDefinitions(['zoom_map', 'fly_to_location']);
```

### getSystemPrompt(tools, config?)

Build system prompt with tool descriptions and city coordinates.

```typescript
const prompt = getSystemPrompt(tools, {
  cityCoordinates: { 'new york': [-74.006, 40.7128] },
  additionalContext: 'Custom instructions...',
  customInstructions: 'Additional guidance...'
});
```

## Advanced Usage

### Custom Tools

```typescript
const mapTools = createMapTools({
  mapController,
  customTools: [{
    name: 'highlight_property',
    definition: {
      type: 'function',
      function: {
        name: 'highlight_property',
        description: 'Highlight a property on the map',
        parameters: {
          type: 'object',
          properties: {
            propertyId: { type: 'string' }
          },
          required: ['propertyId']
        }
      }
    },
    executor: async (params, context) => {
      // Custom logic here
      return { success: true, message: 'Property highlighted' };
    }
  }]
});
```

### Tool Interceptors

```typescript
const mapTools = createMapTools({
  mapController,
  toolInterceptors: {
    beforeExecute: (toolName, params) => {
      console.log(`Executing ${toolName}`, params);
    },
    afterExecute: (toolName, result) => {
      console.log(`Completed ${toolName}`, result);
    },
    onError: (toolName, error) => {
      console.error(`Error in ${toolName}`, error);
    }
  }
});
```

## License

MIT
