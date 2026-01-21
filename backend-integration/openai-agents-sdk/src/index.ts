/**
 * Backend OpenAI Agents SDK Entry Point
 */

import 'dotenv/config';
import { startServer } from './server.js';
import { initializeMCPClients } from './agent/mcp-tools.js';
import { configureProvider, getDefaultProvider } from './agent/providers.js';

// Check for at least one provider API key
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasCarto = !!process.env.CARTO_AI_API_KEY && !!process.env.CARTO_AI_API_BASE_URL;

if (!hasOpenAI && !hasCarto) {
  console.error('Error: At least one API key is required');
  console.error('Please set OPENAI_API_KEY, or CARTO_AI_API_KEY + CARTO_AI_API_BASE_URL');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3003', 10);

async function main() {
  console.log('Starting OpenAI Agents SDK backend...');

  // Configure provider (OpenAI or CARTO)
  try {
    const defaultProvider = getDefaultProvider();
    const { model } = configureProvider(defaultProvider);
    console.log('Available providers:');
    if (hasOpenAI) console.log(`  - OpenAI (${process.env.OPENAI_MODEL || 'gpt-4o'})`);
    if (hasCarto) console.log(`  - CARTO (${process.env.CARTO_AI_API_MODEL || 'gpt-4o'})`);
    console.log(`Default provider: ${defaultProvider}`);
    console.log(`Using model: ${model}`);
  } catch (error) {
    console.error('[Config] Provider configuration failed:', (error as Error).message);
    process.exit(1);
  }

  // Initialize MCP clients (if configured)
  try {
    await initializeMCPClients();
  } catch (error) {
    console.warn('[MCP] Failed to initialize MCP clients:', (error as Error).message);
  }

  startServer(PORT);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
