/**
 * Backend Google ADK Entry Point
 */

import 'dotenv/config';
import { startServer } from './server.js';

// Validate required environment variables
if (!process.env.GOOGLE_API_KEY) {
  console.error('Error: GOOGLE_API_KEY environment variable is required');
  console.error('Please create a .env file with your Google API key');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3002', 10);

console.log('Starting Google ADK backend...');
console.log(`Model: ${process.env.GOOGLE_MODEL || 'gemini-2.5-flash'}`);

startServer(PORT);
