# Contributing to @carto/maps-ai-tools

Thank you for your interest in contributing to @carto/maps-ai-tools! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Adding New Tools](#adding-new-tools)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate in all communications
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other contributors

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

## Development Setup

### Library Development

```bash
cd map-ai-tools
npm install
npm run dev          # Watch mode for development
npm run build        # Build ESM + CJS outputs
npm run type-check   # TypeScript type checking
```

### Backend Development

```bash
cd backend
npm install
cp .env.example .env  # Configure OPENAI_API_KEY
npm run dev           # Start with hot reload
npx tsc --noEmit      # Type check
```

### Frontend Examples

Choose any example to test your changes:

```bash
# React
cd integration-examples/frontend-react
npm install
npm run dev

# Vue
cd integration-examples/frontend-vue
npm install
npm run dev

# Angular
cd integration-examples/frontend-angular
npm install
npm start

# Vanilla JS
cd integration-examples/frontend
npm install
npm run dev
```

### Running Everything

You'll need three terminals:

1. **Library** (if making changes): `cd map-ai-tools && npm run dev`
2. **Backend**: `cd backend && npm run dev`
3. **Frontend**: `cd integration-examples/frontend-react && npm run dev`

## Code Style

### TypeScript

- Use TypeScript for all new code in the library and backend
- Enable strict mode
- Provide explicit return types for functions
- Use interfaces over type aliases when possible

### Zod Schemas

- Define tool parameters using Zod schemas
- Add `.describe()` to all schema fields for OpenAI function calling
- Export inferred types using `z.infer<typeof schema>`

### Naming Conventions

- **Files**: kebab-case (`fly-executor.ts`, `tool-registry.ts`)
- **Classes**: PascalCase (`ToolRegistry`, `MapToolsExecutor`)
- **Functions/Variables**: camelCase (`executeZoom`, `toolDefinitions`)
- **Constants**: UPPER_SNAKE_CASE (`TOOL_NAMES`, `BASE_SYSTEM_PROMPT`)
- **Tool Names**: kebab-case (`fly-to`, `zoom-map`, `toggle-layer`)

### File Organization

```
map-ai-tools/src/
├── core/           # Core types, registry, factory
├── definitions/    # Tool schemas and definitions
├── executors/      # Tool execution implementations
├── prompts/        # System prompt generation
└── utils/          # Utility functions
```

## Pull Request Process

1. **Sync with main**:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes**:
   - Build the library: `cd map-ai-tools && npm run build`
   - Run type checks: `npm run type-check`
   - Test with at least one integration example

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add description of your change"
   ```

   Use conventional commit messages:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub with:
   - Clear description of changes
   - Reference any related issues
   - Screenshots if UI changes are involved

## Adding New Tools

To add a new map control tool:

### 1. Define the Schema

Add your tool schema to `map-ai-tools/src/definitions/tools.ts`:

```typescript
export const myNewToolSchema = z.object({
  param1: z.string().describe('Description for OpenAI'),
  param2: z.number().optional().describe('Optional parameter'),
});

export type MyNewToolParams = z.infer<typeof myNewToolSchema>;
```

### 2. Add to TOOL_NAMES

Update the `TOOL_NAMES` constant in `map-ai-tools/src/definitions/dictionary.ts`:

```typescript
export const TOOL_NAMES = {
  // ... existing tools
  MY_NEW_TOOL: 'my-new-tool',
} as const;
```

### 3. Create the Executor

Create `map-ai-tools/src/executors/my-new-tool-executor.ts`:

```typescript
import type { ExecutionContext, ExecutionResult } from '../core/types';
import type { MyNewToolParams } from '../definitions/tools';

export function executeMyNewTool(
  params: MyNewToolParams,
  context: ExecutionContext
): ExecutionResult {
  const { deck, map } = context;

  // Implement your tool logic

  return {
    success: true,
    message: 'Tool executed successfully',
    data: { /* result data */ }
  };
}
```

### 4. Register the Tool

Add to `map-ai-tools/src/definitions/index.ts`:

```typescript
export const BUILTIN_TOOLS = {
  // ... existing tools
  [TOOL_NAMES.MY_NEW_TOOL]: {
    schema: myNewToolSchema,
    executor: executeMyNewTool,
    description: 'Description shown to the AI',
  },
};
```

### 5. Export from Index

Update `map-ai-tools/src/index.ts` to export your new tool.

### 6. Update Backend

Add the tool to `backend/src/services/tool-definitions.ts` if it requires special handling.

### 7. Implement in Examples

Add the executor to at least one integration example (e.g., `frontend-react/src/App.jsx`).

## Reporting Issues

When reporting issues, please include:

- **Description**: Clear explanation of the issue
- **Steps to Reproduce**: Numbered list of steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**:
  - Node.js version
  - Browser and version
  - Operating system
- **Screenshots/Logs**: If applicable

Use GitHub Issues for:
- Bug reports
- Feature requests
- Questions about the codebase

## Questions?

If you have questions about contributing:

1. Check existing issues and pull requests
2. Open a new issue with the "question" label
3. Be specific about what you're trying to accomplish

Thank you for contributing!
