# @carto/maps-ai-tools

> A framework-agnostic JavaScript library for AI-powered map controls using OpenAI function calling with deck.gl and MapLibre GL.

**Note:** This is a proof-of-concept and first approach for `@carto/maps-ai-tools`. The API and features are subject to change as we iterate on the design.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Available Tools](#available-tools)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

* **Framework Agnostic**: Works with React, Vue, Angular, or Vanilla JavaScript
* **9 Built-in AI Tools**: Comprehensive map control capabilities out of the box
* **OpenAI Function Calling**: Seamless integration with streaming responses
* **Type-Safe Validation**: Zod-based schemas with automatic JSON Schema generation
* **Isomorphic Design**: Works on both frontend and backend
* **Real-Time Communication**: WebSocket-based chat with streaming AI responses
* **deck.gl + MapLibre**: Powerful WebGL visualization with vector tile basemaps

## Project Structure

```
ps-frontend-tools-poc/
├── map-ai-tools/              # Core library (@carto/maps-ai-tools v2.0.0)
│   ├── src/
│   │   ├── core/              # Types, registry, executor factory
│   │   ├── definitions/       # Zod-based tool schemas
│   │   ├── executors/         # Tool execution implementations
│   │   └── prompts/           # System prompt generation
│   └── dist/                  # Built ESM + CJS outputs
├── backend/                   # Node.js + TypeScript backend
│   └── src/
│       ├── services/          # OpenAI, conversation, message handling
│       └── websocket/         # WebSocket server
└── integration-examples/      # Framework integration examples
    ├── frontend/              # Vanilla JS + Vite
    ├── frontend-react/        # React 19 + Vite
    ├── frontend-vue/          # Vue 3 + Vite + TypeScript
    └── frontend-angular/      # Angular 20
```

## Getting Started

### Prerequisites

* Node.js v18+
* npm or pnpm
* OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/CartoDB/ps-frontend-tools-poc.git
   cd ps-frontend-tools-poc
   ```

2. Build the core library:
   ```bash
   cd map-ai-tools
   npm install
   npm run build
   ```

3. Set up the backend:
   ```bash
   cd ../backend
   npm install
   cp .env.example .env
   ```

4. Configure your OpenAI API key in `backend/.env`:
   ```env
   OPENAI_API_KEY=sk-proj-your-api-key-here
   OPENAI_MODEL=gpt-4o          # Optional, defaults to gpt-4o
   PORT=3000                    # Optional, defaults to 3000
   ```

5. Choose and install an example frontend:
   ```bash
   cd ../integration-examples/frontend-react
   npm install
   ```

### Running the Application

1. **Start the backend** (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```
   Backend runs on http://localhost:3000

2. **Start a frontend example** (Terminal 2):
   ```bash
   cd integration-examples/frontend-react
   npm run dev
   ```
   Frontend runs on http://localhost:5174

3. Open your browser and start chatting with the map!

## Usage

### Natural Language Commands

The AI understands conversational commands for map control:

**Navigation**
- "fly to San Francisco"
- "go to Miami and zoom in"
- "take me to New York"

**Zoom Control**
- "zoom in"
- "zoom out 3 levels"
- "zoom out to world view"

**Layer Control**
- "hide the points"
- "show the airports layer"
- "toggle the cities"

**Styling**
- "color by country, divergent palette"
- "color by country, grey palette"
- "update size points by airport type"

**Data Queries**
- "how many airports are in the US?"
- "show only international airports"
- "Give me a comprensive list of airport attributes"

### Programmatic Usage

```javascript
import {
  TOOL_NAMES,
  parseToolResponse,
  getAllToolDefinitions
} from '@carto/maps-ai-tools';

// Get tool definitions for OpenAI
const tools = getAllToolDefinitions();

// Execute tools based on AI responses
const executors = {
  [TOOL_NAMES.FLY_TO]: (params) => {
    deck.setProps({
      initialViewState: {
        latitude: params.lat,
        longitude: params.lng,
        zoom: params.zoom || 12,
        transitionDuration: 1000
      }
    });
  },
  [TOOL_NAMES.ZOOM_MAP]: (params) => {
    // Handle zoom in/out
  }
};
```

## Available Tools

| Tool | Description |
|------|-------------|
| `fly-to` | Navigate to coordinates with smooth animation |
| `zoom-map` | Zoom in or out by specified levels |
| `toggle-layer` | Show or hide map layers by name |
| `set-point-color` | Set uniform color for all points (RGBA) |
| `color-features-by-property` | Color features conditionally based on property values |
| `query-features` | Count or query features matching criteria |
| `filter-features-by-property` | Display only features matching criteria |
| `size-features-by-property` | Size features dynamically based on property values |
| `aggregate-features` | Group and count features by property |

## Tech Stack

### Core Library
- **TypeScript** - Type-safe development
- **Zod** - Schema validation with JSON Schema generation
- **deck.gl** - WebGL-powered visualization
- **Rollup** - ESM and CommonJS builds

### Backend
- **Node.js** - Runtime environment
- **Express** - Web server
- **ws** - WebSocket library
- **OpenAI API** - AI with function calling

### Frontend Examples
- **Vite** - Fast build tool
- **deck.gl** - Map rendering
- **MapLibre GL** - Vector tile basemaps
- **React/Vue/Angular** - Framework options

## Architecture

### Communication Flow

```
User Message → Frontend WebSocket → Backend
                                      ↓
                         OpenAI API (streaming + function calling)
                                      ↓
Backend streams back: text chunks + tool_call messages
                                      ↓
Frontend: Display text + Execute tool_calls via Executors
                                      ↓
                         deck.gl updates map view
```

### Library Design

The library follows a modular architecture:

- **Tool Definitions**: Zod schemas define tool parameters and generate OpenAI function schemas
- **Executors**: Pure functions that receive validated params and execution context (deck, map)
- **Registry**: Central registration for built-in and custom tools
- **Prompts**: System prompt generation for LLM integration

## Troubleshooting

### Backend Issues
- **Port in use**: Check if port 3000 is available
- **API errors**: Verify `OPENAI_API_KEY` in `.env`
- **TypeScript errors**: Run `npx tsc --noEmit`

### Frontend Issues
- **WebSocket errors**: Ensure backend is running on port 3000
- **Map not rendering**: Check WebGL2 support in browser
- **Points not visible**: Wait for MapLibre `load` event, check console for errors

### Common Gotchas
- Coordinates use GeoJSON order: `[longitude, latitude]`
- deck.gl requires explicit `redraw(true)` calls for visibility
- Use `initialViewState` with `transitionDuration` for animations

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on:
- Development setup
- Code style guidelines
- Pull request process
- Adding new tools

## License

MIT
