/**
 * Multi-provider support for Vercel AI SDK v6
 */

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type ProviderName = 'openai' | 'anthropic' | 'google';

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
