// backend/src/index.ts
import dotenv from 'dotenv';
import { createServer } from './server.js';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please create a .env file with the required variables.');
  console.error('See .env.example for template.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const server = createServer();

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 OpenAI Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`=================================`);
});
