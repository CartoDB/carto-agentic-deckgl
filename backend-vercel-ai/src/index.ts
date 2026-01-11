/**
 * Backend Vercel AI SDK Entry Point
 */

import 'dotenv/config';
import { startServer } from './server.js';

// Check for at least one provider API key
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const hasGoogle = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const hasCarto = !!process.env.CARTO_AI_API_KEY && !!process.env.CARTO_AI_API_BASE_URL;

if (!hasOpenAI && !hasAnthropic && !hasGoogle && !hasCarto) {
  console.error('Error: At least one API key is required');
  console.error('Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or CARTO_AI_API_KEY + CARTO_AI_API_BASE_URL');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3003', 10);

console.log('Starting Vercel AI SDK backend...');
console.log('Available providers:');
if (hasOpenAI) console.log(`  - OpenAI (${process.env.OPENAI_MODEL || 'gpt-4o'})`);
if (hasAnthropic) console.log(`  - Anthropic (${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'})`);
if (hasGoogle) console.log(`  - Google (${process.env.GOOGLE_MODEL || 'gemini-2.5-flash'})`);
if (hasCarto) console.log(`  - CARTO (${process.env.CARTO_AI_API_MODEL || 'gpt-4o'})`);
console.log(`Default provider: ${process.env.DEFAULT_PROVIDER || 'openai'}`);

startServer(PORT);
