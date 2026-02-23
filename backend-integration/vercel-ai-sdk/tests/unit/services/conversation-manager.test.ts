import { describe, it, expect } from 'vitest';
import { ConversationManager } from '../../../src/services/conversation-manager.js';

describe('ConversationManager', () => {
  it('returns empty array for unknown session', () => {
    const manager = new ConversationManager();
    expect(manager.getHistory('unknown')).toEqual([]);
  });

  it('adds and retrieves messages', () => {
    const manager = new ConversationManager();
    manager.addMessage('s1', { role: 'user', content: 'hello' });
    manager.addMessage('s1', { role: 'assistant', content: 'hi' });

    const history = manager.getHistory('s1');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('hello');
    expect(history[1].content).toBe('hi');
  });

  it('prunes history keeping first message and most recent', () => {
    const manager = new ConversationManager();
    for (let i = 0; i < 25; i++) {
      manager.addMessage('s1', { role: 'user', content: `msg-${i}` });
    }

    const history = manager.getHistory('s1');
    expect(history).toHaveLength(20);
    expect(history[0].content).toBe('msg-0');
    expect(history[history.length - 1].content).toBe('msg-24');
  });

  it('clears session history', () => {
    const manager = new ConversationManager();
    manager.addMessage('s1', { role: 'user', content: 'hello' });
    manager.clearHistory('s1');
    expect(manager.getHistory('s1')).toEqual([]);
  });

  it('tracks session IDs and count', () => {
    const manager = new ConversationManager();
    manager.addMessage('s1', { role: 'user', content: 'a' });
    manager.addMessage('s2', { role: 'user', content: 'b' });

    expect(manager.getSessionIds()).toEqual(['s1', 's2']);
    expect(manager.getActiveSessionCount()).toBe(2);
  });
});
