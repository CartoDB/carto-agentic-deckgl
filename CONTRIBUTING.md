# Contributing to @carto/agentic-deckgl

Thank you for your interest in contributing! This document covers the essentials for getting started. For detailed project structure, architecture, and development commands, see the [main README](README.md).

## Code of Conduct

- Be respectful and considerate in all communications
- Accept constructive criticism gracefully
- Focus on what is best for the community

## Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/CartoDB/carto-agentic-deckgl.git
   cd carto-agentic-deckgl
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Set up the development environment** -- see [Quick Start](README.md#quick-start) in the main README for building the library, picking a backend, and starting a frontend.

## Development Setup

### Running Everything

You'll need three terminals:

1. **Library** (if making changes): `npm run dev` (from root)
2. **Backend** (pick one):
   - `cd examples/backend/openai-agents-sdk && npm run dev` (default)
   - `cd examples/backend/vercel-ai-sdk && npm run dev`
   - `cd examples/backend/google-adk && npm run dev`
3. **Frontend** (pick one):
   - `cd examples/frontend/react && pnpm dev`
   - `cd examples/frontend/angular && pnpm start`
   - `cd examples/frontend/vue && pnpm dev`
   - `cd examples/frontend/vanilla && pnpm dev`

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

1. **Sync with main**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes**:
   - Build the library: `npm run build` (from root)
   - Run type checks: `npm run type-check`
   - Run unit tests: `npm test`
   - Test with at least one frontend example

4. **Commit your changes** using conventional commits:
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

5. **Push and create a Pull Request** with a clear description and any related issue references.

## Adding New Tools

The tool system is defined in `src/` (core library) and consumed by backend and frontend examples. See [Core Library](README.md#core-library) and [Consolidated Tools](README.md#consolidated-tools) in the main README for the architecture overview.

To add a new tool:

1. **Define the Zod schema** in `src/definitions/tools.ts`
2. **Add the tool name** to `src/definitions/dictionary.ts`
3. **Add prompt instructions** in `src/prompts/`
4. **Add SDK converter support** in `src/converters/`
5. **Implement the frontend executor** in each frontend example
6. **Add backend handling** in `examples/backend/<sdk>/src/agent/tools.ts` if server-side execution is needed

## Releasing

Releases follow a convention-based workflow, consistent with `@carto/api-client`:

1. **Bump the version** on `main`:
   ```bash
   npm version patch   # or minor / major / prepatch / preminor / premajor / prerelease
   ```

2. The `postversion` script will automatically:
   - Run type checks and tests
   - Create a `release/vX.Y.Z` branch
   - Commit `chore(release): vX.Y.Z` and tag `vX.Y.Z`
   - Push the branch and tags to GitHub

3. **Open a PR** from the release branch to `main`.

4. **On merge**, CI detects the `chore(release)` commit and publishes to NPM:
   - Stable versions (`X.Y.Z`) are tagged `latest`
   - Prerelease versions (`X.Y.Z-alpha.N`) are tagged `alpha`

The release workflow can also be triggered manually via `workflow_dispatch`.

## Reporting Issues

When reporting issues, please include:

- Clear description and steps to reproduce
- Expected vs. actual behavior
- Node.js version, browser, and OS
- Screenshots or logs if applicable

Use GitHub Issues for bug reports, feature requests, and questions.
