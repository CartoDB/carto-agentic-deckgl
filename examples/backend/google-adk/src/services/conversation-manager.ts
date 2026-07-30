/**
 * Conversation Manager
 *
 * Owns the ADK `InMemorySessionService` and tracks the ADK session
 * associated with each WebSocket session. ADK manages history events
 * directly inside its session; this class only handles lifecycle and
 * injection of synthetic context notes (e.g. frontend tool results).
 *
 * Compaction itself is configured on the `LlmAgent` via
 * `TokenBasedContextCompactor`, so we no longer truncate at the app level.
 */

import { InMemorySessionService, createEvent } from '@google/adk';

export const ADK_APP_NAME = 'carto_map_agent';

export class ConversationManager {
  readonly sessionService = new InMemorySessionService();
  private readonly adkSessionIds = new Map<string, string>();

  /**
   * Get the ADK session ID for a WS session, creating the ADK session on first call.
   */
  async getOrCreateAdkSession(sid: string): Promise<string> {
    let adkSessionId = this.adkSessionIds.get(sid);
    if (adkSessionId) return adkSessionId;

    adkSessionId = `adk_${sid}`;
    await this.sessionService.createSession({
      appName: ADK_APP_NAME,
      userId: sid,
      sessionId: adkSessionId,
    });
    this.adkSessionIds.set(sid, adkSessionId);
    return adkSessionId;
  }

  /**
   * Append a synthetic note to the ADK session so the agent can see it
   * on its next turn. Used for frontend tool execution results and
   * other out-of-band state updates.
   *
   * Authored as `user` so the model treats it as input context rather
   * than its own prior output.
   */
  async appendContextNote(sid: string, content: string): Promise<void> {
    const adkSessionId = await this.getOrCreateAdkSession(sid);
    const session = await this.sessionService.getSession({
      appName: ADK_APP_NAME,
      userId: sid,
      sessionId: adkSessionId,
    });
    if (!session) return;

    await this.sessionService.appendEvent({
      session,
      event: createEvent({
        author: 'user',
        invocationId: `note_${Date.now()}`,
        content: { role: 'user', parts: [{ text: content }] },
      }),
    });
  }

  /**
   * Delete the ADK session and forget the mapping.
   */
  async clearSession(sid: string): Promise<void> {
    const adkSessionId = this.adkSessionIds.get(sid);
    if (!adkSessionId) return;

    await this.sessionService.deleteSession({
      appName: ADK_APP_NAME,
      userId: sid,
      sessionId: adkSessionId,
    });
    this.adkSessionIds.delete(sid);
  }

  getSessionIds(): string[] {
    return Array.from(this.adkSessionIds.keys());
  }

  getActiveSessionCount(): number {
    return this.adkSessionIds.size;
  }
}
