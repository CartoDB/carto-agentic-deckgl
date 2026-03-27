# Getting Started

How to set up and run the AI-powered map application.

---

## Prerequisites

- **Node.js v22+** — Enforced by backend `package.json` `engines` field
- **npm** — For core library and backend package management
- **pnpm** — For frontend package management. Install globally: `npm install -g pnpm`
- **A CARTO API access token and connection** — Required for map data access
- **A CARTO AI API key and endpoint** — OpenAI-compatible LLM endpoint
- **Git** — For cloning the repository

---

## Quick Start

Follow these steps to run the application with the default backend (OpenAI Agents SDK) and a frontend of your choice.

### Step 1: Clone and install core library

```bash
git clone https://github.com/CartoDB/carto-agentic-deckgl.git
cd carto-agentic-deckgl
npm install
npm run build
```

### Step 2: Set up a backend

The **OpenAI Agents SDK** is the default and recommended backend.

```bash
cd examples/backend/openai-agents-sdk
npm install
cp .env.example .env
# Edit .env with your credentials (see docs/environment.md#backend-variables)
npm run dev
```

The backend server will start on **http://localhost:3003**.

See [Environment Configuration](environment.md#backend-variables) for detailed variable reference.

### Step 3: Set up a frontend

Choose a frontend framework. Angular and React are shown below.

#### Angular

```bash
cd examples/frontend/angular
pnpm install
cp src/environments/environment.example src/environments/environment.ts
# Edit environment.ts (see docs/environment.md#frontend-variables)
pnpm start
```

Frontend will start on **http://localhost:4200**.

#### React

```bash
cd examples/frontend/react
pnpm install
cp .env.example .env
# Edit .env (see docs/environment.md#frontend-variables)
pnpm dev
```

Frontend will start on **http://localhost:5173**.

See [Environment Configuration](environment.md#frontend-variables) for detailed variable reference.

---

## Available Backends

All three backends use the same WebSocket protocol and environment variables. Pick the one that matches your AI SDK preference.

| Backend | AI SDK | Directory | Install Command | Notes |
|---------|--------|-----------|-----------------|-------|
| **OpenAI Agents SDK** | `@openai/agents` | `examples/backend/openai-agents-sdk/` | `npm install` | **Default and recommended** |
| **Vercel AI SDK** | `ai` v6 | `examples/backend/vercel-ai-sdk/` | `npm install` | |
| **Google ADK** | `@google/adk` | `examples/backend/google-adk/` | `npm install --force` | **Experimental** — see note below |

> [!NOTE]
> **Google ADK** requires `npm install --force` due to peer dependency conflicts. This is a known limitation of the ADK package and does not affect functionality.

All backends run on port **3003** by default (configurable via `PORT` environment variable).

---

## Available Frontends

All four frontends have identical feature parity and work with any backend.

| Frontend | Framework | Directory | Dev Server | Package Manager |
|----------|-----------|-----------|------------|-----------------|
| **Angular** | Angular 20 | `examples/frontend/angular/` | http://localhost:4200 | pnpm |
| **React** | React 19 | `examples/frontend/react/` | http://localhost:5173 | pnpm |
| **Vue** | Vue 3 | `examples/frontend/vue/` | http://localhost:5173 | pnpm |
| **Vanilla JS** | No framework | `examples/frontend/vanilla/` | http://localhost:5173 | pnpm |

All frontends use **pnpm** for package management.

---

## Development Commands

Quick reference for common commands. For detailed options, see the README in each directory.

### Core Library

Run these from the repository root:

```bash
npm install           # Install dependencies
npm run build         # Build ESM + CJS outputs to dist/
npm run dev           # Watch mode (auto-rebuild on changes)
npm test              # Run unit tests (Vitest)
npm run type-check    # Type check without emitting
```

### Backend

Run these from the backend directory (e.g., `examples/backend/openai-agents-sdk/`):

```bash
npm install           # Install dependencies
npm run dev           # Start dev server with hot reload (tsx watch, port 3003)
npm run build         # Compile TypeScript to dist/
npm start             # Run production build
npm run typecheck     # Type check without emitting
```

**OpenAI Agents SDK only:**

```bash
npm run dev:mock-mcp  # Start with MCP mock mode (fixture-backed tools)
```

### Frontend

Run these from the frontend directory (e.g., `examples/frontend/react/`):

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (React, Vue, Vanilla)
pnpm start            # Start dev server (Angular)
pnpm build            # Build for production
```

**React only:**

```bash
pnpm test             # Run unit tests (Vitest)
pnpm e2e              # Run E2E tests (Playwright)
```

---

## Next Steps

- **[Environment Configuration](environment.md)** — Detailed variable reference for backend and frontend
- **[WebSocket Protocol](websocket-protocol.md)** — Message format details and communication flow
- **[Tool System](tools.md)** — Understanding the 3 consolidated tools (coming soon)

For contributing to the project, see [CONTRIBUTING.md](../CONTRIBUTING.md).
