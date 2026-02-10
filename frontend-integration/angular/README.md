# FrontendAngular

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.9.

## Prerequisites

- Node.js (v18 or higher)
- pnpm (`npm install -g pnpm`)

## Getting Started

Install dependencies:

```bash
pnpm install
```

## Environment Configuration

Rename the example environment file and configure your CARTO credentials:

```bash
mv src/environments/environment.example src/environments/environment.ts
```

Then edit `src/environments/environment.ts` with your settings:

```typescript
export const environment = {
  production: false,

  // CARTO API Configuration
  apiBaseUrl: 'https://gcp-us-east1.api.carto.com',
  accessToken: 'YOUR_ACCESS_TOKEN',  // Replace with your CARTO API access token
  connectionName: 'carto_dw',

  // Backend Configuration
  wsUrl: 'ws://localhost:3003/ws',
  httpApiUrl: 'http://localhost:3003/api/chat',

  // Feature flags
  useHttp: false,
};
```

| Variable | Description |
|----------|-------------|
| `accessToken` | Your CARTO API access token (required for map data layers) |
| `apiBaseUrl` | CARTO API endpoint URL |
| `connectionName` | CARTO data warehouse connection name |
| `wsUrl` | WebSocket URL for backend chat connection |
| `httpApiUrl` | HTTP fallback URL for backend chat API |

## Development server

To start a local development server, run:

```bash
pnpm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
pnpm ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
pnpm ng generate --help
```

## Building

To build the project run:

```bash
pnpm build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
pnpm test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
pnpm ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
