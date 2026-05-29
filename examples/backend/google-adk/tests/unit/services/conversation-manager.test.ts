import { describe, it, expect } from 'vitest';
import { ConversationManager, ADK_APP_NAME } from '../../../src/services/conversation-manager.js';

describe('ConversationManager', () => {
  it('creates an ADK session lazily and returns the same id on subsequent calls', async () => {
    const manager = new ConversationManager();

    const adkSessionId = await manager.getOrCreateAdkSession('s1');
    expect(adkSessionId).toBe('adk_s1');

    const again = await manager.getOrCreateAdkSession('s1');
    expect(again).toBe(adkSessionId);

    const session = await manager.sessionService.getSession({
      appName: ADK_APP_NAME,
      userId: 's1',
      sessionId: adkSessionId,
    });
    expect(session).toBeDefined();
  });

  it('appends context notes as user events on the ADK session', async () => {
    const manager = new ConversationManager();
    await manager.appendContextNote('s1', 'note one');
    await manager.appendContextNote('s1', 'note two');

    const session = await manager.sessionService.getSession({
      appName: ADK_APP_NAME,
      userId: 's1',
      sessionId: await manager.getOrCreateAdkSession('s1'),
    });

    expect(session).toBeDefined();
    const textEvents = session!.events.filter(
      (e) => e.author === 'user' && e.content?.parts?.some((p) => p.text),
    );
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0].content?.parts?.[0].text).toBe('note one');
    expect(textEvents[1].content?.parts?.[0].text).toBe('note two');
  });

  it('isolates multiple sessions', async () => {
    const manager = new ConversationManager();
    await manager.appendContextNote('s1', 'a');
    await manager.appendContextNote('s2', 'b');

    expect(manager.getSessionIds().sort()).toEqual(['s1', 's2']);
    expect(manager.getActiveSessionCount()).toBe(2);
  });

  it('clears the ADK session and forgets the mapping', async () => {
    const manager = new ConversationManager();
    const adkSessionId = await manager.getOrCreateAdkSession('s1');

    await manager.clearSession('s1');
    expect(manager.getSessionIds()).toEqual([]);

    const session = await manager.sessionService.getSession({
      appName: ADK_APP_NAME,
      userId: 's1',
      sessionId: adkSessionId,
    });
    expect(session).toBeUndefined();
  });

  it('clearSession is a no-op for unknown sessions', async () => {
    const manager = new ConversationManager();
    await expect(manager.clearSession('nonexistent')).resolves.toBeUndefined();
  });

  it('re-creates the session after clearing', async () => {
    const manager = new ConversationManager();
    const first = await manager.getOrCreateAdkSession('s1');
    await manager.clearSession('s1');
    const second = await manager.getOrCreateAdkSession('s1');
    expect(second).toBe(first);
    expect(manager.getActiveSessionCount()).toBe(1);
  });
});
