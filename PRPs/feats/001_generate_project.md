# Interactive Map with Chat-Based Control System

## FEATURE:

As a **web application user**, I want to **visualize geospatial data on an interactive map and control it through natural language chat commands** so that **I can intuitively explore and manipulate map visualizations without needing to learn complex UI controls**.

### Core Requirements:

**Frontend Application (Pure JavaScript/HTML):**
- Implement a deck.gl-based map visualization displaying a layer of point data
- Use CARTO basemaps (BASEMAP.VOYAGER or similar) from @deck.gl/carto for the base map layer
- Create a chat interface component for user input and message display
- Display a GeoJSON layer containing sample point data across the United States
- Enable real-time map state manipulation based on chat commands
- Support the following map operations via chat:
  - Zoom in/out to different levels
  - Fly to specific coordinates with smooth transitions
  - Toggle visibility of the points layer (show/hide)
- Build using vanilla JavaScript (no frameworks) with npm for dependency management

**Backend Application (Node.js with TypeScript):**
- Develop a Node.js server using TypeScript
- Integrate with OpenAI Response API for natural language processing
- Initial implementation: Echo functionality (mirror user messages back to chat)
- Future iterations: Parse chat messages and generate appropriate map control commands
- Handle WebSocket or HTTP connections for real-time chat communication
- Build using npm with TypeScript compilation

**Data Requirements:**
- Include a GeoJSON file with random point locations across the United States
- Points should have valid coordinates and basic properties (name, id, etc.)
- File should be served statically from the project directory

**Expected Behavior:**
1. User opens the web application and sees the deck.gl map with points layer visible
2. User types commands in the chat interface (e.g., "zoom in", "show me San Francisco", "hide the points")
3. Backend processes the message and returns a response
4. Frontend interprets the response and updates the map state accordingly
5. Chat displays the conversation history with both user messages and system responses

## EXAMPLES:

### Example User Interactions:

**Scenario 1: Zoom Control**
- User types: "Zoom in"
- Backend echoes: "Zoom in"
- Frontend increases map zoom level by 2 levels with animation
- User types: "Zoom out twice"
- Frontend decreases zoom level by 2 levels

**Scenario 2: Navigation**
- User types: "Fly to New York City"
- Backend echoes: "Fly to New York City"
- Frontend animates the map viewport to coordinates [40.7128, -74.0060] with zoom level 10
- User types: "Show me coordinates 34.0522, -118.2437"
- Frontend flies to Los Angeles coordinates

**Scenario 3: Layer Visibility**
- User types: "Hide the points"
- Backend echoes: "Hide the points"
- Frontend sets points layer visibility to false
- User types: "Show points again"
- Frontend sets points layer visibility to true

### Example GeoJSON Structure:
The data file should contain features like:
```
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-74.0060, 40.7128] },
      "properties": { "name": "New York", "id": 1 }
    },
    ...
  ]
}
```

### Example Chat Flow:
```
User: "Hello"
Bot: "Hello" (echo)

User: "Zoom to level 8"
Bot: "Zoom to level 8" (echo)
[Map zooms to level 8]

User: "Hide points"
Bot: "Hide points" (echo)
[Points layer becomes invisible]
```

## DOCUMENTATION:

### Required Implementation Documentation:

**deck.gl Documentation:**
- [deck.gl Official Documentation](https://deck.gl/docs)
- [GeoJsonLayer API Reference](https://deck.gl/docs/api-reference/layers/geojson-layer)
- [Deck Class - View State Control](https://deck.gl/docs/api-reference/core/deck)

**CARTO Platform:**
- [Build a Public Application with CARTO](https://docs.carto.com/carto-for-developers/guides/build-a-public-application)
- [CARTO for deck.gl Module](https://deck.gl/docs/api-reference/carto/overview)
- [CARTO Basemaps Documentation](https://docs.carto.com/carto-for-developers/carto-for-deck-gl/basemaps)

**OpenAI API:**
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Chat Completions API](https://platform.openai.com/docs/guides/chat-completions)

**WebSocket/Real-time Communication:**
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Socket.io Documentation](https://socket.io/docs/) (if using Socket.io for real-time communication)

**GeoJSON Specification:**
- [GeoJSON Format Specification (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946)

### Documentation to be Created:

After feature implementation, the following documentation should be created:
- **API Endpoint Documentation**: Document WebSocket events or HTTP endpoints for chat communication
- **Map Command Protocol**: Specification for command structure between backend and frontend
- **User Guide**: How to use chat commands to control the map
- **Development Setup Guide**: Instructions for running both frontend and backend locally
- **Deployment Guide**: Instructions for deploying the full stack application
- **Architecture Decision Record (ADR)**: Document the choice of vanilla JavaScript vs frameworks, CARTO vs other basemap providers, communication protocol design

## OTHER CONSIDERATIONS:

### Technical Architecture:

**Communication Protocol:**
- Decision needed: WebSocket for real-time bidirectional communication vs HTTP polling
- Recommendation: WebSocket for better user experience with instant message delivery
- Message format should be standardized (JSON with type, payload, timestamp)

**State Management:**
- Frontend must maintain map state (current zoom, center coordinates, layer visibility)
- Consider implementing a simple state machine to handle map transitions
- Prevent conflicting commands (e.g., multiple simultaneous fly-to operations)

**Command Parsing Strategy:**
- Phase 1: Echo messages (current requirement)
- Phase 2: Backend parses messages and returns structured commands
- Phase 3: OpenAI integration for natural language understanding
- Consider defining a command schema that backend returns (e.g., `{action: 'zoom', params: {level: 10}}`)

### Performance Considerations:

- **Large GeoJSON Files**: If point count grows, consider using data filtering or clustering techniques
- **Map Animations**: Smooth transitions are important but can be performance-intensive on low-end devices
- **WebSocket Connection**: Implement reconnection logic for network interruptions
- **Rate Limiting**: Prevent spam by implementing command throttling/debouncing

### Security Considerations:

- **OpenAI API Key**: Must be stored securely on backend, never exposed to frontend
- **Input Sanitization**: Validate and sanitize all chat inputs before processing
- **Command Validation**: Ensure coordinates are within valid ranges before executing fly-to commands
- **CORS Configuration**: Properly configure CORS if frontend and backend are on different origins
- **Rate Limiting**: Implement rate limits on API endpoints to prevent abuse

### Common Pitfalls AI Assistants Miss:

1. **Coordinate Order**: GeoJSON uses [longitude, latitude] order, not [latitude, longitude]
2. **deck.gl View State**: Must properly handle view state updates with smooth transitions
3. **Pure JavaScript Requirement**: No React, Vue, or other frameworks - must use vanilla JavaScript
4. **Module System**: When using pure JavaScript with npm packages, need to handle bundling (Webpack/Rollup/Vite)
5. **CARTO Basemap Integration**:
   - Must synchronize maplibre-gl Map instance with deck.gl Deck instance
   - Use BASEMAP constants (e.g., BASEMAP.VOYAGER) from @deck.gl/carto, not hardcoded style URLs
6. **Async Command Handling**: Map animations take time; handle multiple commands queued in quick succession
7. **Error Handling**: Invalid coordinates or malformed commands should provide user-friendly feedback
8. **Initial Map State**: Define sensible defaults for initial map position (e.g., centered on US)

### Dependencies and Build Tools:

**Frontend:**
- deck.gl (core and layers packages)
- @deck.gl/carto (for CARTO basemaps and integration)
- maplibre-gl (MapLibre GL JS for rendering CARTO basemaps - lighter alternative to Mapbox GL)
- Bundler: Webpack, Rollup, or Vite for building pure JavaScript with npm dependencies

**Backend:**
- TypeScript and ts-node or tsc for compilation
- Express.js for HTTP server
- ws or Socket.io for WebSocket functionality
- OpenAI Node.js SDK
- dotenv for environment variable management

### Browser Compatibility:

- Ensure WebGL support for deck.gl (may need fallback message for older browsers)
- Test WebSocket connection handling across browsers
- Consider polyfills for older browsers if supporting IE11 or older

### Future Enhancement Considerations:

- Multi-layer support (not just points)
- Multiple GeoJSON sources
- Advanced NLP commands ("Show me all points within 50 miles of Chicago")
- User authentication and session management
- Command history and replay
- Export/screenshot functionality
- Mobile responsiveness for touch interactions
