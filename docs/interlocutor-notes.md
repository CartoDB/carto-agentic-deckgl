---
marp: true
theme: default
paginate: true
backgroundColor: #f5f5f5
header: 'Speaker Notes - @carto/maps-ai-tools'
footer: 'CARTO | Presentation Guide'
style: |
  section {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    padding-top: 70px;
    padding-bottom: 70px;
    font-size: 20px;
  }
  header {
    top: 15px;
  }
  footer {
    bottom: 15px;
  }
  h1 {
    color: #162945;
    font-size: 1.5em;
  }
  h3 {
    color: #2C3E50;
    font-size: 1.1em;
    margin-bottom: 0.5em;
  }
  p {
    line-height: 1.6;
  }
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# Interlocutor Notes

## @carto/maps-ai-tools Presentation

Ready-to-use speaker descriptions for each slide

---

# Slide 1: Title

### @carto/maps-ai-tools

Welcome everyone. Today I'm presenting the architecture for @carto/maps-ai-tools, a monorepo library designed to standardize how we build AI-powered map interactions. This Version 3.0 represents our latest architectural thinking on bridging the gap between AI capabilities and map visualization. The library enables any frontend application to leverage OpenAI function calling for map control in a consistent, type-safe way.

**Transition:** "Let me walk you through what we'll cover today..."

---

# Slide 2: Agenda

### Presentation Overview

We'll cover nine main topics today. We start with the executive summary explaining what this library is and why we built it. Then we dive into the architecture overview showing the high-level design. The core of the presentation covers our two main packages: definitions for tool schemas, and executors for communication utilities. We'll see how the communication flow works with request/response patterns. The Frontend and Backend integration sections are still being finalized, marked as TBD, but we'll cover the established patterns. Finally, we'll look at custom tools and a quick getting started guide.

**Transition:** "Let's start with why we built this library..."

---

# Slide 3: Executive Summary

### What is @carto/maps-ai-tools?

The problem we're solving is inconsistent tool definitions across projects. Imagine every team defining a 'fly-to' function differently - different parameter names, different validation rules, different response formats. This creates integration nightmares and duplicated effort. Our solution is a standardized monorepo library that provides four core capabilities: first, JSON schemas compatible with OpenAI function calling; second, standardized communication interfaces between frontend and backend; third, a centralized tool dictionary with consistent naming; and fourth, consistent execution patterns that work the same everywhere.

**Transition:** "These capabilities are guided by 5 key principles..."

---

# Slide 4: Key Architectural Principles

### The 5 Pillars

Our architecture rests on five principles. Standardized Definitions means we have a single source of truth for all tools - no more scattered definitions. Unified Communication ensures the same request/response format everywhere, making integration predictable. We're deck.gl Focused because that's CARTO's primary visualization engine, so we optimize for it. Framework Agnostic means this works whether you use React, Vue, Angular, or vanilla JavaScript. And Backend Independence means your backend technology choice doesn't affect how you use the library. These principles ensure the library scales across teams and projects.

**Transition:** "Let's look at how this is organized..."

---

# Slide 5: Monorepo Structure

### Two Main Packages

The structure is intentionally simple with just two packages. The definitions package is the "what" - it contains schemas and types that describe tools. The executors package is the "how" - it handles communication utilities. Think of definitions as the dictionary that everyone references, and executors as the translator that handles the conversation. This separation allows independent versioning, so teams can update one without affecting the other. Teams can also import only what they need, keeping bundle sizes minimal.

**Transition:** "Here's how these layers work together..."

---

# Slide 6: Three-Layer Architecture

### Client, Library, and Backend

Looking at the architecture from top to bottom: the Client Layer is your application code, which can be built with any framework. The middle layer is our maps-ai-tools library - this is the star of today's presentation. It sits between your app and the backend, providing the definitions and communication interface. The Backend Layer is where AI processing happens with OpenAI integration. Notice the bidirectional arrows - data flows both ways. The library layer acts as the contract between frontend and backend, ensuring both sides speak the same language.

**Transition:** "Let's dive into the first package: definitions..."

---

# Slide 7: Package: definitions

### Section Introduction

Now we're moving into the definitions package. This is all about defining WHAT tools exist and HOW they're structured. It's the foundation that everything else builds upon.

---

# Slide 8: Package Structure: definitions

### File Organization

The definitions package has a clean structure. The schemas folder contains individual JSON files for each tool - fly-to, zoom-map, toggle-layer, and so on. The dictionary.ts file is the central registry listing all available tools. The types.ts file provides TypeScript interfaces for type safety. Each tool gets its own schema file which makes maintenance easier - you can update one tool without touching others. Everything is exported through a single index.ts for clean imports.

**Transition:** "Let me show you how the dictionary works..."

---

# Slide 9: Tools Dictionary

### TOOL_NAMES and toolsDictionary

The dictionary provides two things. TOOL_NAMES gives us constants to avoid magic strings - instead of typing 'fly-to' everywhere and risking typos, you use TOOL_NAMES.FLY_TO. The toolsDictionary maps these names to schema loaders using dynamic imports. Notice the 'as const' assertion which gives us full type safety. The dynamic import pattern with arrow functions enables tree-shaking, so unused tools don't end up in your bundle. This prevents typos and enables autocomplete in your IDE.

**Transition:** "Now let's see what a schema actually looks like..."

---

# Slide 10: JSON Schema Example

### The fly-to Tool Schema

This is what a tool schema looks like. It follows OpenAI's function calling format exactly, so it works directly with their API. The structure has a type of "function", a name matching our dictionary, and a description that the AI reads to decide when to use this tool. The parameters section defines the arguments with their types and constraints. Notice the minimum and maximum on latitude and longitude - these constraints are validated automatically. The required array specifies which fields must be provided. This schema IS the documentation - the AI reads this description to understand when and how to use the tool.

**Transition:** "We also provide TypeScript interfaces..."

---

# Slide 11: TypeScript Interfaces

### Type-safe Definitions

We export TypeScript interfaces that match the JSON structure. The ToolSchema interface defines the shape of any tool definition. Response types like FlyToResponse define exactly what data comes back from each tool. These types are exported for consumers to use in their own code, enabling full type safety from definition to execution. No more guessing what parameters a tool needs or what response to expect.

**Transition:** "Now let's look at the executors package..."

---

# Slide 12: Package: executors

### Section Introduction

Now we move from WHAT to HOW. The executors package handles all communication between frontend and backend. It's the machinery that makes tool calls actually work.

---

# Slide 13: Package Structure: executors

### File Organization

The executors package is smaller and focused on communication. The interface.ts file defines standard request and response types. The send.ts file contains the function to call the backend. The validators.ts file handles input validation before anything is sent. And errors.ts provides standardized error handling. Everything you need to communicate with the backend is here.

**Transition:** "Let's look at the core interfaces..."

---

# Slide 14: Standard Communication Interface

### ToolRequest, ToolResponse, ToolError

These three interfaces form the communication contract. ToolRequest is what you send - it contains the toolName and params. ToolResponse is what you get back - it has the data, an optional message, or an error. ToolError provides structured error information with a code and message. Notice the generic type parameter on ToolResponse - this allows typed responses so you know exactly what data structure to expect. This is the contract that both frontend and backend agree on - every tool call follows this exact pattern.

**Transition:** "Here's how you send a request..."

---

# Slide 15: Send Function

### Making Backend Requests

The send function is a simple async function with a generic return type. It takes a ToolRequest containing the tool name and parameters, plus SendOptions for configuration like the base URL and endpoint. It returns a standardized ToolResponse. In production, this includes retry logic, timeouts, and more robust error handling. The simplified version here shows the core pattern - construct the request, call fetch, parse the response, return in standard format.

**Transition:** "Before sending, we validate..."

---

# Slide 16: Validators

### Input Validation

The validateToolCall function checks everything before sending to the backend. First it verifies the tool exists in the dictionary - if someone requests an unknown tool, we catch it immediately. Then it checks that all required parameters are present. Finally it validates types and constraints like minimum and maximum values. The function returns a structured ValidationResult. The benefit is catching errors early, before they hit the API, giving users faster and clearer feedback.

**Transition:** "Let's see how all this flows together..."

---

# Slide 17: Communication Flow

### Section Introduction

Now we'll see the full picture of how data moves through the system. This ties together everything we've covered about definitions and executors.

---

# Slide 18: Sequence Diagram

### The Complete Flow

Let me walk through this step by step. First, both the frontend and backend import definitions from the library - they share the same source of truth. When a user sends a prompt, it goes to the backend. The backend sends this to the AI model along with the tool definitions. The AI decides which tool to call and returns a tool call with parameters. The library validates these parameters against the schema. The validated response is sent to the frontend. Finally, the frontend executes the tool, like flying to a location on the map. The library ensures both sides speak the same language throughout this entire flow.

**Transition:** "Let's look at the actual message formats..."

---

# Slide 19: Message Types

### User Prompt and Tool Call Response

Here are the actual message formats. A user prompt is simple - it has a type, content with the natural language request like "Fly to New York City and zoom in", and a timestamp. The tool call response is structured - it contains the toolName identifying which tool to execute, and data with the actual parameters. Notice how the AI translated "New York City" into actual coordinates. The AI did the hard work of understanding intent and converting it to actionable data.

**Transition:** "But what about when things go wrong..."

---

# Slide 20: Error Response

### Handling Failures Gracefully

Error responses use the same structure for consistency. Instead of data, you get an error object with a code and message. We define standard error codes that make handling predictable: VALIDATION_ERROR for bad input, TOOL_NOT_FOUND for unknown tools, EXECUTION_ERROR for runtime failures, NETWORK_ERROR for connectivity issues, and UNAUTHORIZED for authentication problems. Consistent error handling across all tools means you write error handling logic once and it works everywhere.

**Transition:** "Now let's see how to integrate this..."

---

# Slide 21: Frontend Integration

### Section Introduction

This section covers frontend integration. The library is framework agnostic, so it works with any JavaScript framework. We'll show examples in vanilla JavaScript and React.

---

# Slide 22: Setup with Executors

### Defining Tool Executors

To integrate on the frontend, you import deck.gl and the library packages. Then you create an executors object that maps tool names to handler functions. Each executor receives the parsed parameters from the AI response. The executor calls deck.gl methods to actually update the map. Notice the transitionDuration for smooth animations. The flyTo executor sets the view state with longitude, latitude, and zoom level. You define one executor per tool, and they all follow this same pattern.

**Transition:** "Here's how to handle the responses..."

---

# Slide 23: Handle Tool Responses

### Processing Backend Responses

The handleToolResponse function is your main entry point for processing AI responses. You use parseToolResponse to extract the toolName, data, and any error. Always check for errors first - if there's an error, log it and return early. Otherwise, look up the executor by toolName from your executors object. If you find a matching executor and have data, call the executor with the data. This pattern works for any number of tools - you just add more executors to the object.

**Transition:** "And here's how it looks in React..."

---

# Slide 24: React Integration Example

### React Hooks Pattern

In React, use useRef to hold the deck.gl instance so it persists across renders. Use useCallback for the executors to get stable function references that don't change on every render. The executor pattern is the same as vanilla JavaScript - you're just wrapping it in React hooks for proper lifecycle management. Vue and Angular follow similar patterns with their respective reactivity systems.

**Transition:** "Now let's look at the backend side..."

---

# Slide 25: Backend Integration TBD

### Section Introduction

The backend integration section is still being finalized, but the patterns are established. There are two main approaches: importing the library directly, or exposing definitions via API.

---

# Slide 26: Approach 1: Library Import

### Direct Package Import

The first approach is importing the library directly in your backend code. You import getToolDefinitions from the definitions package and validation utilities from executors. Call getToolDefinitions() to get all the schemas ready for the AI model. Use these with OpenAI's tools parameter, and set tool_choice to 'auto' to let the AI decide when to use tools. This approach gives you type safety end-to-end with a single source of truth for tool definitions.

**Transition:** "Alternative approach..."

---

# Slide 27: Approach 2: API Request

### REST Endpoint Approach

The second approach is exposing tool definitions via a REST endpoint. Your backend creates a /api/tools/definitions endpoint that returns tool schemas as JSON. The frontend fetches definitions at runtime instead of importing them directly. This approach is useful when the frontend can't import the library directly, such as in certain build configurations or when you need dynamic tool loading.

**Transition:** "You can also add custom tools..."

---

# Slide 28: Custom Tools TBD

### Section Introduction

The library is designed to be extensible. You can add your own custom tools alongside the built-in ones, and they work exactly the same way.

---

# Slide 29: Custom Tool Definition

### Creating a Custom Schema

Creating a custom tool uses the same ToolSchema interface as built-in tools. This example shows a highlight-feature tool that highlights a specific feature on the map. You define parameters with their types and default values - featureId is required, while color and duration have defaults. Your custom tools work exactly like built-in ones - the library doesn't distinguish between them.

**Transition:** "Here's how to use them together..."

---

# Slide 30: Using Custom Tools

### Combining Built-in and Custom Tools

To use custom tools, import both the library's built-in tools and your custom definitions. Combine them into a single array of definitions. Create executors for all tools - both built-in and custom. Pass the combined definitions to your backend. You can mix and match as needed for your project, adding project-specific tools while keeping the standard map controls.

**Transition:** "Finally, let's get started..."

---

# Slide 31: Getting Started

### Section Introduction

Let's wrap up with how to get started. The setup is straightforward and you can be up and running quickly.

---

# Slide 32: Installation

### npm/yarn/pnpm

Installation is a single command - npm install, yarn add, or pnpm add @carto/maps-ai-tools. There are no additional peer dependencies to worry about. TypeScript types are included in the package. That's it - one install and you're ready to start building.

**Transition:** "Frontend setup..."

---

# Slide 33: Quick Start - Frontend

### 3 Steps to Get Running

Frontend setup is three steps. First, import the packages - toolsDictionary from definitions and parseToolResponse from executors. Second, initialize deck.gl with your canvas and initial view state. Third, define your executors object mapping tool names to handler functions. Connect to your backend, handle responses with your executors, and you're done. You can be up and running in about ten minutes.

**Transition:** "And on the backend..."

---

# Slide 34: Quick Start - Backend

### Backend in 3 Steps

Backend setup is also three steps. Import getToolDefinitions from the library and the OpenAI SDK. Call getToolDefinitions() to get all the schemas. Use them with OpenAI's chat completions API, passing the schemas as the tools parameter. The library does the heavy lifting of providing properly formatted tool definitions that work directly with OpenAI.

**Transition:** "And that's it!"

---

# Slide 35: Thank You!

### Closing

Thank you for your time today. We covered the complete architecture of @carto/maps-ai-tools, from the two-package monorepo structure through definitions, executors, and the communication flow. The library standardizes AI-powered map interactions, making integration consistent and type-safe across all your projects. I'm happy to answer any questions about the architecture, implementation details, or how this might fit into your specific use cases.
