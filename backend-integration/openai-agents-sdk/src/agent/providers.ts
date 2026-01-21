/**
 * Provider Configuration for OpenAI Agents SDK
 *
 * Configures the OpenAI client for the Agents SDK.
 * Supports OpenAI and CARTO AI (OpenAI-compatible via LiteLLM)
 */

import OpenAI from 'openai';
import { setDefaultOpenAIClient, setOpenAIAPI } from '@openai/agents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenAIClientAny = any;

export type ProviderName = 'openai' | 'carto';

// Store configured model after provider setup
let configuredModel: string = 'gpt-4o';
let configuredProvider: ProviderName = 'openai';

/**
 * Configure the OpenAI client based on provider selection
 * Supports CARTO AI (OpenAI-compatible with custom baseURL via LiteLLM)
 */
export function configureProvider(providerName?: string): { model: string } {
  const provider = (providerName || process.env.DEFAULT_PROVIDER || 'openai') as ProviderName;
  configuredProvider = provider;

  if (provider === 'carto') {
    const CARTO_AI_API_BASE_URL = process.env.CARTO_AI_API_BASE_URL;
    const CARTO_AI_API_KEY = process.env.CARTO_AI_API_KEY;
    const CARTO_AI_API_MODEL = process.env.CARTO_AI_API_MODEL || 'gpt-4o';

    if (!CARTO_AI_API_BASE_URL || !CARTO_AI_API_KEY) {
      throw new Error('CARTO_AI_API_BASE_URL and CARTO_AI_API_KEY are required for carto provider');
    }

    // Create custom OpenAI client with CARTO baseURL
    const cartoClient = new OpenAI({
      baseURL: CARTO_AI_API_BASE_URL,
      apiKey: CARTO_AI_API_KEY,
    });

    // Set as default client for OpenAI Agents SDK
    // Use type assertion to handle version mismatch between openai packages
    setDefaultOpenAIClient(cartoClient as OpenAIClientAny);

    // Use chat completions API (compatible with LiteLLM)
    setOpenAIAPI('chat_completions');

    configuredModel = CARTO_AI_API_MODEL;
    console.log(`[Provider] Using CARTO AI at ${CARTO_AI_API_BASE_URL}`);
    return { model: CARTO_AI_API_MODEL };
  }

  // Default: OpenAI
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for openai provider');
  }

  // OpenAI Agents SDK will use OPENAI_API_KEY env var automatically
  // Use chat completions API for consistency
  setOpenAIAPI('chat_completions');

  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  configuredModel = model;
  console.log('[Provider] Using OpenAI');
  return { model };
}

/**
 * Get the configured model name
 */
export function getConfiguredModel(): string {
  return configuredModel;
}

/**
 * Get the configured provider name
 */
export function getConfiguredProvider(): ProviderName {
  return configuredProvider;
}

/**
 * Get the name of the default provider
 */
export function getDefaultProvider(): ProviderName {
  return (process.env.DEFAULT_PROVIDER as ProviderName) || 'openai';
}
