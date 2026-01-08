/**
 * Backend OpenAI Agents SDK Entry Point
 */

import 'dotenv/config';
import { startServer } from './server.js';

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  console.error('Please create a .env file with your OpenAI API key');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3001', 10);

console.log('Starting OpenAI Agents SDK backend...');
console.log(`Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);

startServer(PORT);
