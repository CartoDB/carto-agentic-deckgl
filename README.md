# Interactive Map with AI-Powered Chat Control

A full-stack web application featuring a deck.gl map visualization with AI-powered natural language control via WebSocket communication and OpenAI integration.

## 🎯 Features

- **Interactive Map**: deck.gl-powered map with CARTO Voyager basemap and MapLibre GL
- **GeoJSON Visualization**: Display of 20 major US cities with accurate coordinates
- **Real-Time Chat**: WebSocket-based chat interface with streaming responses
- **AI-Powered Natural Language Commands**: Control the map through conversational chat
  - OpenAI function calling for intelligent command interpretation
  - Contextual conversation memory across multiple messages
  - Zoom in/out with natural language ("zoom in a bit", "zoom out 3 levels")
  - Fly to cities by name ("go to San Francisco", "show me Miami")
  - Toggle layer visibility ("hide the points", "show cities")

## 📁 Project Structure

```
frontend-tools/
├── frontend/                 # Vite vanilla JS frontend
│   ├── public/
│   │   └── data/
│   │       └── us-points.geojson    # 20 major US cities
│   ├── src/
│   │   ├── main.js                  # App entry point
│   │   ├── chat/
│   │   │   ├── chat-ui.js           # Chat interface with streaming support
│   │   │   └── websocket-client.js  # WebSocket client with auto-reconnect
│   │   ├── map/
│   │   │   ├── deckgl-map.js        # deck.gl + MapLibre setup
│   │   │   └── map-controller.js    # Map manipulation API
│   │   ├── commands/
│   │   │   └── tool-executor.js     # Executes OpenAI function calls
│   │   └── styles/
│   │       └── main.css
│   └── index.html
│
└── backend/                  # Node.js TypeScript backend
    ├── .env.example          # Environment variables template
    ├── src/
    │   ├── index.ts
    │   ├── server.ts
    │   ├── types/
    │   │   └── messages.ts
    │   ├── websocket/
    │   │   └── websocket-server.ts
    │   └── services/
    │       ├── openai-service.ts           # OpenAI streaming integration
    │       ├── conversation-manager.ts     # Per-session conversation history
    │       ├── message-handler.ts          # Message orchestration
    │       └── tool-definitions.ts         # OpenAI function schemas
    └── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- npm
- OpenAI API key (get one at https://platform.openai.com/api-keys)

### Installation & Configuration

1. **Install Backend Dependencies**:
```bash
cd backend
npm install
```

2. **Configure Environment Variables**:
```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-proj-your-actual-api-key-here
OPENAI_MODEL=gpt-4o          # Optional: Defaults to gpt-4o
PORT=3000                    # Optional: Defaults to 3000
```

3. **Install Frontend Dependencies**:
```bash
cd ../frontend
npm install
```

### Running the Application

1. **Start Backend Server** (Terminal 1):
```bash
cd backend
npm run dev
```

The backend will start on http://localhost:3000
- Health check: http://localhost:3000/health
- WebSocket endpoint: ws://localhost:3000/ws

2. **Start Frontend Dev Server** (Terminal 2):
```bash
cd frontend
npm run dev
```

The frontend will typically start on http://localhost:5173

3. **Open Browser**:
Navigate to http://localhost:5173 (or the URL shown in your terminal)

## 💬 Natural Language Examples

The application uses OpenAI to understand natural language commands. You can chat conversationally!

### Zoom Commands
- "zoom in"
- "zoom in a bit"
- "zoom out 3 levels"
- "can you zoom in more?"

### Navigation Commands
- "fly to San Francisco"
- "go to Miami"
- "show me New York and zoom in"
- "take me to Los Angeles"

**Available Cities**:
- New York, Los Angeles, Chicago, San Francisco
- Seattle, Miami, Boston, Denver
- Plus more cities in the GeoJSON dataset

### Layer Commands
- "hide the points"
- "show the cities"
- "toggle the points layer"

### Conversational Flow
The AI remembers context within the session:
```
You: "go to San Francisco"
AI: [flies to San Francisco]

You: "now go to Miami"
AI: [understands context and flies to Miami]
```

## 🔧 Development

### Backend

**TypeScript Type Checking**:
```bash
cd backend
npx tsc --noEmit
```

**Build for Production**:
```bash
npm run build
```

**Start Production Server**:
```bash
npm start
```

### Frontend

**Build for Production**:
```bash
cd frontend
npm run build
```

**Preview Production Build**:
```bash
npm run preview
```

## 📚 Tech Stack

### Frontend
- **Vite** - Build tool and dev server
- **deck.gl** - WebGL-powered map visualization
- **@deck.gl/carto** - CARTO basemap integration
- **MapLibre GL JS** - Base map rendering
- **Vanilla JavaScript** - No frameworks

### Backend
- **Node.js** - Runtime environment
- **TypeScript** - Type-safe development
- **Express** - Web server framework
- **ws** - WebSocket library
- **OpenAI API** - Natural language processing with function calling
- **CORS** - Cross-origin resource sharing

## 🔍 Architecture

### Communication Flow

```
Browser                WebSocket               Backend              OpenAI API
  │                       │                      │                     │
  ├──── User Message ────>│                      │                     │
  │                       ├──── Forward ────────>│                     │
  │                       │                      ├─── Streaming ──────>│
  │                       │                      │    Chat Request     │
  │                       │                      │                     │
  │                       │                      │<─── Text Chunks ────┤
  │<──── Text Chunk ──────┤<──── Stream ─────────┤    + Tool Calls     │
  │                       │                      │                     │
  │<──── Tool Call ───────┤<──── Tool Call ──────┤                     │
  │                       │                      │                     │
  └─ Execute Tool         │                      │                     │
     (MapController)      │                      │                     │
```

### Map Update Flow with AI

```
User types "go to San Francisco and zoom in"
     │
     ├─> Chat UI sends to WebSocket
     │
     └─> Backend → OpenAI API
         │
         ├─> OpenAI Function Calling determines:
         │   - fly_to_location(location: "San Francisco")
         │   - zoom_map(direction: "in", levels: 1)
         │
         └─> Backend streams back:
             ├─> Text chunks (assistant's response)
             └─> Tool call messages
                 │
                 └─> Frontend ToolExecutor
                     ├─> MapController.flyTo()
                     └─> MapController.zoomIn()
                         │
                         └─> deck.gl updates view (with forced redraws)
                             │
                             └─> MapLibre syncs basemap
```

## 📝 Implementation Notes

### Critical Gotchas Handled

1. **Coordinate Order**: GeoJSON uses [longitude, latitude] order (not lat, lon)
2. **MapLibre Synchronization**: deck.gl view state properly synced with MapLibre via `onViewStateChange`
3. **WebSocket Reconnection**: Automatic reconnection with exponential backoff
4. **CARTO Basemaps**: Using BASEMAP.VOYAGER constant (no API tokens required)
5. **deck.gl Rendering**: Points layer visibility requires:
   - Waiting for MapLibre `load` event
   - Explicit `visible: true` and `opacity: 1` properties
   - Multiple `deck.redraw(true)` calls with scheduled timeouts
6. **View State Updates**: Must use `initialViewState` with `transitionDuration` (not `viewState` prop) to trigger animations
7. **OpenAI Conversation Context**: Assistant responses must be added to conversation history without `tool_calls` property (OpenAI requires tool response messages after tool_calls, which we don't send)

### Current Implementation

- ✅ OpenAI streaming integration with function calling
- ✅ Natural language command processing
- ✅ Conversation context memory across messages
- ✅ Real-time map control with smooth animations
- ✅ Client-side tool execution
- ✅ Proper rendering and view state management

### Future Enhancements

- 🔄 Multi-user support with shared sessions
- 🔄 Command history and undo functionality
- 🔄 Additional map layers and data sources
- 🔄 Voice input support
- 🔄 Saved favorite locations

## 🐛 Troubleshooting

### Backend won't start
- Ensure no other process is using port 3000
- Check that all dependencies are installed: `npm install`
- Verify `.env` file exists with valid `OPENAI_API_KEY`
- Verify TypeScript compiles: `npx tsc --noEmit`

### OpenAI API errors
- Verify API key is valid and has credits
- Check OpenAI status page: https://status.openai.com/
- Ensure `OPENAI_MODEL` in `.env` is a valid model (default: gpt-4o)
- Check backend console for detailed error messages

### Chat not responding
- Verify backend is running and connected to OpenAI
- Check browser console for WebSocket errors
- Ensure backend logs show "OpenAI Starting streamChatCompletion"
- Verify conversation history isn't causing context length errors

### Frontend won't connect to backend
- Verify backend is running on port 3000
- Check browser console for WebSocket errors
- Ensure CORS is enabled in backend
- Check network tab for WebSocket connection status

### Map doesn't render
- Check browser console for errors
- Verify browser supports WebGL2
- Ensure GeoJSON file exists at `/public/data/us-points.geojson`
- Wait a few seconds after page load for MapLibre to initialize

### Points not appearing on initial load
- Refresh the page - points should appear after MapLibre loads
- Check browser console for "Points layer loaded with 20 points" message
- Verify GeoJSON coordinates are [lon, lat] format
- Check Network tab to ensure us-points.geojson loads successfully

### Map doesn't update when AI executes commands
- Check that tool execution messages appear in chat (green checkmarks)
- Verify browser console shows tool execution logs
- Try manually zooming/panning to trigger a redraw
- Check that deck.gl and MapLibre are properly initialized

## 📄 License

ISC

## 🤝 Contributing

This is a demo project created for learning purposes.

---

**Built with ❤️ using deck.gl, CARTO, OpenAI, and WebSocket**
