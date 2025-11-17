# Feature Request: Multi-Framework Demo Implementations

## FEATURE:

As a **frontend developer, workshop participant, or technical evaluator**, I want to **have multiple framework implementations (React, Vue, Angular) of the AI-powered map chat application** so that **I can compare different frontend architectures, choose my preferred technology stack, learn framework-specific patterns, or use the implementations as educational references for integrating deck.gl and AI chat in various frameworks**.

**Core Requirements:**

1. **Create Three New Project Directories:**
   - `frontend-react/` - React 18+ with Vite
   - `frontend-vue/` - Vue 3 with Vite
   - `frontend-angular/` - Angular 17+ with Angular CLI

2. **Feature Parity with Existing Vanilla JS Application:**
   Each implementation must replicate all functionality from the current `frontend/` folder:
   - Interactive deck.gl map with MapLibre GL basemap (CARTO Voyager style)
   - Display airports.geojson data (309KB) as pink circle markers
   - Real-time AI chat interface with streaming message support
   - WebSocket connection to backend at `ws://localhost:3000/ws`
   - Integration with `@map-tools/ai-tools` library for map tool execution
   - Tool execution feedback with action messages in chat UI
   - Connection status indicator
   - Proper view state synchronization between deck.gl and MapLibre
   - Hover interactions on airport points

3. **Framework-Specific Best Practices:**
   - **React**: Functional components with hooks, proper state management, React Context or props drilling for shared state
   - **Vue**: Composition API with `<script setup>`, reactive refs, composables for reusable logic, single-file components
   - **Angular**: TypeScript components, services for WebSocket and map logic, RxJS observables for async streams, dependency injection

4. **Shared Dependencies:**
   - All implementations must use the same backend without modifications
   - All implementations must use the same `@map-tools/ai-tools` library (installed via `npm install ../map-ai-tools`)
   - All implementations must load the same `airports.geojson` data file

5. **Independent Development Servers:**
   - Each implementation should run on a different port (5173, 5174, 5175, etc.)
   - All should be runnable simultaneously for side-by-side comparison

## EXAMPLES:

### Example 1: React Implementation Structure
```
frontend-react/
├── src/
│   ├── components/
│   │   ├── MapView.jsx           # deck.gl + MapLibre integration
│   │   ├── ChatUI.jsx            # Chat interface with message list
│   │   ├── ChatMessage.jsx       # Individual message component
│   │   └── ConnectionStatus.jsx  # WebSocket status indicator
│   ├── hooks/
│   │   ├── useWebSocket.js       # WebSocket connection management
│   │   ├── useMapTools.js        # Map tools executor hook
│   │   └── useMapInstance.js     # deck.gl initialization hook
│   ├── styles/
│   │   └── main.css              # Global styles (copied from vanilla)
│   ├── App.jsx                   # Root component
│   └── main.jsx                  # Entry point
├── public/
│   └── data/
│       └── airports.geojson
├── index.html
├── package.json
└── vite.config.js
```

### Example 2: Vue Implementation Structure
```
frontend-vue/
├── src/
│   ├── components/
│   │   ├── MapView.vue           # deck.gl + MapLibre integration
│   │   ├── ChatUI.vue            # Chat interface component
│   │   ├── ChatMessage.vue       # Individual message component
│   │   └── ConnectionStatus.vue  # WebSocket status indicator
│   ├── composables/
│   │   ├── useWebSocket.js       # WebSocket connection composable
│   │   ├── useMapTools.js        # Map tools executor composable
│   │   └── useDeckMap.js         # deck.gl initialization composable
│   ├── styles/
│   │   └── main.css              # Global styles
│   ├── App.vue                   # Root component
│   └── main.js                   # Entry point
├── public/
│   └── data/
│       └── airports.geojson
├── index.html
├── package.json
└── vite.config.js
```

### Example 3: Angular Implementation Structure
```
frontend-angular/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── map-view/
│   │   │   │   ├── map-view.component.ts
│   │   │   │   ├── map-view.component.html
│   │   │   │   └── map-view.component.css
│   │   │   ├── chat-ui/
│   │   │   │   ├── chat-ui.component.ts
│   │   │   │   ├── chat-ui.component.html
│   │   │   │   └── chat-ui.component.css
│   │   │   └── connection-status/
│   │   ├── services/
│   │   │   ├── websocket.service.ts      # WebSocket connection service
│   │   │   ├── map-tools.service.ts      # Map tools executor service
│   │   │   └── deck-map.service.ts       # deck.gl management
│   │   ├── models/
│   │   │   └── message.model.ts          # TypeScript interfaces
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   └── app.config.ts
│   ├── assets/
│   │   ├── data/
│   │   │   └── airports.geojson
│   │   └── styles/
│   │       └── main.css
│   └── main.ts
├── package.json
├── tsconfig.json
└── angular.json
```

### Example 4: Usage Scenario
**Developer starts all implementations simultaneously:**

```bash
# Terminal 1: Start backend once
cd backend && npm run dev
# → Backend running on http://localhost:3000

# Terminal 2: Start React version
cd frontend-react && npm run dev
# → React app running on http://localhost:5174

# Terminal 3: Start Vue version
cd frontend-vue && npm run dev
# → Vue app running on http://localhost:5175

# Terminal 4: Start Angular version
cd frontend-angular && npm run dev
# → Angular app running on http://localhost:5176
```

All three frontends connect to the same backend and execute identical AI map commands:
- User types: "Fly to San Francisco and zoom in"
- All three UIs stream the same OpenAI response
- All three maps execute the same `fly_to_location` and `zoom_map` tools
- Developer can compare React, Vue, and Angular implementations side-by-side

### Example 5: Framework-Specific Component Patterns

**React - Map Tool Integration:**
```jsx
// useMapTools.js hook
const useMapTools = (deck) => {
  const [mapTools, setMapTools] = useState(null);

  useEffect(() => {
    if (deck) {
      const tools = createMapTools({ deck });
      setMapTools(tools);
    }
  }, [deck]);

  return mapTools;
};
```

**Vue - Map Tool Integration:**
```vue
<!-- MapView.vue composable -->
<script setup>
import { ref, onMounted } from 'vue';
import { createMapTools } from '@map-tools/ai-tools';

const deck = ref(null);
const mapTools = ref(null);

onMounted(() => {
  // Initialize deck.gl
  deck.value = new Deck({...});
  mapTools.value = createMapTools({ deck: deck.value });
});
</script>
```

**Angular - Map Tool Integration:**
```typescript
// map-tools.service.ts
@Injectable({ providedIn: 'root' })
export class MapToolsService {
  private mapTools: MapToolsExecutor | null = null;

  initialize(deck: Deck): void {
    this.mapTools = createMapTools({ deck });
  }

  async execute(toolName: string, parameters: any): Promise<ExecutionResult> {
    return this.mapTools!.execute(toolName, parameters);
  }
}
```

## DOCUMENTATION:

### Framework Documentation:
- **React**: https://react.dev/learn
  - Hooks: https://react.dev/reference/react/hooks
  - useEffect: https://react.dev/reference/react/useEffect
  - useState: https://react.dev/reference/react/useState
- **Vue 3**: https://vuejs.org/guide/introduction.html
  - Composition API: https://vuejs.org/api/composition-api-setup.html
  - Lifecycle Hooks: https://vuejs.org/api/composition-api-lifecycle.html
- **Angular**: https://angular.dev/overview
  - Components: https://angular.dev/guide/components
  - Services: https://angular.dev/guide/di/dependency-injection
  - RxJS: https://rxjs.dev/guide/overview

### Library Integration Documentation:
- **deck.gl React**: https://deck.gl/docs/get-started/using-with-react
- **deck.gl Standalone** (Vue/Angular): https://deck.gl/docs/get-started/using-standalone
- **MapLibre GL JS**: https://maplibre.org/maplibre-gl-js/docs/
- **Vite**: https://vite.dev/guide/
- **Angular CLI**: https://angular.dev/tools/cli

### Existing Codebase References:
- **Current Vanilla JS implementation**: `/frontend/` folder - complete reference implementation
- **Backend WebSocket API**: `/backend/src/websocket/websocket-server.ts` - message protocol
- **Message types**: `/backend/src/services/openai-service.ts` - `stream_chunk`, `tool_call`, `error`
- **Map tools library**: `/map-ai-tools/` - shared library for all implementations
- **Tool definitions**: `/map-ai-tools/src/definitions/` - available map tools

### Documentation to be Created After Implementation:
- **Comparative README.md** in project root explaining all implementations
- **Individual README.md** files in each framework folder with setup instructions
- **ARCHITECTURE.md** documenting design decisions for each framework
- **COMPARISON.md** with bundle size analysis, performance metrics, and developer experience notes
- **TROUBLESHOOTING.md** with common issues and solutions for each framework

## OTHER CONSIDERATIONS:

### Build Tool and Scaffolding:
- **React**: Use Vite's React template: `npm create vite@latest frontend-react -- --template react`
- **Vue**: Use Vite's Vue template: `npm create vite@latest frontend-vue -- --template vue`
- **Angular**: Use Angular CLI: `npx @angular/cli@latest new frontend-angular --routing=false --style=css`
- All should use the same ESLint rules and code formatting standards

### TypeScript Strategy:
- **React**: Start with JavaScript (.jsx) for faster prototyping, optional migration to TypeScript (.tsx)
- **Vue**: Use JavaScript with JSDoc comments, or `<script setup lang="ts">` for type safety
- **Angular**: TypeScript is mandatory and recommended - leverage strict typing throughout

### State Management Architecture:
- **React**:
  - Use React Context for WebSocket connection state
  - Local component state (useState) for chat messages and UI state
  - Consider Zustand if complexity increases
- **Vue**:
  - Composition API with reactive() and ref() should be sufficient
  - Provide/inject for sharing state across components
  - Pinia only if complex state management is needed
- **Angular**:
  - Services with RxJS BehaviorSubjects for state
  - Native Observable patterns for WebSocket streams
  - NgRx only if application grows significantly

### CSS and Styling:
- **Approach**: Copy existing `frontend/src/styles/main.css` to all implementations
- **MapLibre CSS**: Ensure `maplibre-gl/dist/maplibre-gl.css` is imported in each entry point
- **Framework-specific options**:
  - React: CSS Modules or styled-components for component styles
  - Vue: Scoped styles in .vue files (`<style scoped>`)
  - Angular: Component-scoped styles (default behavior)

### Critical Implementation Details:

**1. deck.gl Canvas Management:**
- **React**: Use `@deck.gl/react` package with `<DeckGL>` component
- **Vue**: Manual canvas ref with `ref="deckCanvas"` and imperative Deck initialization in onMounted
- **Angular**: ViewChild decorator to access canvas element, initialize in ngAfterViewInit
- **Common pitfall**: deck.gl needs a canvas element ID or direct canvas reference - handle differently per framework

**2. WebSocket Connection Lifecycle:**
- All implementations must properly close WebSocket on component unmount
- **React**: Cleanup function in useEffect
- **Vue**: onUnmounted hook
- **Angular**: ngOnDestroy lifecycle hook + unsubscribe from observables
- **Critical**: Prevent memory leaks from dangling WebSocket connections

**3. MapLibre + deck.gl View Synchronization:**
- The `onViewStateChange` callback must work in each framework's event system
- Ensure `map.jumpTo()` is called synchronously to prevent flickering
- Test pan, zoom, bearing, and pitch synchronization thoroughly

**4. Async Data Loading (airports.geojson):**
- **React**: fetch() in useEffect with empty dependency array
- **Vue**: fetch() in onMounted hook
- **Angular**: HttpClient service in ngOnInit or constructor with async pipe
- **Consideration**: 309KB file size - ensure loading state UI during fetch

**5. Streaming Message Updates:**
- Message streaming can cause frequent re-renders if not optimized
- **React**: Use memo() or useMemo() for message components, keys on message IDs
- **Vue**: Use v-for with :key on message IDs, computed properties for filtered lists
- **Angular**: trackBy functions in *ngFor, ChangeDetectionStrategy.OnPush where appropriate

### Performance Targets:
- **Initial Load**: < 3 seconds to interactive on good connection
- **Bundle Size**: Target < 500KB gzipped for production builds (excluding map tiles)
- **Map Rendering**: 60fps during pan/zoom interactions
- **Streaming Messages**: < 50ms latency from WebSocket receive to UI update
- **Airports Rendering**: All airports visible and interactive without performance degradation

### Package Dependencies (Common to All):
```json
{
  "dependencies": {
    "@deck.gl/carto": "^9.2.2",
    "@deck.gl/core": "^9.2.2",
    "@deck.gl/layers": "^9.2.2",
    "@map-tools/ai-tools": "file:../map-ai-tools",
    "maplibre-gl": "^4.7.1"
  }
}
```

**Framework-specific additions:**
- React: `@deck.gl/react`, `react`, `react-dom`
- Vue: `vue`
- Angular: `@angular/core`, `@angular/platform-browser`, `rxjs`, `tslib`, `zone.js`

### Testing Strategy:
- **Manual testing**: Verify all three implementations behave identically:
  - Same zoom/fly animations
  - Same chat message streaming behavior
  - Same tool execution results
  - Same error handling and reconnection behavior
- **Cross-browser**: Test in Chrome, Firefox, Safari, Edge
- **WebSocket resilience**: Stop/restart backend and verify all clients reconnect gracefully
- **Data loading**: Test with slow network (throttling) to ensure loading states work

### Known Gotchas:

1. **deck.gl with Angular**: May require webpack configuration adjustments for proper module resolution
2. **MapLibre CSS imports**: Must be imported before any component CSS to avoid style conflicts
3. **WebSocket URL**: Hardcoded to `ws://localhost:3000/ws` - consider environment variable for production
4. **Hot Module Replacement**: WebSocket connections may need manual reconnection logic during development
5. **TypeScript deck.gl types**: May need `@types/deck.gl` or manual type declarations for some frameworks
6. **CORS considerations**: Not an issue for localhost, but document for production deployments
7. **Map resize**: Ensure deck.gl and MapLibre respond to window resize events in all frameworks

### Development Workflow Recommendations:
- **Start with React**: Has the most mature deck.gl integration (`@deck.gl/react`)
- **Then Vue**: Similar to vanilla JS, good middle ground
- **Then Angular**: Most different architecture, requires more adaptation
- **Keep implementations synchronized**: When backend message protocol changes, update all three
- **Document differences**: Create a matrix of framework-specific patterns and their equivalents

### Deployment Considerations:
- All implementations should build to static sites: `npm run build`
- Output should be deployable to any static hosting (Netlify, Vercel, GitHub Pages)
- All connect to same backend WebSocket endpoint (configure via environment variable)
- Consider reverse proxy setup for production to serve backend and all frontends from single domain

### Future Enhancements (Out of Scope for Initial Implementation):
- Additional frameworks: Svelte, Solid.js, Preact
- Server-Side Rendering (SSR) versions: Next.js, Nuxt.js, Angular Universal
- Mobile versions: React Native, Ionic Vue, Ionic Angular
- Comparison dashboard showing performance metrics across implementations
