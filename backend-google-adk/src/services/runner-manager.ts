/**
 * Runner Manager for Google ADK
 *
 * Manages InMemoryRunner instances per session for conversation continuity
 */

import { InMemoryRunner } from '@google/adk';
import { createMapAgent } from '../agent/map-agent.js';
import type { InitialState } from '../types/messages.js';

const APP_NAME = 'map-controller';

// Store runners per session for conversation continuity
const runners = new Map<string, InMemoryRunner>();
const sessions = new Map<string, string>(); // sessionId -> ADK sessionId

/**
 * Get or create a runner for a session
 */
export async function getOrCreateRunner(
  sessionId: string,
  initialState?: InitialState
): Promise<{ runner: InMemoryRunner; adkSessionId: string }> {
  if (!runners.has(sessionId)) {
    const agent = createMapAgent(initialState);
    const runner = new InMemoryRunner({
      agent,
      appName: APP_NAME,
    });
    runners.set(sessionId, runner);

    // Create ADK session
    const adkSession = await runner.sessionService.createSession({
      appName: APP_NAME,
      userId: sessionId,
    });
    sessions.set(sessionId, adkSession.id);
  }

  return {
    runner: runners.get(sessionId)!,
    adkSessionId: sessions.get(sessionId)!,
  };
}

/**
 * Clean up a runner when session ends
 */
export function cleanupRunner(sessionId: string): void {
  runners.delete(sessionId);
  sessions.delete(sessionId);
}

/**
 * Get count of active runners
 */
export function getActiveRunnerCount(): number {
  return runners.size;
}
