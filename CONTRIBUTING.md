# Contributing to @carto/map-ai-tools

Thank you for your interest in contributing! This document covers the essentials for getting started. For detailed project structure, architecture, and development commands, see the [main README](README.md).

## Code of Conduct

- Be respectful and considerate in all communications
- Accept constructive criticism gracefully
- Focus on what is best for the community

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/CartoDB/ps-frontend-tools-poc.git
   cd ps-frontend-tools-poc
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Set up the development environment** -- see [Quick Start](README.md#quick-start) in the main README for building the library, picking a backend, and starting a frontend.

## Development Setup

### Running Everything

You'll need three terminals:

1. **Library** (if making changes): `cd map-ai-tools && npm run dev`
2. **Backend** (pick one):
   - `cd backend-integration/openai-agents-sdk && npm run dev` (default)
   - `cd backend-integration/vercel-ai-sdk && npm run dev`
   - `cd backend-integration/google-adk && npm run dev`
3. **Frontend** (pick one):
   - `cd frontend-integration/react && npm run dev`
   - `cd frontend-integration/angular && pnpm start`
   - `cd frontend-integration/vue && npm run dev`
   - `cd frontend-integration/vanilla && npm run dev`

See [Development Commands](README.md#development-commands) in the main README for the full command reference.

## Code Style

### TypeScript

- Use TypeScript for all new code in the library and backend
- Enable strict mode
- Provide explicit return types for functions

### Zod Schemas

- Define tool parameters using Zod schemas
- Add `.describe()` to all schema fields for AI function calling
- Export inferred types using `z.infer<typeof schema>`

### Naming Conventions

- **Files**: kebab-case (`agent-runner.ts`, `deck-state.service.ts`)
- **Classes**: PascalCase (`ConversationManager`, `CartoLiteLlm`)
- **Functions/Variables**: camelCase (`buildSystemPrompt`, `toolDefinitions`)
- **Constants**: UPPER_SNAKE_CASE (`TOOL_NAMES`, `BASE_SYSTEM_PROMPT`)
- **Tool Names**: kebab-case (`set-deck-state`, `set-marker`, `lds-geocode`)

## Pull Request Process

1. **Sync with master**:
   ```bash
   git fetch origin
   git rebase origin/master
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes**:
   - Build the library: `cd map-ai-tools && npm run build`
   - Run type checks: `npm run typecheck`
   - Run unit tests: `npm test`
   - Test with at least one frontend integration

4. **Commit your changes** using conventional commits:
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

5. **Push and create a Pull Request** with a clear description and any related issue references.

## Adding New Tools

The tool system is defined in `map-ai-tools/` (core library) and consumed by backends and frontends. See [Core Library](README.md#core-library-map-ai-tools) and [Consolidated Tools](README.md#consolidated-tools) in the main README for the architecture overview.

To add a new tool:

1. **Define the Zod schema** in `map-ai-tools/src/definitions/tools.ts`
2. **Add the tool name** to `map-ai-tools/src/definitions/dictionary.ts`
3. **Add prompt instructions** in `map-ai-tools/src/prompts/`
4. **Add SDK converter support** in `map-ai-tools/src/converters/`
5. **Implement the frontend executor** in each frontend integration
6. **Add backend handling** in `backend-integration/<sdk>/src/agent/tools.ts` if server-side execution is needed

## Reporting Issues

When reporting issues, please include:

- Clear description and steps to reproduce
- Expected vs. actual behavior
- Node.js version, browser, and OS
- Screenshots or logs if applicable

Use GitHub Issues for bug reports, feature requests, and questions.
