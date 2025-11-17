# PRP-003: Map AI Tools Library - Isomorphic JavaScript Package

**Status:** Ready for Implementation
**Confidence Score:** 8/10
**Estimated Complexity:** High
**Implementation Time:** 14-18 hours
**Dependencies:** PRP-002 (OpenAI Integration)

---

## 📋 PROJECT OVERVIEW

### What We're Building

Create a standalone, isomorphic vanilla JavaScript library that encapsulates:
1. **Tool Definitions**: OpenAI function calling schemas for map controls
2. **Tool Executors**: Implementation logic for executing map operations
3. **System Prompts**: AI context for tool usage
4. **Extensibility API**: Allow clients to add/modify/disable tools

The library will be published as an npm package that works in both browser (frontend) and Node.js (backend) environments.

### Current System

**Tool Definitions**: Hardcoded in `backend/src/services/tool-definitions.ts`
```typescript
// Returns array of OpenAI tool schemas
export function getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[]
```

**Tool Executors**: Hardcoded in `frontend/src/commands/tool-executor.js`
```javascript
// Executes tools using MapController
export class ToolExecutor {
  execute(toolName, parameters) { /* switch statement */ }
}
```

**System Prompt**: Hardcoded in `backend/src/services/openai-service.ts`
```typescript
const SYSTEM_PROMPT = `You are a helpful AI assistant...`;
```

**Problem**: Code duplication, no reusability, tightly coupled to project structure

### After This Implementation

**New Library Package**: `@map-tools/ai-tools` (or your scoped package name)

**Backend Integration**:
```javascript
import { getToolDefinitions, getSystemPrompt } from '@map-tools/ai-tools';
const tools = getToolDefinitions();
const prompt = getSystemPrompt(tools, { cityCoordinates: {...} });
```

**Frontend Integration**:
```javascript
import { createMapTools } from '@map-tools/ai-tools';
const mapTools = createMapTools({ mapController, cities });
await mapTools.execute('zoom_map', { direction: 'in' });
```

**Benefits**:
- Reusable across multiple projects
- Tree-shakeable for smaller bundles
- Easy to extend with custom tools
- Testable in isolation
- Type-safe with TypeScript definitions

---

## 🔬 TECHNICAL REQUIREMENTS

### Package Structure

```
map-ai-tools/
├── package.json              # Dual package exports (ESM + CJS)
├── rollup.config.js          # Build configuration
├── tsconfig.json             # TypeScript config
├── src/
│   ├── index.ts              # Main entry point
│   ├── definitions/          # Tool schemas
│   │   ├── zoom-map.ts
│   │   ├── fly-to-location.ts
│   │   ├── toggle-layer.ts
│   │   └── index.ts
│   ├── executors/            # Tool implementations
│   │   ├── zoom-executor.ts
│   │   ├── fly-executor.ts
│   │   ├── toggle-executor.ts
│   │   └── index.ts
│   ├── prompts/              # System prompt templates
│   │   ├── base-prompt.ts
│   │   ├── tool-descriptions.ts
│   │   └── index.ts
│   ├── core/                 # Core library logic
│   │   ├── tool-registry.ts
│   │   ├── executor-factory.ts
│   │   ├── types.ts
│   │   └── validation.ts
│   └── extensions/           # Extensibility helpers
│       ├── custom-tool.ts
│       └── interceptors.ts
├── dist/                     # Build output
│   ├── esm/                  # ES modules
│   ├── cjs/                  # CommonJS
│   └── types/                # TypeScript declarations
└── tests/                    # Test files
    ├── definitions.test.ts
    ├── executors.test.ts
    └── integration.test.ts
```

### Package Configuration

**package.json** (Isomorphic setup with conditional exports):

```json
{
  "name": "@map-tools/ai-tools",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    },
    "./definitions": {
      "import": "./dist/esm/definitions/index.js",
      "require": "./dist/cjs/definitions/index.js"
    },
    "./executors": {
      "import": "./dist/esm/executors/index.js",
      "require": "./dist/cjs/executors/index.js"
    },
    "./prompts": {
      "import": "./dist/esm/prompts/index.js",
      "require": "./dist/cjs/prompts/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c --watch",
    "test": "vitest",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["ai", "map", "tools", "openai", "deckgl", "maplibre"],
  "peerDependencies": {},
  "devDependencies": {
    "@rollup/plugin-typescript": "^12.1.0",
    "@rollup/plugin-node-resolve": "^16.0.0",
    "@rollup/plugin-commonjs": "^28.0.2",
    "rollup": "^4.29.2",
    "typescript": "^5.9.3",
    "vitest": "^3.0.0",
    "@types/node": "^24.10.0"
  }
}
```

### Rollup Configuration

**rollup.config.js**:

```javascript
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const external = []; // No external dependencies for core

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/esm',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        declaration: true,
        declarationDir: 'dist/types',
        outDir: 'dist/esm',
        rootDir: 'src'
      })
    ],
    external
  },
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        declaration: false,
        outDir: 'dist/cjs',
        rootDir: 'src'
      })
    ],
    external
  }
];
```

### TypeScript Configuration

**tsconfig.json**:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 🏗️ IMPLEMENTATION BLUEPRINT

### Phase 1: Library Scaffolding (2-3 hours)

#### Step 1.1: Create Library Directory

```bash
# From project root
mkdir -p map-ai-tools
cd map-ai-tools

# Initialize npm package
npm init -y

# Create directory structure
mkdir -p src/{definitions,executors,prompts,core,extensions}
mkdir -p tests
mkdir -p dist

# Initialize git (optional)
git init
```

#### Step 1.2: Install Development Dependencies

```bash
npm install -D rollup \
  @rollup/plugin-typescript \
  @rollup/plugin-node-resolve \
  @rollup/plugin-commonjs \
  typescript \
  vitest \
  @types/node
```

#### Step 1.3: Create Configuration Files

Create `package.json`, `rollup.config.js`, `tsconfig.json` as specified in Technical Requirements section above.

#### Step 1.4: Add .gitignore and .npmignore

```bash
# .gitignore
node_modules/
dist/
*.log
.DS_Store
coverage/

# .npmignore
src/
tests/
*.test.ts
tsconfig.json
rollup.config.js
.gitignore
```

### Phase 2: Core Type Definitions (2 hours)

#### Step 2.1: Define Core Types

**src/core/types.ts**:

```typescript
/**
 * Map controller interface that clients must implement
 * This keeps the library decoupled from deck.gl/MapLibre
 */
export interface IMapController {
  zoomIn(levels?: number): void;
  zoomOut(levels?: number): void;
  flyTo(longitude: number, latitude: number, zoom?: number): void;
  toggleLayer(layerId: string): void;
  getLayerVisibility(layerId: string): boolean;
}

/**
 * OpenAI function calling tool definition
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

/**
 * Tool executor function signature
 */
export type ToolExecutor<TParams = any, TResult = any> = (
  params: TParams,
  context: ExecutionContext
) => Promise<ExecutionResult<TResult>> | ExecutionResult<TResult>;

/**
 * Context passed to tool executors
 */
export interface ExecutionContext {
  mapController: IMapController;
  cityCoordinates?: Record<string, [number, number]>;
  metadata?: Record<string, any>;
}

/**
 * Result of tool execution
 */
export interface ExecutionResult<TData = any> {
  success: boolean;
  message?: string;
  data?: TData;
  error?: Error;
}

/**
 * Custom tool definition for extensions
 */
export interface CustomToolDefinition {
  name: string;
  definition: ToolDefinition;
  executor: ToolExecutor;
}

/**
 * Tool interceptors for hooks
 */
export interface ToolInterceptors {
  beforeExecute?: (toolName: string, params: any) => void | Promise<void>;
  afterExecute?: (toolName: string, result: ExecutionResult) => void | Promise<void>;
  onError?: (toolName: string, error: Error) => void | Promise<void>;
}

/**
 * Library configuration
 */
export interface MapToolsConfig {
  mapController: IMapController;
  tools?: string[];  // Tool names to include (default: all)
  customTools?: CustomToolDefinition[];
  cityCoordinates?: Record<string, [number, number]>;
  toolInterceptors?: ToolInterceptors;
  metadata?: Record<string, any>;
}

/**
 * System prompt configuration
 */
export interface PromptConfig {
  additionalContext?: string;
  cityCoordinates?: Record<string, [number, number]>;
  customInstructions?: string;
}
```

### Phase 3: Tool Definitions (2-3 hours)

#### Step 3.1: Migrate Zoom Map Definition

**src/definitions/zoom-map.ts**:

```typescript
import { ToolDefinition } from '../core/types';

export const ZOOM_MAP_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'zoom_map',
    description: 'Control the map zoom level. Use this when the user wants to zoom in or out.',
    parameters: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['in', 'out'],
          description: 'Zoom direction: "in" to zoom in, "out" to zoom out'
        },
        levels: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 1,
          description: 'Number of zoom levels to change (default: 1)'
        }
      },
      required: ['direction']
    }
  }
};
```

#### Step 3.2: Migrate Fly To Location Definition

**src/definitions/fly-to-location.ts**:

```typescript
import { ToolDefinition } from '../core/types';

export const FLY_TO_LOCATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'fly_to_location',
    description: 'Navigate the map to a specific location. Can use city name or coordinates.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name like "New York", "San Francisco", "Chicago", etc.'
        },
        coordinates: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: 'Optional [longitude, latitude] coordinates. Remember: longitude first, then latitude.'
        },
        zoom: {
          type: 'integer',
          minimum: 0,
          maximum: 20,
          description: 'Optional zoom level (0-20)'
        }
      }
    }
  }
};
```

#### Step 3.3: Migrate Toggle Layer Definition

**src/definitions/toggle-layer.ts**:

```typescript
import { ToolDefinition } from '../core/types';

export const TOGGLE_LAYER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'toggle_layer',
    description: 'Show or hide map layers. Currently supports the points layer showing US cities.',
    parameters: {
      type: 'object',
      properties: {
        layer_id: {
          type: 'string',
          enum: ['points-layer'],
          description: 'The layer identifier. Use "points-layer" for the US cities layer.'
        },
        visible: {
          type: 'boolean',
          description: 'true to show the layer, false to hide it'
        }
      },
      required: ['layer_id', 'visible']
    }
  }
};
```

#### Step 3.4: Create Definitions Index

**src/definitions/index.ts**:

```typescript
import { ToolDefinition } from '../core/types';
import { ZOOM_MAP_TOOL } from './zoom-map';
import { FLY_TO_LOCATION_TOOL } from './fly-to-location';
import { TOGGLE_LAYER_TOOL } from './toggle-layer';

export * from './zoom-map';
export * from './fly-to-location';
export * from './toggle-layer';

/**
 * Registry of all built-in tools
 */
export const BUILTIN_TOOLS: Record<string, ToolDefinition> = {
  zoom_map: ZOOM_MAP_TOOL,
  fly_to_location: FLY_TO_LOCATION_TOOL,
  toggle_layer: TOGGLE_LAYER_TOOL
};

/**
 * Get tool definitions by name
 * @param toolNames - Array of tool names to include (default: all)
 */
export function getToolDefinitions(toolNames?: string[]): ToolDefinition[] {
  const names = toolNames || Object.keys(BUILTIN_TOOLS);
  return names
    .filter(name => BUILTIN_TOOLS[name])
    .map(name => BUILTIN_TOOLS[name]);
}
```

### Phase 4: Tool Executors (3-4 hours)

#### Step 4.1: Create Zoom Executor

**src/executors/zoom-executor.ts**:

```typescript
import { ToolExecutor, ExecutionContext, ExecutionResult } from '../core/types';

interface ZoomParams {
  direction: 'in' | 'out';
  levels?: number;
}

export const executeZoom: ToolExecutor<ZoomParams> = (params, context) => {
  const { direction, levels = 1 } = params;
  const { mapController } = context;

  try {
    if (direction === 'in') {
      mapController.zoomIn(levels);
      return {
        success: true,
        message: `Zoomed in by ${levels} level(s)`,
        data: { direction, levels }
      };
    } else if (direction === 'out') {
      mapController.zoomOut(levels);
      return {
        success: true,
        message: `Zoomed out by ${levels} level(s)`,
        data: { direction, levels }
      };
    }

    return {
      success: false,
      message: 'Invalid zoom direction',
      error: new Error('Direction must be "in" or "out"')
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to execute zoom',
      error: error as Error
    };
  }
};
```

#### Step 4.2: Create Fly To Executor

**src/executors/fly-executor.ts**:

```typescript
import { ToolExecutor, ExecutionContext, ExecutionResult } from '../core/types';

interface FlyToParams {
  location?: string;
  coordinates?: [number, number];
  zoom?: number;
}

export const executeFlyTo: ToolExecutor<FlyToParams> = (params, context) => {
  const { location, coordinates, zoom } = params;
  const { mapController, cityCoordinates } = context;

  try {
    // Priority 1: Use coordinates if provided
    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      const [lon, lat] = coordinates;
      mapController.flyTo(lon, lat, zoom);
      return {
        success: true,
        message: `Flew to coordinates [${lon.toFixed(2)}, ${lat.toFixed(2)}]`,
        data: { coordinates, zoom }
      };
    }

    // Priority 2: Use location name
    if (location && cityCoordinates) {
      const lowerLocation = location.toLowerCase();
      const coords = cityCoordinates[lowerLocation];

      if (coords) {
        mapController.flyTo(coords[0], coords[1], zoom);
        return {
          success: true,
          message: `Flew to ${location}`,
          data: { location, coordinates: coords, zoom }
        };
      }

      return {
        success: false,
        message: `Location "${location}" not found`,
        error: new Error(`Unknown location: ${location}`)
      };
    }

    return {
      success: false,
      message: 'No location or coordinates provided',
      error: new Error('Missing location or coordinates parameter')
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to fly to location',
      error: error as Error
    };
  }
};
```

#### Step 4.3: Create Toggle Layer Executor

**src/executors/toggle-executor.ts**:

```typescript
import { ToolExecutor, ExecutionContext, ExecutionResult } from '../core/types';

interface ToggleLayerParams {
  layer_id: string;
  visible: boolean;
}

export const executeToggleLayer: ToolExecutor<ToggleLayerParams> = (params, context) => {
  const { layer_id, visible } = params;
  const { mapController } = context;

  try {
    if (layer_id === 'points-layer') {
      mapController.toggleLayer(layer_id);
      return {
        success: true,
        message: visible ? 'Showed points layer' : 'Hid points layer',
        data: { layer_id, visible }
      };
    }

    return {
      success: false,
      message: `Unknown layer: ${layer_id}`,
      error: new Error(`Layer "${layer_id}" not found`)
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to toggle layer',
      error: error as Error
    };
  }
};
```

#### Step 4.4: Create Executors Index

**src/executors/index.ts**:

```typescript
import { ToolExecutor } from '../core/types';
import { executeZoom } from './zoom-executor';
import { executeFlyTo } from './fly-executor';
import { executeToggleLayer } from './toggle-executor';

export * from './zoom-executor';
export * from './fly-executor';
export * from './toggle-executor';

/**
 * Registry of all built-in executors
 */
export const BUILTIN_EXECUTORS: Record<string, ToolExecutor> = {
  zoom_map: executeZoom,
  fly_to_location: executeFlyTo,
  toggle_layer: executeToggleLayer
};
```

### Phase 5: System Prompts (1-2 hours)

#### Step 5.1: Create Base Prompt Template

**src/prompts/base-prompt.ts**:

```typescript
export const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant integrated with an interactive map application showing cities across the United States.

Users can ask you to control the map or ask general questions.

Available map controls:
- Zoom in/out on the map (use zoom_map tool)
- Fly to specific locations by city name or coordinates (use fly_to_location tool)
- Show/hide the points layer displaying US cities (use toggle_layer tool)

Be conversational and helpful. When users want to control the map, use the provided tools.
Always explain what you're doing when executing map commands.`;
```

#### Step 5.2: Create Tool Descriptions Generator

**src/prompts/tool-descriptions.ts**:

```typescript
import { ToolDefinition } from '../core/types';

/**
 * Generate tool descriptions for system prompt
 */
export function generateToolDescriptions(tools: ToolDefinition[]): string {
  const descriptions = tools.map(tool => {
    const { name, description } = tool.function;
    return `- ${name}: ${description}`;
  });

  return `\nAvailable tools:\n${descriptions.join('\n')}`;
}

/**
 * Generate city coordinates section for system prompt
 */
export function generateCityCoordinatesSection(
  cityCoordinates?: Record<string, [number, number]>
): string {
  if (!cityCoordinates || Object.keys(cityCoordinates).length === 0) {
    return '';
  }

  const cities = Object.entries(cityCoordinates)
    .map(([name, [lon, lat]]) => `- ${name}: [${lon}, ${lat}]`)
    .join('\n');

  return `\nWhen navigating to cities, use these coordinates:\n${cities}`;
}
```

#### Step 5.3: Create Prompt Builder

**src/prompts/index.ts**:

```typescript
import { ToolDefinition, PromptConfig } from '../core/types';
import { BASE_SYSTEM_PROMPT } from './base-prompt';
import { generateToolDescriptions, generateCityCoordinatesSection } from './tool-descriptions';

export * from './base-prompt';
export * from './tool-descriptions';

/**
 * Build complete system prompt from tools and configuration
 */
export function getSystemPrompt(
  tools: ToolDefinition[],
  config?: PromptConfig
): string {
  const sections: string[] = [BASE_SYSTEM_PROMPT];

  // Add tool descriptions
  if (tools.length > 0) {
    sections.push(generateToolDescriptions(tools));
  }

  // Add city coordinates
  if (config?.cityCoordinates) {
    sections.push(generateCityCoordinatesSection(config.cityCoordinates));
  }

  // Add additional context
  if (config?.additionalContext) {
    sections.push(`\n${config.additionalContext}`);
  }

  // Add custom instructions
  if (config?.customInstructions) {
    sections.push(`\n${config.customInstructions}`);
  }

  return sections.join('\n');
}
```

### Phase 6: Core Registry & Factory (3-4 hours)

#### Step 6.1: Create Tool Registry

**src/core/tool-registry.ts**:

```typescript
import { ToolDefinition, CustomToolDefinition } from './types';
import { BUILTIN_TOOLS } from '../definitions';
import { BUILTIN_EXECUTORS } from '../executors';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private executors: Map<string, any> = new Map();

  constructor() {
    // Register built-in tools
    Object.entries(BUILTIN_TOOLS).forEach(([name, definition]) => {
      this.tools.set(name, definition);
    });

    // Register built-in executors
    Object.entries(BUILTIN_EXECUTORS).forEach(([name, executor]) => {
      this.executors.set(name, executor);
    });
  }

  /**
   * Register a custom tool
   */
  registerTool(customTool: CustomToolDefinition): void {
    this.tools.set(customTool.name, customTool.definition);
    this.executors.set(customTool.name, customTool.executor);
  }

  /**
   * Remove a tool from the registry
   */
  removeTool(toolName: string): void {
    this.tools.delete(toolName);
    this.executors.delete(toolName);
  }

  /**
   * Get tool definition by name
   */
  getTool(toolName: string): ToolDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get executor by tool name
   */
  getExecutor(toolName: string): any | undefined {
    return this.executors.get(toolName);
  }

  /**
   * Get all registered tool definitions
   */
  getAllTools(toolNames?: string[]): ToolDefinition[] {
    if (toolNames) {
      return toolNames
        .map(name => this.tools.get(name))
        .filter((tool): tool is ToolDefinition => tool !== undefined);
    }
    return Array.from(this.tools.values());
  }

  /**
   * Check if tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
```

#### Step 6.2: Create Parameter Validation

**src/core/validation.ts**:

```typescript
import { ToolDefinition } from './types';

/**
 * Validate parameters against tool schema
 */
export function validateParameters(
  toolName: string,
  params: any,
  definition: ToolDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schema = definition.function.parameters;
  const required = schema.required || [];

  // Check required parameters
  for (const requiredParam of required) {
    if (!(requiredParam in params)) {
      errors.push(`Missing required parameter: ${requiredParam}`);
    }
  }

  // Validate parameter types (basic validation)
  for (const [paramName, paramValue] of Object.entries(params)) {
    const paramSchema = schema.properties[paramName];
    if (!paramSchema) {
      errors.push(`Unknown parameter: ${paramName}`);
      continue;
    }

    // Type validation
    if (paramSchema.type) {
      const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
      if (paramSchema.type !== actualType) {
        errors.push(
          `Invalid type for ${paramName}: expected ${paramSchema.type}, got ${actualType}`
        );
      }
    }

    // Enum validation
    if (paramSchema.enum && !paramSchema.enum.includes(paramValue)) {
      errors.push(
        `Invalid value for ${paramName}: must be one of [${paramSchema.enum.join(', ')}]`
      );
    }

    // Number range validation
    if (typeof paramValue === 'number') {
      if (paramSchema.minimum !== undefined && paramValue < paramSchema.minimum) {
        errors.push(`${paramName} must be >= ${paramSchema.minimum}`);
      }
      if (paramSchema.maximum !== undefined && paramValue > paramSchema.maximum) {
        errors.push(`${paramName} must be <= ${paramSchema.maximum}`);
      }
    }

    // Array validation
    if (Array.isArray(paramValue)) {
      if (paramSchema.minItems && paramValue.length < paramSchema.minItems) {
        errors.push(`${paramName} must have at least ${paramSchema.minItems} items`);
      }
      if (paramSchema.maxItems && paramValue.length > paramSchema.maxItems) {
        errors.push(`${paramName} must have at most ${paramSchema.maxItems} items`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### Step 6.3: Create Executor Factory

**src/core/executor-factory.ts**:

```typescript
import {
  MapToolsConfig,
  ExecutionContext,
  ExecutionResult,
  ToolInterceptors
} from './types';
import { ToolRegistry } from './tool-registry';
import { validateParameters } from './validation';

export class MapToolsExecutor {
  private registry: ToolRegistry;
  private context: ExecutionContext;
  private interceptors?: ToolInterceptors;

  constructor(config: MapToolsConfig) {
    this.registry = new ToolRegistry();

    // Filter tools if specified
    if (config.tools) {
      const allTools = this.registry.getToolNames();
      const toRemove = allTools.filter(name => !config.tools!.includes(name));
      toRemove.forEach(name => this.registry.removeTool(name));
    }

    // Register custom tools
    if (config.customTools) {
      config.customTools.forEach(tool => this.registry.registerTool(tool));
    }

    // Setup execution context
    this.context = {
      mapController: config.mapController,
      cityCoordinates: config.cityCoordinates,
      metadata: config.metadata
    };

    this.interceptors = config.toolInterceptors;
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: string, parameters: any): Promise<ExecutionResult> {
    try {
      // Get tool definition
      const definition = this.registry.getTool(toolName);
      if (!definition) {
        return {
          success: false,
          message: `Unknown tool: ${toolName}`,
          error: new Error(`Tool "${toolName}" not found in registry`)
        };
      }

      // Validate parameters
      const validation = validateParameters(toolName, parameters, definition);
      if (!validation.valid) {
        return {
          success: false,
          message: `Invalid parameters: ${validation.errors.join(', ')}`,
          error: new Error(validation.errors.join('; '))
        };
      }

      // Get executor
      const executor = this.registry.getExecutor(toolName);
      if (!executor) {
        return {
          success: false,
          message: `No executor found for tool: ${toolName}`,
          error: new Error(`Executor for "${toolName}" not registered`)
        };
      }

      // Before interceptor
      if (this.interceptors?.beforeExecute) {
        await this.interceptors.beforeExecute(toolName, parameters);
      }

      // Execute tool
      const result = await Promise.resolve(executor(parameters, this.context));

      // After interceptor
      if (this.interceptors?.afterExecute) {
        await this.interceptors.afterExecute(toolName, result);
      }

      return result;

    } catch (error) {
      const err = error as Error;

      // Error interceptor
      if (this.interceptors?.onError) {
        await this.interceptors.onError(toolName, err);
      }

      return {
        success: false,
        message: `Tool execution failed: ${err.message}`,
        error: err
      };
    }
  }

  /**
   * Get all available tool names
   */
  getAvailableTools(): string[] {
    return this.registry.getToolNames();
  }

  /**
   * Check if tool is available
   */
  hasTool(toolName: string): boolean {
    return this.registry.hasTool(toolName);
  }
}
```

### Phase 7: Main Entry Point (1 hour)

#### Step 7.1: Create Main Index

**src/index.ts**:

```typescript
// Re-export types
export * from './core/types';

// Re-export definitions
export {
  BUILTIN_TOOLS,
  getToolDefinitions,
  ZOOM_MAP_TOOL,
  FLY_TO_LOCATION_TOOL,
  TOGGLE_LAYER_TOOL
} from './definitions';

// Re-export executors
export {
  BUILTIN_EXECUTORS,
  executeZoom,
  executeFlyTo,
  executeToggleLayer
} from './executors';

// Re-export prompts
export {
  BASE_SYSTEM_PROMPT,
  getSystemPrompt,
  generateToolDescriptions,
  generateCityCoordinatesSection
} from './prompts';

// Re-export core classes
export { ToolRegistry } from './core/tool-registry';
export { MapToolsExecutor } from './core/executor-factory';
export { validateParameters } from './core/validation';

// Main factory function
import { MapToolsConfig } from './core/types';
import { MapToolsExecutor } from './core/executor-factory';

/**
 * Create a map tools executor instance
 *
 * @example
 * ```typescript
 * const mapTools = createMapTools({
 *   mapController: myMapController,
 *   tools: ['zoom_map', 'fly_to_location'],
 *   cityCoordinates: { 'new york': [-74.006, 40.7128] }
 * });
 *
 * await mapTools.execute('zoom_map', { direction: 'in', levels: 2 });
 * ```
 */
export function createMapTools(config: MapToolsConfig): MapToolsExecutor {
  return new MapToolsExecutor(config);
}
```

### Phase 8: Build & Package (1-2 hours)

#### Step 8.1: Build the Library

```bash
cd map-ai-tools

# Run TypeScript type checking
npm run type-check

# Build ESM and CJS bundles
npm run build

# Verify dist output
ls -la dist/
# Expected: esm/, cjs/, types/
```

#### Step 8.2: Create README.md

**README.md**:

```markdown
# @map-tools/ai-tools

Isomorphic JavaScript library for AI-powered map controls using OpenAI function calling.

## Installation

\`\`\`bash
npm install @map-tools/ai-tools
\`\`\`

## Quick Start

### Backend (Node.js)

\`\`\`typescript
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
\`\`\`

### Frontend (Browser)

\`\`\`javascript
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
\`\`\`

## API Documentation

See [full documentation](./docs/API.md)

## License

MIT
```

#### Step 8.3: Test Package Locally

```bash
# Link package locally for testing
npm link

# In your main project (backend)
cd ../backend
npm link @map-tools/ai-tools

# In your main project (frontend)
cd ../frontend
npm link @map-tools/ai-tools
```

### Phase 9: Integration (4-5 hours)

#### Step 9.1: Update Backend Integration

**backend/package.json**:

```json
{
  "dependencies": {
    "@map-tools/ai-tools": "^1.0.0",
    // ... other dependencies
  }
}
```

**backend/src/services/tool-definitions.ts** (REPLACE):

```typescript
// OLD: export function getToolDefinitions() { ... }
// NEW: Re-export from library

export { getToolDefinitions } from '@map-tools/ai-tools';
```

**backend/src/services/openai-service.ts** (UPDATE):

```typescript
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import { getToolDefinitions, getSystemPrompt } from '@map-tools/ai-tools';

// Remove hardcoded SYSTEM_PROMPT
// OLD: const SYSTEM_PROMPT = `...`;

// Default city coordinates
const DEFAULT_CITIES = {
  'new york': [-74.0060, 40.7128],
  'los angeles': [-118.2437, 34.0522],
  'chicago': [-87.6298, 41.8781],
  'san francisco': [-122.4194, 37.7749],
  'seattle': [-122.3321, 47.6062],
  'miami': [-80.1918, 25.7617],
  'boston': [-71.0589, 42.3601],
  'denver': [-104.9903, 39.7392]
};

export class OpenAIService {
  private client: OpenAI;
  private model: string;
  private tools: any[];
  private systemPrompt: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Get tools and prompt from library
    this.tools = getToolDefinitions();
    this.systemPrompt = getSystemPrompt(this.tools, {
      cityCoordinates: DEFAULT_CITIES
    });
  }

  async streamChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    ws: WebSocket
  ): Promise<OpenAI.Chat.ChatCompletionMessageParam | null> {
    // Add system prompt to messages
    const messagesWithSystem = [
      { role: 'system', content: this.systemPrompt } as const,
      ...messages
    ];

    // Rest of the implementation stays the same
    // ...
  }
}
```

#### Step 9.2: Update Frontend Integration

**frontend/package.json**:

```json
{
  "dependencies": {
    "@map-tools/ai-tools": "^1.0.0",
    // ... other dependencies
  }
}
```

**frontend/src/commands/tool-executor.js** (REPLACE):

```javascript
// OLD: export class ToolExecutor { ... }
// NEW: Use library

import { createMapTools } from '@map-tools/ai-tools';

// Adapter to match old interface
export class ToolExecutor {
  constructor(mapController, cityCoordinates) {
    this.mapTools = createMapTools({
      mapController,
      cityCoordinates
    });
  }

  async execute(toolName, parameters) {
    return await this.mapTools.execute(toolName, parameters);
  }
}
```

**Alternative: Direct usage in main.js**:

```javascript
// frontend/src/main.js
import { createMapTools } from '@map-tools/ai-tools';

// ... map setup code ...

// Replace ToolExecutor with library
const mapTools = createMapTools({
  mapController,
  cityCoordinates: CITY_COORDINATES,
  toolInterceptors: {
    beforeExecute: (toolName, params) => {
      chatUI.addActionMessage(`Executing: ${toolName}...`);
    },
    afterExecute: (toolName, result) => {
      if (result.success) {
        chatUI.addActionMessage(`✓ ${result.message}`);
      } else {
        chatUI.addActionMessage(`✗ ${result.message}`);
      }
    }
  }
});

// Update WebSocket handler
ws.on('message', async (data) => {
  const message = JSON.parse(data);

  if (message.type === 'tool_call') {
    const result = await mapTools.execute(message.tool, message.parameters);
    console.log('Tool execution result:', result);
  }
});
```

#### Step 9.3: Remove Old Files

```bash
# Backend - Delete old tool definitions
rm backend/src/services/tool-definitions.ts

# Frontend - Optionally delete old tool executor if replaced
# rm frontend/src/commands/tool-executor.js
```

---

## ✅ VALIDATION GATES

### Library Build Validation

```bash
# Navigate to library
cd map-ai-tools

# TypeScript compilation
npm run type-check
# Expected: No errors

# Build library
npm run build
# Expected: dist/esm/, dist/cjs/, dist/types/ created

# Verify ESM output
ls dist/esm/
# Expected: index.js, definitions/, executors/, prompts/, core/

# Verify CJS output
ls dist/cjs/
# Expected: index.js, definitions/, executors/, prompts/, core/

# Verify TypeScript definitions
ls dist/types/
# Expected: index.d.ts, core/, definitions/, executors/, prompts/

# Check package exports
node -e "console.log(require('./package.json').exports)"
# Expected: JSON with conditional exports
```

### Library Import Validation (Node.js)

```bash
# Test CommonJS import
node -e "const lib = require('./dist/cjs/index.js'); console.log(Object.keys(lib));"
# Expected: Array of exported functions/classes

# Test ES Module import
node --input-type=module -e "import * as lib from './dist/esm/index.js'; console.log(Object.keys(lib));"
# Expected: Array of exported functions/classes
```

### Backend Integration Validation

```bash
# Navigate to backend
cd ../backend

# Link library (if testing locally)
npm link @map-tools/ai-tools

# TypeScript compilation
npx tsc --noEmit
# Expected: No errors

# Start server
npm run dev
# Expected: Server starts, no import errors, tools loaded from library

# Check tool definitions are loaded
curl http://localhost:3000/health
# Expected: {"status":"ok",...}
```

### Frontend Integration Validation

```bash
# Navigate to frontend
cd ../frontend

# Link library (if testing locally)
npm link @map-tools/ai-tools

# Start dev server
npm run dev
# Expected: Vite dev server starts, no import errors

# Open browser console
# Expected: No module resolution errors
```

### End-to-End Integration Testing

**Test Checklist:**

1. **Backend Tool Definitions**
   - [ ] OpenAI receives correct tool schemas from library
   - [ ] System prompt includes tool descriptions from library
   - [ ] City coordinates are passed to prompt generator

2. **Frontend Tool Execution**
   - [ ] Send "zoom in" → Library executes zoom_map → Map zooms in
   - [ ] Send "show me New York" → Library executes fly_to_location → Map flies to NYC
   - [ ] Send "hide points" → Library executes toggle_layer → Points disappear
   - [ ] All executions return proper ExecutionResult objects

3. **Custom Tools Extension**
   - [ ] Add custom tool to library config
   - [ ] Custom tool executor is called correctly
   - [ ] Custom tool shows in available tools list

4. **Interceptors**
   - [ ] beforeExecute hook fires before tool runs
   - [ ] afterExecute hook fires with result
   - [ ] onError hook fires on execution failure

5. **Parameter Validation**
   - [ ] Invalid parameters rejected with clear error message
   - [ ] Missing required parameters detected
   - [ ] Type mismatches caught

6. **Backwards Compatibility**
   - [ ] All existing map commands still work
   - [ ] Chat UI shows tool confirmations
   - [ ] No regression in streaming or conversation context

### Bundle Size Validation

```bash
# Check bundle size
cd map-ai-tools
npm run build

# Check ESM bundle size
du -sh dist/esm/
# Expected: < 15KB (uncompressed)

# Check CJS bundle size
du -sh dist/cjs/
# Expected: < 15KB (uncompressed)

# Tree-shake test (if using Rollup in consumer)
# Import only one tool and check final bundle
```

---

## ⚠️ GOTCHAS & COMMON PITFALLS

### Critical Issues to Avoid

1. **Dual Package Hazard**
   - ❌ WRONG: Both ESM and CJS versions loaded in same app
   - ✅ CORRECT: Use conditional exports properly, avoid mixing
   - **Why**: Can cause duplicate instances and state issues
   - **Solution**: Test with `npm ls @map-tools/ai-tools` to verify single resolution

2. **IMapController Interface Mismatch**
   - ❌ WRONG: MapController doesn't implement all interface methods
   - ✅ CORRECT: Ensure MapController implements IMapController exactly
   - **Why**: TypeScript won't catch duck-typing issues at runtime
   - **Solution**: Add type assertion in integration code

3. **Rollup External Dependencies**
   - ❌ WRONG: Bundling large dependencies (deck.gl, maplibre)
   - ✅ CORRECT: Keep external array empty, document peer dependencies
   - **Why**: Library should be dependency-free for minimal bundle
   - **Solution**: Document that map controller is user-provided

4. **Module Resolution in Tests**
   - ❌ WRONG: Tests import from `src/` directly
   - ✅ CORRECT: Tests import from `dist/` after build
   - **Why**: Need to test actual published artifacts
   - **Solution**: Add `npm run build` to test script

5. **TypeScript Declaration Files**
   - ❌ WRONG: Missing or incorrect .d.ts files
   - ✅ CORRECT: Run `tsc` with `declaration: true` for ESM build only
   - **Why**: CJS doesn't need separate declarations if using same .d.ts
   - **Solution**: Use Rollup plugin-typescript with proper config

6. **Circular Dependencies**
   - ❌ WRONG: index.ts imports from files that import from index.ts
   - ✅ CORRECT: Strict one-way imports (leaf → root)
   - **Why**: Can break tree-shaking and cause undefined exports
   - **Solution**: Use barrel exports carefully, prefer direct imports

7. **Context Object Mutation**
   - ❌ WRONG: Executors mutate the shared context object
   - ✅ CORRECT: Executors are pure functions, no side effects on context
   - **Why**: Can cause race conditions with concurrent executions
   - **Solution**: Document immutability requirement

8. **Error Handling in Async Executors**
   - ❌ WRONG: Unhandled promise rejections in executors
   - ✅ CORRECT: All async executors wrapped in try-catch
   - **Why**: Can crash the application or lose error context
   - **Solution**: Template shows proper error handling

9. **Package.json "files" Field**
   - ❌ WRONG: Including src/, tests/, config files
   - ✅ CORRECT: Only include dist/ and docs
   - **Why**: Bloats published package size
   - **Solution**: Use .npmignore or "files" whitelist

10. **Validation Performance**
    - ❌ WRONG: Complex regex or deep validation on every execution
    - ✅ CORRECT: Basic type/range checks, rely on schema
    - **Why**: Adds latency to tool execution
    - **Solution**: Keep validation lightweight

### Integration Pitfalls

11. **Frontend Module Format**
    - ❌ WRONG: Vite configured for CommonJS
    - ✅ CORRECT: Vite uses ESM by default, import from 'esm' export
    - **Why**: Mixing formats breaks hot reload and tree-shaking

12. **Backend require() vs import**
    - ❌ WRONG: Mixing require() and import in same file
    - ✅ CORRECT: Backend uses CommonJS (require), or ESM (import)
    - **Why**: Current backend is CommonJS (tsconfig: "module": "commonjs")

13. **City Coordinates Sync**
    - ❌ WRONG: Different city lists in backend vs frontend
    - ✅ CORRECT: Both import from same source or library
    - **Why**: Causes "location not found" errors

14. **Interceptor Async Issues**
    - ❌ WRONG: Interceptor returns promise but not awaited
    - ✅ CORRECT: All interceptors properly awaited in executor
    - **Why**: Tool execution completes before interceptor side effects

### Testing Pitfalls

15. **Mock Map Controller**
    - Must implement ALL IMapController methods
    - Use jest.fn() or similar for spying on calls
    - Don't forget edge cases (undefined zoom, invalid coords)

16. **Integration Tests**
    - Test with REAL built artifacts (dist/), not source
    - Test both ESM and CJS imports separately
    - Test in Node.js and browser environments

---

## 📚 DOCUMENTATION REFERENCES

### OpenAI Function Calling
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Tools API](https://platform.openai.com/docs/api-reference/chat/create#chat-create-tools)

### Rollup & Module Bundling
- [Rollup Documentation](https://rollupjs.org/)
- [Building Universal npm Libraries (ESM + CJS)](https://dev.to/ekalkutin/building-universal-npm-libraries-supporting-both-cjs-and-esm-50lb)
- [Package Exports Support in Node.js](https://nodejs.org/api/packages.html#packages_conditional_exports)

### Isomorphic JavaScript
- [Five Challenges to Building an Isomorphic JavaScript Library (DoorDash)](https://doordash.engineering/2022/12/06/five-challenges-to-building-an-isomorphic-javascript-library/)
- [Package.json Exports Field Guide](https://hirok.io/posts/package-json-exports)

### TypeScript Library Development
- [TypeScript Handbook - Declaration Files](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)

### Testing Resources
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Packages](https://kentcdodds.com/blog/how-to-test-a-library)

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Library Scaffolding
- [ ] Create map-ai-tools directory
- [ ] Initialize npm package
- [ ] Create directory structure
- [ ] Install dev dependencies
- [ ] Configure package.json with exports
- [ ] Create rollup.config.js
- [ ] Create tsconfig.json
- [ ] Add .gitignore and .npmignore

### Phase 2: Core Types
- [ ] Define IMapController interface
- [ ] Define ToolDefinition type
- [ ] Define ToolExecutor type signature
- [ ] Define ExecutionContext and ExecutionResult
- [ ] Define CustomToolDefinition for extensions
- [ ] Define ToolInterceptors
- [ ] Define MapToolsConfig
- [ ] Define PromptConfig

### Phase 3: Tool Definitions
- [ ] Migrate ZOOM_MAP_TOOL definition
- [ ] Migrate FLY_TO_LOCATION_TOOL definition
- [ ] Migrate TOGGLE_LAYER_TOOL definition
- [ ] Create BUILTIN_TOOLS registry
- [ ] Create getToolDefinitions() function
- [ ] Export all definitions from index

### Phase 4: Tool Executors
- [ ] Create executeZoom function
- [ ] Create executeFlyTo function
- [ ] Create executeToggleLayer function
- [ ] Create BUILTIN_EXECUTORS registry
- [ ] Add error handling to all executors
- [ ] Export all executors from index

### Phase 5: System Prompts
- [ ] Create BASE_SYSTEM_PROMPT template
- [ ] Create generateToolDescriptions()
- [ ] Create generateCityCoordinatesSection()
- [ ] Create getSystemPrompt() builder
- [ ] Export all prompt functions

### Phase 6: Core Registry & Factory
- [ ] Implement ToolRegistry class
- [ ] Add registerTool() method
- [ ] Add removeTool() method
- [ ] Add getAllTools() method
- [ ] Create validateParameters() function
- [ ] Implement MapToolsExecutor class
- [ ] Add execute() method with interceptors
- [ ] Add getAvailableTools() method

### Phase 7: Main Entry Point
- [ ] Create src/index.ts
- [ ] Re-export all types
- [ ] Re-export definitions
- [ ] Re-export executors
- [ ] Re-export prompts
- [ ] Re-export core classes
- [ ] Create createMapTools() factory

### Phase 8: Build & Package
- [ ] Run npm run build
- [ ] Verify dist/esm/ output
- [ ] Verify dist/cjs/ output
- [ ] Verify dist/types/ output
- [ ] Create README.md
- [ ] Create LICENSE file
- [ ] Test npm link locally

### Phase 9: Integration
- [ ] Update backend package.json
- [ ] Replace backend/tool-definitions.ts
- [ ] Update backend/openai-service.ts
- [ ] Update frontend package.json
- [ ] Replace or adapt frontend/tool-executor.js
- [ ] Update frontend/main.js
- [ ] Remove old tool definition files
- [ ] Test backend integration
- [ ] Test frontend integration
- [ ] Test end-to-end flow

### Validation & Testing
- [ ] TypeScript compilation passes
- [ ] Library builds without errors
- [ ] ESM import works in Node.js
- [ ] CJS require works in Node.js
- [ ] Frontend imports library correctly
- [ ] Backend imports library correctly
- [ ] All existing map commands work
- [ ] Tool execution returns correct results
- [ ] Parameter validation catches errors
- [ ] Interceptors fire correctly
- [ ] Bundle size is acceptable (<15KB)

---

## 🎯 SUCCESS CRITERIA

### Must Have
1. ✅ Library builds successfully (ESM + CJS)
2. ✅ Backend can import and use tool definitions
3. ✅ Frontend can import and execute tools
4. ✅ All existing map commands work without regression
5. ✅ Type definitions included and correct
6. ✅ Zero runtime dependencies

### Should Have
1. ✅ Custom tools can be added via config
2. ✅ Interceptors work for hooks
3. ✅ Parameter validation catches errors
4. ✅ Bundle size < 15KB uncompressed
5. ✅ README with usage examples

### Nice to Have
1. ⚪ Unit tests for executors
2. ⚪ Integration tests
3. ⚪ API documentation site
4. ⚪ Published to npm registry

---

## 📊 CONFIDENCE SCORE BREAKDOWN

**Overall: 8/10**

**Strengths (+):**
- Clear migration path from existing code ✅
- Well-defined interfaces and types ✅
- Rollup configuration tested and proven ✅
- Isomorphic patterns well-documented ✅
- Existing code provides complete reference ✅

**Risks (-):**
- Module resolution issues in complex projects (-1)
- TypeScript configuration edge cases (-1)
- Potential peer dependency conflicts (manageable)

**Mitigations:**
- Extensive validation gates
- Testing with both ESM and CJS
- Clear documentation of gotchas
- Local testing before publish

---

## ⏱️ ESTIMATED TIMELINE

- **Phase 1**: Library Scaffolding → 2-3 hours
- **Phase 2**: Core Types → 2 hours
- **Phase 3**: Tool Definitions → 2-3 hours
- **Phase 4**: Tool Executors → 3-4 hours
- **Phase 5**: System Prompts → 1-2 hours
- **Phase 6**: Core Registry & Factory → 3-4 hours
- **Phase 7**: Main Entry Point → 1 hour
- **Phase 8**: Build & Package → 1-2 hours
- **Phase 9**: Integration → 4-5 hours
- **Testing & Validation**: 2-3 hours

**Total: 21-28 hours** (conservative estimate with testing)
**Focused implementation: 14-18 hours** (without comprehensive testing)

---

**END OF PRP-003**
