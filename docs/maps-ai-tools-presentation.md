---
marp: true
theme: default
paginate: true
backgroundColor: #fff
header: '@carto/maps-ai-tools'
footer: 'CARTO | Frontend Tools Architecture'
style: |
  section {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    padding-top: 70px;
    padding-bottom: 70px;
  }
  header {
    top: 15px;
  }
  footer {
    bottom: 15px;
  }
  h1 {
    color: #162945;
  }
  h2 {
    color: #2C3E50;
  }
  code {
    background-color: #f4f4f4;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  section.lead h1 {
    font-size: 2.5em;
  }
  section.title {
    text-align: center;
  }
---

<!-- _class: lead title -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# @carto/maps-ai-tools

## A Monorepo Library for AI-Powered Map Interactions

**Version 3.0** | Architectural Design Document

---

# Agenda

1. **Executive Summary** - What & Why
2. **Architecture Overview** - High-Level Design
3. **Package: definitions** - Tool Schemas & Dictionary
4. **Package: executors** - Communication Utilities
5. **Communication Flow** - Request/Response Patterns
6. **Frontend Integration** - Framework Agnostic
7. **Backend Integration TBD** - Two Approaches
8. **Custom Tools TBD** - Extending the Library
9. **Getting Started** - Quick Setup

---

# Executive Summary

## What is @carto/maps-ai-tools?

A **monorepo library** that standardizes AI tool definitions and communication between frontend and backend applications.

### Core Capabilities

- Define AI tools with JSON schemas for OpenAI function calling
- Standardize communication interfaces
- Provide a dictionary of available tools
- Handle tool execution with consistent patterns

---

# Key Architectural Principles

| Principle | Description |
|-----------|-------------|
| **Standardized Definitions** | All tools defined via JSON schemas |
| **Unified Communication** | Standard request/response patterns |
| **deck.gl Focused** | Optimized for CARTO's primary map engine |
| **Framework Agnostic** | Works with React, Vue, Angular, VanillaJS |
| **Backend Independence** | Works with any backend implementation |

---

# Monorepo Structure

```
@carto/maps-ai-tools/
├── definitions/   # JSON schemas + tools dictionary
└── executors/     # Communication utilities
```

### Two Main Packages

- **definitions**: Tool schemas, dictionary, TypeScript types
- **executors**: Send functions, validators, error handling

---

# Three-Layer Architecture

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
│  Backend Layer (AI API)                           │
│  • OpenAI Integration with function calling       │
│  • Returns standardized ToolResponse              │
└───────────────────────────────────────────────────┘
```

---

<!-- _class: lead -->

# Package: definitions

## Tool Schemas & Dictionary

---

# Package Structure: definitions

```
definitions/
├── src/
│   ├── schemas/
│   │   ├── fly-to.schema.json
│   │   ├── zoom-map.schema.json
│   │   └── toggle-layer.schema.json
│   ├── dictionary.ts      # Available tools registry
│   ├── get-definition.ts  # Get available definition
│   ├── types.ts           # TypeScript interfaces
│   └── index.ts
└── package.json
```

---

# Tools Dictionary

```typescript
export const TOOL_NAMES = {
  FLY_TO: 'fly-to',
  ZOOM_MAP: 'zoom-map',
  TOGGLE_LAYER: 'toggle-layer',
  ADD_MARKER: 'add-marker',
  REMOVE_MARKER: 'remove-marker',
} as const

export const toolsDictionary = {
  [TOOL_NAMES.FLY_TO]: () => import('..'),
  [TOOL_NAMES.ZOOM_MAP]: () => import('..'),
  [TOOL_NAMES.TOGGLE_LAYER]: () => import('..'),
  // ...
} as const
```

---

# JSON Schema Example

```json
{
  "type": "function",
  "function": {
    "name": "fly-to",
    "description": "Fly the map to a specific location",
    "parameters": {
      "type": "object",
      "properties": {
        "lat": {
          "type": "number",
          "description": "Latitude (-90 to 90)",
          "minimum": -90, "maximum": 90
        },
        "lng": {
          "type": "number",
          "description": "Longitude (-180 to 180)",
          "minimum": -180, "maximum": 180
        },
        "zoom": { "type": "number", "default": 12 }
      },
      "required": ["lat", "lng"]
    }
  }
}
```

---

# TypeScript Interfaces

```typescript
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

export interface FlyToResponse {
  lat: number;
  lng: number;
  zoom: number;
}
```

---

<!-- _class: lead -->

# Package: executors

## Communication Utilities

---

# Package Structure: executors

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

---

# Standard Communication Interface

```typescript
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

---

# Send Function

```typescript
export async function send<T = unknown>(
  request: ToolRequest,
  options: SendOptions
): Promise<ToolResponse<T>> {
  const { baseUrl, endpoint = "/api/chat" } = options;

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  return {
    toolName: request.toolName,
    data: (await response.json()).data,
  };
}
```

---

# Validators

```typescript
export function validateToolCall(
  toolName: string,
  params: Record<string, unknown>
): ValidationResult {
  const schema = toolsDictionary.get(toolName);

  if (!schema) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  // Check required parameters
  // Validate types and constraints
  // Return validation result
}
```

---

<!-- _class: lead -->

# Communication Flow

## Request/Response Patterns

---

# Sequence Diagram

```
Frontend          maps-ai-tools         Backend           AI Model
   │                   │                   │                  │
   │ Import definitions│                   │                  │
   │◄──────────────────│──────────────────►│                  │
   │                   │                   │                  │
   │ User Prompt ──────┼──────────────────►│                  │
   │                   │                   │ System + Tools──►│
   │                   │                   │◄─── Tool Call ───│
   │                   │◄── Validate ──────│                  │
   │◄── Tool Response ─┼───────────────────│                  │
   │                   │                   │                  │
   │ Execute in UI     │                   │                  │
```

---

# Message Types

### User Prompt (Frontend → Backend)
```typescript
{
  type: 'chat_message',
  content: 'Fly to New York City and zoom in',
  timestamp: 1706300000000
}
```

### Tool Call Response (Backend → Frontend)
```typescript
{
  toolName: 'fly-to',
  data: { lat: 40.7128, lng: -74.0060, zoom: 12 },
  message: 'Flying to New York City'
}
```

---

# Error Response

```typescript
{
  toolName: 'fly-to',
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid coordinates: latitude must be between -90 and 90'
  }
}
```

### Error Codes
- `VALIDATION_ERROR` - Invalid parameters
- `TOOL_NOT_FOUND` - Unknown tool name
- `EXECUTION_ERROR` - Runtime failure
- `NETWORK_ERROR` - Connection issues
- `UNAUTHORIZED` - Auth failure

---

<!-- _class: lead -->

# Frontend Integration

## Framework Agnostic

---

# Setup with Executors

```typescript
import { Deck } from "@deck.gl/core";
import { toolsDictionary } from "@carto/maps-ai-tools/definitions";
import { parseToolResponse } from "@carto/maps-ai-tools/executors";

// Define executors for each tool
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
```

---

# Handle Tool Responses

```typescript
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
```

---

# React Integration Example

```tsx
function MapApp() {
  const deckRef = useRef<Deck | null>(null);

  const executors = useCallback(() => ({
    [toolsDictionary.flyTo]: (params) => {
      deckRef.current?.setProps({
        initialViewState: {
          longitude: params.lng,
          latitude: params.lat,
          zoom: params.zoom,
          transitionDuration: 1000,
        },
      });
    },
  }), []);

  // ... handle responses
}
```

---

<!-- _class: lead -->

# Backend Integration TBD

## Two Approaches

---

# Approach 1: Library Import

```typescript
import {
  toolsDictionary,
  getToolDefinitions
} from '@carto/maps-ai-tools/definitions';

import {
  validateToolCall,
  formatToolResponse
} from '@carto/maps-ai-tools/executors';

// Get definitions for AI model
const definitions = getToolDefinitions();

// Use with OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  tools: definitions,
  tool_choice: 'auto'
});
```

---

# Approach 2: API Request

```typescript
// Backend exposes endpoint
app.get("/api/tools/definitions", (req, res) => {
  res.json({
    tools: [
      {
        type: "function",
        function: {
          name: "fly-to",
          description: "Fly to a location",
          parameters: { /* ... */ },
        },
      },
    ],
  });
});

// Frontend fetches definitions
const { tools } = await fetch("/api/tools/definitions")
  .then(r => r.json());
```

---

<!-- _class: lead -->

# Custom Tools TBD

## Extending the Library

---

# Custom Tool Definition

```typescript
export const customToolSchema: ToolSchema = {
  type: "function",
  function: {
    name: "highlight-feature",
    description: "Highlight a specific feature on the map",
    parameters: {
      type: "object",
      properties: {
        featureId: { type: "string" },
        color: { type: "string", default: "#FF0000" },
        duration: { type: "number", default: 3000 },
      },
      required: ["featureId"],
    },
  },
};
```

---

# Using Custom Tools

```typescript
import { toolsDictionary, getToolDefinition }
  from "@carto/maps-ai-tools/definitions";
import { customToolSchema, customDictionary }
  from "./custom-tools";

// Combine built-in and custom tools
const allDefinitions = [
  getToolDefinition(toolsDictionary.flyTo),
  getToolDefinition(toolsDictionary.zoomMap),
  customToolSchema,
];

// Combined executors
const allExecutors = {
  [toolsDictionary.flyTo]: (params) => { /* ... */ },
  [customDictionary.highlightFeature]: (params) => {
    // Custom implementation
  },
};
```

---

<!-- _class: lead -->

# Getting Started

## Quick Setup

---

# Installation

```bash
# Install the library
npm install @carto/maps-ai-tools
# or
yarn add @carto/maps-ai-tools
# or
pnpm add @carto/maps-ai-tools
```

---

# Quick Start - Frontend

```typescript
// 1. Import packages
import { toolsDictionary } from "@carto/maps-ai-tools/definitions";
import { parseToolResponse } from "@carto/maps-ai-tools/executors";

// 2. Initialize deck.gl
const deck = new Deck({
  canvas: "map",
  initialViewState: { longitude: -74.0, latitude: 40.7, zoom: 10 },
});

// 3. Define executors
const executors = {
  [toolsDictionary.flyTo]: (params) => {
    deck.setProps({ initialViewState: { /* ... */ } });
  },
};
```

---

# Quick Start - Backend

```typescript
// 1. Import packages
import { getToolDefinitions } from "@carto/maps-ai-tools/definitions";
import OpenAI from "openai";

// 2. Get tool schemas
const schemas = getToolDefinitions();

// 3. Use with OpenAI
const openai = new OpenAI();
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [/* ... */],
  tools: schemas,
  tool_choice: "auto",
});
```

---

# Thank You!

## Questions?

**@carto/maps-ai-tools**

Standardizing AI-Powered Map Interactions

---