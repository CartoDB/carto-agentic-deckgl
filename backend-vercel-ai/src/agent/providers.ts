/**
 * Multi-provider support for Vercel AI SDK v6
 */

import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'carto';

/**
 * Create CARTO AI provider (OpenAI-compatible with custom baseURL)
 */
function createCartoProvider(): LanguageModel {
  const CARTO_AI_API_BASE_URL = process.env.CARTO_AI_API_BASE_URL;
  const CARTO_AI_API_KEY = process.env.CARTO_AI_API_KEY;
  const CARTO_AI_API_MODEL = process.env.CARTO_AI_API_MODEL || 'gpt-4o';

  if (!CARTO_AI_API_BASE_URL || !CARTO_AI_API_KEY) {
    throw new Error('CARTO_AI_API_BASE_URL and CARTO_AI_API_KEY are required for carto provider');
  }

  const carto = createOpenAI({
    baseURL: CARTO_AI_API_BASE_URL,
    apiKey: CARTO_AI_API_KEY,
    headers: {
      'x-litellm-api-key': CARTO_AI_API_KEY,
    },
    name: 'carto', // Custom provider name for logging
  });

  // Use .chat() for explicit chat completions API (more compatible with LiteLLM)
  return carto.chat(CARTO_AI_API_MODEL);
}

/**
 * Get the language model for the specified provider
 */
export function getProvider(providerName?: string): LanguageModel {
  const provider = providerName || process.env.DEFAULT_PROVIDER || 'openai';

  switch (provider) {
    case 'anthropic':
      return anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514');
    case 'google':
      return google(process.env.GOOGLE_MODEL || 'gemini-2.5-flash');
    case 'carto':
      return createCartoProvider();
    case 'openai':
    default:
      return openai(process.env.OPENAI_MODEL || 'gpt-4o');
  }
}

/**
 * Get the name of the default provider
 */
export function getDefaultProvider(): ProviderName {
  return (process.env.DEFAULT_PROVIDER as ProviderName) || 'openai';
}
