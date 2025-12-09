**Status**: Architectural Design Document **Version**: 3.0

## Executive Summary

This document defines the architecture for `@carto/maps-ai-tools`, a **monorepo library** designed to standardize AI tool definitions and communication between frontend and backend applications.

### Purpose

Create a unified library that enables any frontend application to:

* Define AI tools with JSON schemas for OpenAI function calling
* Standardize communication interfaces between frontend and backend
* Provide a dictionary of available tools for consistent naming
* Handle tool execution with consistent request/response patterns
* Include ready-to-use UI components for chat and map interactions

### Monorepo Structure

```
@carto/maps-ai-tools/
├── definitions/   # JSON schemas + tools dictionary
└── executors/     # Communication utilities
```

### Key Architectural Principles


1. **Standardized Tool Definitions**: All tools defined via JSON schemas with a centralized dictionary
2. **Unified Communication Interface**: Standard request/response patterns between frontend and backend
3. **[Deck.gl](http://Deck.gl) Focused**: Optimized for [deck.gl](http://deck.gl) as CARTO's primary map engine
4. **Framework Agnostic**: Works with React, Vue, Angular, VanillaJS
5. **Backend Independence**: Frontend-tools library works with any backend implementation approach

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Package: definitions](#package-definitions)
3. [Schema Definition Approaches](#schema-definition-approaches)
   - [Option A: Zod-Based Approach (Recommended)](#option-a-zod-based-approach-recommended)
   - [Option B: JSON Schema Approach](#option-b-json-schema-approach)
4. [Pros and Cons](#pros-and-cons)
5. [Package: executors](#package-executors)
6. [Communication Flow](#communication-flow)
7. [Frontend Integration](#frontend-integration)
8. [Backend Integration](#backend-integration-tbd)
9. [Custom Tools](#custom-tools-tbd)
10. [Installation & Getting Started](#installation--getting-started)
11. [Benefits](#benefits)

## Architecture Overview

### Package Structure

```mermaid
graph LR
    subgraph maps-ai-tools[maps-ai-tools monorepo]
        A[maps-ai-tools] --> B[definitions]
        A --> C[executors]

        B --> B1[tools]
        B --> B2[types]

        C --> C1[interface]
        C --> C2[send]
    end
```

### Three-Layer System

```
┌───────────────────────────────────────────────────┐
│  Client Layer (Application)                       │
│  • React/Vue/Angular/VanillaJS apps               │
│  • Executes tools via standardized interface      │
│  • deck.gl for map visualization                  │
└───────────────────────────────────────────────────┘
                       ↕
┌───────────────────────────────────────────────────┐
│  maps-ai-tools Layer (Monorepo Library)           │
│  • definitions: Tool schemas & dictionary         │
│  • executors: Communication interface             │
└───────────────────────────────────────────────────┘
                       ↕
┌───────────────────────────────────────────────────┐
│  Backend Layer (AI API) _TBD_                     │
│  • Uses tool definitions from library OR via API  │
│  • OpenAI Integration with function calling       │
│  • Returns standardized ToolResponse              │
└───────────────────────────────────────────────────┘
```

## Package: definitions

This package contains all tool definitions, JSON schemas, and the tools dictionary.

### Purpose

* Define the structure and validation rules for each tool
* Provide a centralized tools dictionary for consistent naming
* Export TypeScript types for type-safe tool usage

### Schema Definition Approaches

This section compares two approaches for defining tool schemas. **We recommend Option A (Zod)** for new implementations.

#### Decision Matrix

| Criteria | Zod (Recommended) | JSON Schema |
|----------|-------------------|-------------|
| Type Safety | Automatic inference | Manual maintenance |
| Validation | Built-in | Custom implementation |
| OpenAI Compatibility | Native via `z.toJsonSchema()` | Native |
| Bundle Size | +~50KB | None |
| Developer Experience | Excellent | Good |
| Error Messages | Rich, automatic | Manual formatting |
| Schema Composition | Native (extend, merge) | Manual |

#### Option A: Zod-Based Approach (Recommended)

[Zod](https://zod.dev/) is a TypeScript-first schema declaration and validation library. It provides a single source of truth for schemas, types, and validation.

##### Package Structure with Zod

```
definitions/
├── src/
│   ├── schemas/
│   │   ├── fly-to.ts           # Zod schema + exported type
│   │   ├── zoom-map.ts
│   │   ├── toggle-layer.ts
│   │   └── index.ts            # Re-exports all schemas
│   ├── dictionary.ts           # Tool name constants + schema registry
│   └── index.ts
└── package.json
```

##### Schema Definition with Zod

```typescript
// definitions/src/schemas/fly-to.ts
import { z } from 'zod';

// Complete tool definition - schema, name, and description in one place
export const flyToTool = {
  name: 'fly-to',
  description: 'Fly the map to a specific location with smooth animation',
  schema: z.object({
    lat: z.number().min(-90).max(90).describe('Latitude coordinate (-90 to 90)'),
    lng: z.number().min(-180).max(180).describe('Longitude coordinate (-180 to 180)'),
    zoom: z.number().min(0).max(22).default(12).describe('Zoom level (0 to 22)'),
  }),
} as const;

// Automatic type inference - NO manual interface needed!
export type FlyToParams = z.infer<typeof flyToTool.schema>;
// Result: { lat: number; lng: number; zoom: number }

// Convert to OpenAI function calling format (native Zod JSON Schema)
export const flyToDefinition = {
  type: 'function' as const,
  function: {
    name: flyToTool.name,
    description: flyToTool.description,
    parameters: z.toJsonSchema(flyToTool.schema),
  },
};
```

##### Full Dictionary Implementation with Zod

```typescript
// definitions/src/tools.ts
import { z } from 'zod';

// Complete tool definitions - name, description, and schema together
export const tools = {
  'fly-to': {
    name: 'fly-to',
    description: 'Fly the map to a specific location with smooth animation',
    schema: z.object({
      lat: z.number().min(-90).max(90).describe('Latitude coordinate'),
      lng: z.number().min(-180).max(180).describe('Longitude coordinate'),
      zoom: z.number().min(0).max(22).default(12).describe('Zoom level'),
    }),
  },
  'zoom-map': {
    name: 'zoom-map',
    description: 'Zoom the map in or out by a specified number of levels',
    schema: z.object({
      direction: z.enum(['in', 'out']).describe('Zoom direction'),
      levels: z.number().int().min(1).max(10).default(1).describe('Number of zoom levels'),
    }),
  },
  'toggle-layer': {
    name: 'toggle-layer',
    description: 'Show or hide a specific layer on the map',
    schema: z.object({
      layerId: z.string().describe('Layer identifier'),
      visible: z.boolean().describe('Visibility state'),
    }),
  },
} as const;

// Type-safe tool names
export type ToolName = keyof typeof tools;

// Inferred types for each tool - automatically derived!
export type FlyToParams = z.infer<typeof tools['fly-to']['schema']>;
export type ZoomMapParams = z.infer<typeof tools['zoom-map']['schema']>;
export type ToggleLayerParams = z.infer<typeof tools['toggle-layer']['schema']>;

// Helper to convert all tools to OpenAI format
export function getAllToolDefinitions() {
  return Object.values(tools).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: z.toJsonSchema(tool.schema),
    },
  }));
}

// Get single tool definition for OpenAI
export function getToolDefinition(name: ToolName) {
  const tool = tools[name];
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: z.toJsonSchema(tool.schema),
    },
  };
}

// Get tool for validation
export function getTool(name: ToolName) {
  return tools[name];
}
```

##### Validation with Zod

With Zod, validation is built-in and returns typed results:

```typescript
// Validation is automatic and type-safe
import { tools, ToolName } from '@carto/maps-ai-tools/definitions';

function validateToolCall(toolName: ToolName, params: unknown) {
  const tool = tools[toolName];
  const result = tool.schema.safeParse(params);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(issue =>
        `${issue.path.join('.')}: ${issue.message}`
      ),
    };
  }

  // result.data is fully typed as the specific tool params
  return { valid: true, data: result.data };
}

// Usage example
const result = validateToolCall('fly-to', { lat: 40.7128, lng: -74.006 });
if (result.valid) {
  // result.data is typed as FlyToParams
  console.log(result.data.lat, result.data.lng, result.data.zoom);
}
```

##### Backend Integration with Zod

```typescript
// backend/services/openai-service.ts
import OpenAI from 'openai';
import { getAllToolDefinitions, tools, ToolName } from '@carto/maps-ai-tools/definitions';

const openai = new OpenAI();

// Get OpenAI-compatible tool definitions
const toolDefinitions = getAllToolDefinitions();

// Process chat with validation
async function handleChat(userMessage: string) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a map assistant.' },
      { role: 'user', content: userMessage },
    ],
    tools: toolDefinitions,  // OpenAI-compatible from Zod
    tool_choice: 'auto',
  });

  const choice = completion.choices[0];

  if (choice.message.tool_calls) {
    const toolCall = choice.message.tool_calls[0];
    const toolName = toolCall.function.name as ToolName;
    const params = JSON.parse(toolCall.function.arguments);

    // Validate with Zod
    const tool = tools[toolName];
    const result = tool.schema.safeParse(params);

    if (!result.success) {
      return {
        toolName,
        error: {
          code: 'VALIDATION_ERROR',
          message: result.error.issues.map(i => i.message).join(', '),
        },
      };
    }

    return {
      toolName,
      data: result.data,  // Typed and validated
      message: `Executing ${toolName}`,
    };
  }

  return { message: choice.message.content };
}
```

#### Option B: JSON Schema Approach

This is the traditional approach using JSON files for schema definitions.

##### Package Structure with JSON

```
definitions/
├── src/
│   ├── schemas/
│   │   ├── fly-to.schema.json
│   │   ├── zoom-map.schema.json
│   │   └── toggle-layer.schema.json
│   ├── dictionary.ts           # Tool name constants
│   ├── types.ts                # Manual TypeScript interfaces
│   ├── validators.ts           # Custom validation logic
│   └── index.ts
└── package.json
```

##### Type Definitions (Manual)

With JSON schemas, types must be maintained separately:

```typescript
// definitions/src/types.ts - Must be kept in sync with JSON schemas manually

export interface ToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ParameterSchema>;
      required?: string[];
    };
  };
}


export interface FlyToParams {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface ZoomMapParams {
  direction: 'in' | 'out';
  levels?: number;
}

export interface ToggleLayerParams {
  layerId: string;
  visible: boolean;
}
```

##### Custom Validation (Required)

```typescript
// definitions/src/validators.ts - Must implement validation manually

export function validateToolCall(
  toolName: string,
  params: Record<string, unknown>
): { valid: boolean; errors?: string[] } {
  const schema = toolsDictionary.get(toolName);

  if (!schema) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];
  const { properties, required = [] } = schema.function.parameters;

  // Check required parameters
  for (const param of required) {
    if (!(param in params)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  // Type and range validation - must implement for each type
  for (const [name, value] of Object.entries(params)) {
    const propSchema = properties[name];
    if (propSchema) {
      if (propSchema.type === 'number' && typeof value !== 'number') {
        errors.push(`Parameter ${name} must be a number`);
      }
      if (typeof value === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          errors.push(`Parameter ${name} must be >= ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          errors.push(`Parameter ${name} must be <= ${propSchema.maximum}`);
        }
      }
      // ... more validation logic needed
    }
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}
```

#### Comparison: Types and Validation

| Aspect | Zod | JSON Schema |
|--------|-----|-------------|
| **Type Definition** | `z.infer<typeof schema>` (automatic) | Manual interface |
| **Type Sync** | Always in sync | Risk of drift |
| **Validation** | `schema.safeParse(data)` | Custom function |
| **Error Format** | Structured `ZodError` | Manual formatting |
| **Default Values** | `z.default(value)` | Handled at runtime |
| **Transformations** | `z.transform()` built-in | Custom logic |

### Pros and Cons

#### Zod Approach

##### Pros

* **Single Source of Truth**: Schema, types, and validation are all derived from one definition
* **Automatic Type Inference**: No manual TypeScript interfaces needed - `z.infer<typeof schema>` generates types
* **Rich Validation**: Built-in validators for all common patterns (min, max, regex, email, url, etc.)
* **Detailed Error Messages**: Structured `ZodError` with path, code, and message for each issue
* **Composable Schemas**: Native support for `extend()`, `merge()`, `pick()`, `omit()`, `partial()`
* **Transformations**: Built-in `transform()` and `coerce` for data normalization
* **IDE Support**: Excellent autocomplete and IntelliSense due to TypeScript-first design
* **No Runtime Type Mismatches**: Types are guaranteed to match validation at compile time
* **Active Ecosystem**: Large community with integrations (React Hook Form, tRPC, etc.)

##### Cons

* **Bundle Size**: Adds ~50KB to the bundle (12KB gzipped)
* **Learning Curve**: Developers need to learn Zod API
* **Extra Dependency**: Requires `zod` package (but JSON Schema conversion is native)

#### JSON Schema Approach

##### Pros

* **Standard Format**: JSON Schema is a widely adopted standard
* **OpenAI Native**: OpenAI function calling accepts JSON Schema directly
* **No Dependencies**: No additional libraries required
* **Simple for Basic Schemas**: Easy to understand for straightforward definitions
* **Language Agnostic**: JSON files can be shared across different programming languages
* **Direct Editing**: Non-developers can edit JSON files

##### Cons

* **Type Drift Risk**: TypeScript interfaces must be manually synchronized with JSON schemas
* **Custom Validation Required**: Must implement validators from scratch
* **Verbose for Complex Schemas**: Nested objects and arrays become unwieldy in JSON
* **No Composition**: Cannot easily extend or merge schemas
* **Manual Error Messages**: Must format validation errors manually
* **No Transformations**: Data normalization requires separate logic
* **Maintenance Burden**: Three artifacts to maintain (JSON, types, validators)

## Package: executors

This package provides utility functions to standardize communication between frontend and backend.

### Purpose

- Define standard request/response interfaces
- Standardize backend communication
- Handle validation and error formatting

### Package Structure

```
executors/
├── src/
│   ├── interface.ts       # Standard communication interface
│   ├── send.ts            # Backend request function
│   ├── validators.ts      # Input/output validators
│   ├── errors.ts          # Error handling utilities
│   └── index.ts
└── package.json
```

### Standard Communication Interface

```typescript
// utils/src/interface.ts

export interface ToolRequest {
  toolName: string;
  params: Record<string, unknown>;
}

export interface ToolResponse<T = unknown> {
  toolName: string;
  data?: T;
  message?: string;
  error?: ToolError;
}

export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}
```

### Send Function

```typescript
// utils/src/send.ts

import { ToolRequest, ToolResponse } from "./interface";

export interface SendOptions {
  baseUrl: string;
  endpoint?: string;
  headers?: Record<string, string>;
}

export async function send<T = unknown>(
  request: ToolRequest,
  options: SendOptions
): Promise<ToolResponse<T>> {
  const { baseUrl, endpoint = "/api/chat", headers = {} } = options;

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return {
        toolName: request.toolName,
        error: {
          code: "HTTP_ERROR",
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }

    const response = await response.json();

    return {
      toolName: request.toolName,
      data: response.data,
      message: response.message,
    };
  } catch (error) {
    return {
      toolName: request.toolName,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}
```

### Validators

```typescript
// utils/src/validators.ts

import { toolsDictionary } from "@carto/maps-ai-tools/definitions";

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateToolCall(
  toolName: string,
  params: Record<string, unknown>
): ValidationResult {
  const schema = toolsDictionary.get(toolName);

  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown tool: ${toolName}`],
    };
  }

  const errors: string[] = [];
  const { properties, required = [] } = schema.function.parameters;

  // Check required parameters
  for (const param of required) {
    if (!(param in params)) {
      errors.push(`Missing required parameter: ${param}`);
    }
  }

  // Validate parameter types and constraints
  for (const [name, value] of Object.entries(params)) {
    const propSchema = properties[name];
    if (propSchema) {
      // Type checking
      if (propSchema.type === "number" && typeof value !== "number") {
        errors.push(`Parameter ${name} must be a number`);
      }
      // Range checking
      if (typeof value === "number") {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          errors.push(`Parameter ${name} must be >= ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          errors.push(`Parameter ${name} must be <= ${propSchema.maximum}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### Error Handling

```typescript
// utils/src/errors.ts

import { ToolError, ToolResponse } from "./interface";

// Common error codes
export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TOOL_NOT_FOUND: "TOOL_NOT_FOUND",
  EXECUTION_ERROR: "EXECUTION_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

// Handle error
// TBD
export function formatToolResponse<T = unknown>(
  toolName: string,
  response: Partial<ToolResponse<T>>
): ToolResponse<T> {
  return {
    toolName,
    data: response.data,
    message: response.message,
    error: response.error,
  };
}
```

## Communication Flow

### Sequence Diagram

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant LIB as maps-ai-tools
    participant BE as Backend
    participant AI as AI Model

    LIB->>FE: Import definitions & utils
    LIB->>BE: Import definitions & utils

    FE->>BE: User Prompt
    BE->>AI: System Prompt + User Prompt + Tool Definitions
    AI->>BE: Tool Call (JSON)
    BE->>LIB: Validate with schema
    LIB->>BE: Validated params
    BE->>BE: Execute tool
    BE->>LIB: Standard Response (toolName, data, message)
    LIB->>FE: Standard Response (toolName, data, message)
    FE->>FE: Execute in UI (e.g., fly-to, add marker)
```

### Message Types

#### User Prompt (Frontend → Backend)

```typescript
{
  type: 'chat_message',
  content: 'Fly to New York City and zoom in',
  timestamp: 1706300000000
}
```

#### Tool Call Response (Backend → Frontend)

```typescript
{
  toolName: 'fly-to',
  data: {
    lat: 40.7128,
    lng: -74.0060,
    zoom: 12
  },
  message: 'Flying to New York City'
}
```

#### Error Response

```typescript
{
  toolName: 'fly-to',
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid coordinates: latitude must be between -90 and 90'
  }
}
```

## Frontend Integration

### Setup with Executors

```typescript
import { Deck } from "@deck.gl/core";
import { toolsDictionary } from "@carto/maps-ai-tools/definitions";
import { parseToolResponse, send } from "@carto/maps-ai-tools/executors";

// Initialize deck.gl

const deck = new Deck({
  canvas: "map",
  initialViewState: { longitude: -122.4, latitude: 37.8, zoom: 10 },
});

// Define executors for each tool

const executors: Record<string, (params: any) => void> = {
  [toolsDictionary.flyTo]: (params) => {
    deck.setProps({
      initialViewState: {
        longitude: params.lng,
        latitude: params.lat,
        zoom: params.zoom || 12,
        transitionDuration: 1000,
      },
    });
  },

  [toolsDictionary.zoomMap]: (params) => {
    const currentZoom = deck.props.initialViewState?.zoom || 10;
    const newZoom =
      params.direction === "in"
        ? currentZoom + params.levels
        : currentZoom - params.levels;

    deck.setProps({
      initialViewState: {
        ...deck.props.initialViewState,
        zoom: Math.max(0, Math.min(22, newZoom)),
        transitionDuration: 500,
      },
    });
  },

  [toolsDictionary.toggleLayer]: (params) => {
    const layers = deck.props.layers || [];
    const updatedLayers = layers.map((layer: any) =>
      layer.id === params.layerId
        ? layer.clone({ visible: params.visible })
        : layer
    );
    deck.setProps({ layers: updatedLayers });
  },
};

// Handle tool responses from backend

async function handleToolResponse(response: ToolResponse) {
  const { toolName, data, error } = parseToolResponse(response);

  if (error) {
    console.error(`Tool error: ${error.message}`);
    return;
  }

  const executor = executors[toolName];
  if (executor && data) {
    executor(data);
  }
}

// Connect to backend

const chat = document.querySelector("maps-chat-container");

chat.onSend(async (message) => {
  const response = await send(
    { toolName: "", params: { message } },
    { baseUrl: "http://localhost:3000", endpoint: "/api/chat" }
  );

  if (response.toolName) {
    await handleToolResponse(response);
  }
});
```

### React Integration Example

```tsx
import { useEffect, useRef, useCallback } from "react";
import { Deck } from "@deck.gl/core";
import { toolsDictionary } from "@carto/maps-ai-tools/definitions";
import { parseToolResponse } from "@carto/maps-ai-tools/executors";

function MapApp() {
  const deckRef = useRef<Deck | null>(null);

  const executors = useCallback(
    () => ({
      [toolsDictionary.flyTo]: (params: any) => {
        deckRef.current?.setProps({
          initialViewState: {
            longitude: params.lng,
            latitude: params.lat,
            zoom: params.zoom,
            transitionDuration: 1000,
          },
        });
      },
      // ... more executors
    }),
    []
  );

  const handleToolResponse = useCallback(
    (response: any) => {
      const { toolName, data, error } = parseToolResponse(response);
      if (!error && data) {
        executors()[toolName]?.(data);
      }
    },
    [executors]
  );

  return (
    <div>
      <canvas id="map" />
      <maps-chat-container />
    </div>
  );
}
```

## Backend Integration TBD

Two approaches are supported for integrating the library with your backend.

### Approach 1: Library Import

Import the definitions package directly in your backend:

```typescript
// Backend code

import { toolsDictionary, getToolDefinitions } from '@carto/maps-ai-tools/definitions';
import { validateToolCall, formatToolResponse } from '@carto/maps-ai-tools/executors';

// Get definitions for AI model
const definitions = getToolDefinitions();

// Build system prompt with tool definitions
const systemPrompt = `You have access to these tools: ${JSON.stringify(definitions)}`;

// Process AI response
async function processAIToolCall(toolCall: { name: string; arguments: string }) {
  const params = JSON.parse(toolCall.arguments);
  const validated = validateToolCall(toolCall.name, params);

  if (!validated.valid) {
    return formatToolResponse(toolCall.name, {
      error: {
        code: 'VALIDATION_ERROR',
        message: validated.errors?.join(', ') || 'Validation failed'
      }
    });
  }

  // Return validated params to frontend for execution
  return formatToolResponse(toolCall.name, {
    data: params,
    message: `Executing ${toolCall.name}`
  });
}

// OpenAI integration

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  tools: schemas,  // Use schemas from library
  tool_choice: 'auto'
});
```

### Approach 2: API Request

Backend exposes tool definitions via REST API, no library import needed:

```typescript
// Backend exposes endpoint

app.get("/api/tools/definitions", (req, res) => {
  // Definitions defined manually or loaded from JSON files
  res.json({
    tools: [
      {
        type: "function",
        function: {
          name: "fly-to",
          description: "Fly to a location",
          parameters: {
            /* ... */
          },
        },
      },
      // ... more tools
    ],
  });
});

// Frontend fetches definitions

const response = await fetch("/api/tools/definitions");
const { tools } = await response.json();
```

### Backend Example (Express + OpenAI)

```typescript
import express from "express";
import OpenAI from "openai";
import { getToolDefinitions } from "@carto/maps-ai-tools/definitions";
import {
  validateToolCall,
  formatToolResponse,
} from "@carto/maps-ai-tools/utils";

const app = express();
const openai = new OpenAI();

// Expose tool definitions

app.get("/api/tools/definitions", (req, res) => {
  res.json({ tools: getToolDefinitions() });
});

// Handle chat messages

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a map assistant..." },
      { role: "user", content: message },
    ],
    tools: getToolDefinitions(),
    tool_choice: "auto",
  });

  const choice = completion.choices[0];

  if (choice.message.tool_calls) {
    const toolCall = choice.message.tool_calls[0];
    const params = JSON.parse(toolCall.function.arguments);

    // Validate and return to frontend
    const validated = validateToolCall(toolCall.function.name, params);

    if (validated.valid) {
      res.json(
        formatToolResponse(toolCall.function.name, {
          success: true,
          data: params,
        })
      );
    } else {
      res.json(
        formatToolResponse(toolCall.function.name, {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validated.errors?.join(", "),
          },
        })
      );
    }
  } else {
    res.json({ message: choice.message.content });
  }
});
```

## Custom Tools TBD 

Extend the library with your own custom tools.

### Custom Tool Definition

```typescript
// custom-tools.ts

import type { ToolSchema } from "@carto/maps-ai-tools/definitions";

export const customToolSchema: ToolSchema = {
  type: "function",
  function: {
    name: "highlight-feature",
    description: "Highlight a specific feature on the map",
    parameters: {
      type: "object",
      properties: {
        featureId: {
          type: "string",
          description: "The ID of the feature to highlight",
        },
        color: {
          type: "string",
          description: "Highlight color in hex format",
          default: "#FF0000",
        },
        duration: {
          type: "number",
          description: "Duration in milliseconds",
          default: 3000,
        },
      },
      required: ["featureId"],
    },
  },
};

// Custom tools dictionary

export const customDictionary = {
  highlightFeature: "highlight-feature",
  showPopup: "show-popup",
  measureDistance: "measure-distance",
} as const;
```

### Using Custom Tools

```typescript
import {
  toolsDictionary,
  getToolDefinition,
} from "@carto/maps-ai-tools/definitions";
import { customToolSchema, customDictionary } from "./custom-tools";

// Combine built-in and custom tools
const allDefinitions = [
  getToolDefinition(toolsDictionary.flyTo),
  getToolDefinition(toolsDictionary.zoomMap),
  customToolSchema,
];

// Combined executors
const allExecutors = {
  [toolsDictionary.flyTo]: (params) => {
    /* ... */
  },
  [toolsDictionary.zoomMap]: (params) => {
    /* ... */
  },
  [customDictionary.highlightFeature]: (params) => {
    // Custom executor implementation
    const { featureId, color, duration } = params;
    // ... highlight logic
  },
};
```

## Installation & Getting Started

### Installation

```bash
# Install the library
npm install @carto/maps-ai-tools
# or
yarn add @carto/maps-ai-tools
# or
pnpm add @carto/maps-ai-tools
```

### Quick Start (Frontend)

```typescript
// 1. Import packages

import { toolsDictionary } from "@carto/maps-ai-tools/definitions";
import { parseToolResponse, send } from "@carto/maps-ai-tools/executors";

// 2. Initialize deck.gl

import { Deck } from "@deck.gl/core";

const deck = new Deck({
  canvas: "map",
  initialViewState: { longitude: -74.0, latitude: 40.7, zoom: 10 },
});

// 3. Define executors

const executors = {
  [toolsDictionary.flyTo]: (params) => {
    deck.setProps({
      initialViewState: {
        longitude: params.lng,
        latitude: params.lat,
        zoom: params.zoom || 12,
        transitionDuration: 1000,
      },
    });
  },
  // ... more executors
};

// 4. Handle responses from backend

function handleToolResponse(response) {
  const { toolName, data, error } = parseToolResponse(response);
  if (executors[toolName] && !error) {
    executors[toolName](data);
  }
}
```

### Quick Start (Backend)

```typescript
// 1. Import packages

import { getToolDefinitions } from "@carto/maps-ai-tools/definitions";
import {
  validateToolCall,
  formatToolResponse,
} from "@carto/maps-ai-tools/executors";
import OpenAI from "openai";

// 2. Get tool schemas

const schemas = getToolDefinitions();

// 3. Use with OpenAI

const openai = new OpenAI();

async function handleChat(userMessage: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful map assistant." },
      { role: "user", content: userMessage },
    ],
    tools: schemas,
    tool_choice: "auto",
  });

  const choice = completion.choices[0];

  if (choice.message.tool_calls) {
    const toolCall = choice.message.tool_calls[0];
    const params = JSON.parse(toolCall.function.arguments);

    return formatToolResponse(toolCall.function.name, {
      success: true,
      data: params,
    });
  }

  return { message: choice.message.content };
}
```

## Benefits

### Standardization

* **Consistent tool naming** via tools dictionary
* **Uniform request/response format** across all tools
* **Type-safe** development with TypeScript interfaces

### Developer Experience

* **Validation helpers** catch errors before execution
* **Clear error messages** with standardized error codes

### Flexibility

* **Custom tools** can be added alongside built-in tools
* **Framework agnostic** works with any JavaScript framework
* **Backend choice** between library import or API approach

### Maintainability

* **Centralized definitions** make updates easy
* **Monorepo structure** allows independent versioning
* **Schema-driven** enables dynamic tool updates

