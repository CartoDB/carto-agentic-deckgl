# Plan: Adapt maps-ai-frontend-tools for deck.gl Demos

## User Requirements Summary

- **FAB Button**: Visible on ALL slides (including cover)
- **Tool Set**: Implement complete tool set at once
- **Slide Awareness**: AI can navigate slides and knows current context
- **Backend**: Use existing backend on port 3000

## New Tools Summary (6 total)

**View Control Tools (3):**
- `rotate-map` - Change bearing/rotation with relative or absolute values
- `set-pitch` - Tilt the map (0-85 degrees)
- `reset-view` - Reset to slide's default or initial view

**Slide Control Tools (3):**
- `navigate-slide` - Go to slides by number, name, or direction
- `get-slide-info` - Get current slide metadata and filter config
- `set-filter-value` - Control filter sliders (temperature, distance, priority)

---

## Implementation Phases

### Phase 1: Library Updates (map-ai-tools)

#### 1.1 Add New Tools to `map-ai-tools/src/definitions/tools.ts`

Add after existing tools:

**View Control Tools:**

```typescript
'rotate-map': {
  name: 'rotate-map',
  description: 'Rotate the map view by adjusting the bearing. Use positive values to rotate clockwise.',
  outputType: 'spec' as ToolOutputType,
  schema: z.object({
    bearing: z.number().min(-180).max(180).describe('Target bearing/rotation in degrees (-180 to 180)'),
    relative: z.boolean().default(false).describe('If true, adds to current bearing. If false, sets absolute bearing.'),
    transitionDuration: z.number().min(0).default(500).describe('Animation duration in ms'),
  }),
},

'set-pitch': {
  name: 'set-pitch',
  description: 'Tilt the map view by adjusting the pitch angle. 0 is looking straight down, 85 is nearly horizontal.',
  outputType: 'spec' as ToolOutputType,
  schema: z.object({
    pitch: z.number().min(0).max(85).describe('Target pitch/tilt in degrees (0 to 85)'),
    transitionDuration: z.number().min(0).default(500).describe('Animation duration in ms'),
  }),
},

'reset-view': {
  name: 'reset-view',
  description: 'Reset the map view to the default position for the current slide.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    toSlideDefault: z.boolean().default(true).describe('Reset to slide\'s default view. If false, resets to initial app view.'),
  }),
},
```

**Slide Control Tools:**

```typescript
'navigate-slide': {
  name: 'navigate-slide',
  description: 'Navigate to a specific slide in the presentation by number or name.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    target: z.union([z.number().min(0), z.string()]).optional(),
    direction: z.enum(['next', 'previous', 'first', 'last']).optional(),
  }),
},

'get-slide-info': {
  name: 'get-slide-info',
  description: 'Get information about the current slide including layers and filters.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    includeAllSlides: z.boolean().default(false),
  }),
},

'set-filter-value': {
  name: 'set-filter-value',
  description: 'Set the filter slider value for data filtering.',
  outputType: 'data' as ToolOutputType,
  schema: z.object({
    value: z.number(),
    normalized: z.boolean().default(true),
  }),
},
```

#### 1.2 Extend Initial State Schema

**File**: `map-ai-tools/src/schemas/initial-state.ts`

Add slide metadata schema and extend initialStateSchema:

```typescript
export const slideMetadataSchema = z.object({
  index: z.number(),
  name: z.string().optional(),
  title: z.string().optional(),
  layers: z.array(z.string()),
  hasFilter: z.boolean().default(false),
  filterConfig: z.object({
    property: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: z.string().optional(),
  }).optional(),
});

// Add to initialStateSchema:
currentSlide: z.number(),
totalSlides: z.number(),
slides: z.array(slideMetadataSchema).optional(),
demoId: z.string().optional(),
currentFilterValue: z.number().optional(),
```

#### 1.3 Update Dictionary

**File**: `map-ai-tools/src/definitions/dictionary.ts`

Add new TOOL_NAMES:
- `ROTATE_MAP`
- `SET_PITCH`
- `RESET_VIEW`
- `NAVIGATE_SLIDE`
- `GET_SLIDE_INFO`
- `SET_FILTER_VALUE`

---

### Phase 2: Shared Components

Create `integration-examples/shared/` directory:

#### 2.1 Components

| File | Purpose |
|------|---------|
| `components/ChatFAB.jsx` | MUI v4 Fab in lower-left, toggles chat window |
| `components/FloatingChatWindow.jsx` | 350x400px floating container near FAB |
| `components/ChatUI.jsx` | Adapted from frontend-react with MUI v4 styling |
| `components/ToolLoader.jsx` | Loading indicator during AI thinking/executing |
| `components/index.js` | Component exports |

#### 2.2 Hooks

| File | Purpose |
|------|---------|
| `hooks/useSlideAwareAITools.js` | Extends useMapAITools with slide executors |
| `hooks/index.js` | Hook exports |

#### 2.3 Services

| File | Purpose |
|------|---------|
| `services/slideToolExecutors.js` | navigate-slide, get-slide-info, set-filter-value executors |
| `services/index.js` | Service exports |

---

### Phase 3: sdsc-2025-congestion Integration

#### 3.1 Modify State
**File**: `integration-examples/sdsc-2025-congestion/state.jsx`

- Expose `setCurrentSlide` in context
- Add `goToSlide(index)` with bounds checking

#### 3.2 Modify Main
**File**: `integration-examples/sdsc-2025-congestion/components/Main/Main.jsx`

- Import ChatFAB, FloatingChatWindow from shared
- Add useState for chat open/close
- Integrate useSlideAwareAITools hook

#### 3.3 Create Slides Config
**File**: `integration-examples/sdsc-2025-congestion/slidesConfigForAI.js`

Slide names: cover, challenge, results, regional-impact, safety, transit-funding

---

### Phase 4: tiles3d-demo Integration

#### 4.1 Modify State
**File**: `integration-examples/tiles3d-demo/state.jsx`

Same changes as sdsc-2025-congestion

#### 4.2 Modify Main
**File**: `integration-examples/tiles3d-demo/components/Main/Main.jsx`

Same integration pattern

#### 4.3 Create Slides Config
**File**: `integration-examples/tiles3d-demo/slidesConfigForAI.js`

Slide config with filter ranges:
- Slide 0: "cover"
- Slide 1: "intro"
- Slide 2: "temperature" (filter: 26-36°C)
- Slide 3: "parks"
- Slide 4: "distance" (filter: 0-500m)
- Slide 5: "priority" (filter: 0-1)

---

### Phase 5: Backend System Prompt

**File**: `backend/src/services/system-prompt.ts`

Add demo context detection and slide-aware prompts.

---

## Files Summary

### Files to Create (11)

```
integration-examples/shared/
├── components/
│   ├── ChatFAB.jsx
│   ├── FloatingChatWindow.jsx
│   ├── ChatUI.jsx
│   ├── ToolLoader.jsx
│   └── index.js
├── hooks/
│   ├── useSlideAwareAITools.js
│   └── index.js
└── services/
    ├── slideToolExecutors.js
    └── index.js

integration-examples/sdsc-2025-congestion/
└── slidesConfigForAI.js

integration-examples/tiles3d-demo/
└── slidesConfigForAI.js
```

### Files to Modify (9)

| File | Changes |
|------|---------|
| `map-ai-tools/src/definitions/tools.ts` | Add 6 new tools (3 view control + 3 slide control) |
| `map-ai-tools/src/definitions/dictionary.ts` | Add TOOL_NAMES |
| `map-ai-tools/src/schemas/initial-state.ts` | Add slide context schema |
| `map-ai-tools/src/index.ts` | Export new items |
| `sdsc-2025-congestion/state.jsx` | Expose setCurrentSlide, goToSlide |
| `sdsc-2025-congestion/components/Main/Main.jsx` | Add chat components |
| `tiles3d-demo/state.jsx` | Expose setCurrentSlide, goToSlide |
| `tiles3d-demo/components/Main/Main.jsx` | Add chat components |
| `backend/src/services/system-prompt.ts` | Add demo contexts |

---

## Key Code Patterns

### Rotate Map Executor
```javascript
[TOOL_NAMES.ROTATE_MAP]: (params) => {
  const { bearing, relative, transitionDuration } = params;
  const currentBearing = appState.viewState.bearing || 0;
  const newBearing = relative ? currentBearing + bearing : bearing;

  appState.updateViewState({
    ...appState.viewState,
    bearing: newBearing,
    transitionDuration,
  });
  return { success: true, message: `Rotated to ${newBearing}°` };
}
```

### Set Pitch Executor
```javascript
[TOOL_NAMES.SET_PITCH]: (params) => {
  const { pitch, transitionDuration } = params;
  appState.updateViewState({
    ...appState.viewState,
    pitch,
    transitionDuration,
  });
  return { success: true, message: `Pitch set to ${pitch}°` };
}
```

### Reset View Executor
```javascript
[TOOL_NAMES.RESET_VIEW]: (params) => {
  const { toSlideDefault } = params;
  const targetView = toSlideDefault
    ? slidesConfig[appState.currentSlide].view
    : INITIAL_VIEW_STATE;

  appState.updateViewState({
    ...targetView,
    transitionDuration: 1000,
  });
  return { success: true, message: 'View reset' };
}
```

### Slide Navigation Executor
```javascript
[TOOL_NAMES.NAVIGATE_SLIDE]: (params) => {
  const { target, direction } = params;
  if (direction) {
    switch (direction) {
      case 'next': appState.next(); break;
      case 'previous': appState.prev(); break;
      case 'first': appState.reset(); break;
      case 'last': appState.goToSlide(slidesConfig.length - 1); break;
    }
    return { success: true, message: `Navigated ${direction}` };
  }
  if (typeof target === 'number') {
    appState.goToSlide(target);
    return { success: true, message: `Navigated to slide ${target}` };
  }
  const slideIndex = findSlideByName(slidesConfig, target);
  if (slideIndex >= 0) {
    appState.goToSlide(slideIndex);
    return { success: true, message: `Navigated to "${target}"` };
  }
  return { success: false, message: `Slide "${target}" not found` };
}
```

### Filter Value Executor
```javascript
[TOOL_NAMES.SET_FILTER_VALUE]: (params) => {
  const { value, normalized } = params;
  const slideConfig = slidesConfig[appState.currentSlide];
  if (!slideConfig.slider) {
    return { success: false, message: 'No filter on this slide' };
  }
  let actualValue = value;
  if (normalized && slideConfig.legend?.values) {
    const { values } = slideConfig.legend;
    actualValue = values[0] + (value * (values[values.length - 1] - values[0]));
  }
  appState.setFilterValue(actualValue);
  return { success: true, message: `Filter set to ${actualValue}` };
}
```

### Initial State with Slide Context
```javascript
const createInitialState = () => ({
  initialViewState: { ...appState.viewState },
  currentSlide: appState.currentSlide,
  totalSlides: slidesConfig.length,
  slides: slidesConfig.map((s, i) => ({
    index: i,
    name: s.name,
    layers: s.layers,
    hasFilter: Boolean(s.slider),
    filterConfig: s.legend ? {
      min: s.legend.values[0],
      max: s.legend.values[s.legend.values.length - 1],
      unit: s.legend.title,
    } : undefined,
  })),
  demoId: DEMO_ID,
  currentFilterValue: appState.filterValue,
});
```

---

## Implementation Order

1. **map-ai-tools library** - Tools, schemas, dictionary
2. **shared/ directory** - Components, hooks, services
3. **sdsc-2025-congestion** - State, Main, slidesConfigForAI
4. **tiles3d-demo** - State, Main, slidesConfigForAI
5. **Backend** - System prompts
6. **Testing** - End-to-end verification
