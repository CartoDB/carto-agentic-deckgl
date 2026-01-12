// backend/src/services/redis-session-service.ts
import { Redis } from 'ioredis';
import {
  BaseSessionService,
  type CreateSessionRequest,
  type GetSessionRequest,
  type ListSessionsRequest,
  type DeleteSessionRequest,
  type ListSessionsResponse,
  type Session,
  type Event,
  createSession as adkCreateSession,
} from '@google/adk';

/**
 * Redis-based session service for Google ADK
 * Provides persistent session storage that survives server restarts
 *
 * Extends BaseSessionService to inherit the built-in appendEvent() implementation
 * which properly manages events and session state.
 */
export class RedisSessionService extends BaseSessionService {
  private redis: Redis;
  private keyPrefix: string = 'adk:session:';
  private defaultTTL: number = 86400; // 24 hours in seconds

  constructor(redisUrl?: string, options?: { keyPrefix?: string; ttl?: number }) {
    // Call parent constructor
    super();

    // Connect to Redis
    this.redis = redisUrl
      ? new Redis(redisUrl)
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
        });

    // Optional configuration
    if (options?.keyPrefix) {
      this.keyPrefix = options.keyPrefix;
    }
    if (options?.ttl) {
      this.defaultTTL = options.ttl;
    }

    // Handle Redis connection events
    this.redis.on('connect', () => {
      console.log('[Redis Session] Connected to Redis');
    });

    this.redis.on('error', (error: Error) => {
      console.error('[Redis Session] Redis error:', error);
    });

    this.redis.on('close', () => {
      console.log('[Redis Session] Redis connection closed');
    });
  }

  /**
   * Generate Redis key for a session
   */
  private getKey(appName: string, userId: string, sessionId: string): string {
    return `${this.keyPrefix}${appName}:${userId}:${sessionId}`;
  }

  /**
   * Create a new session
   */
  async createSession({ appName, userId, state, sessionId }: CreateSessionRequest): Promise<Session> {
    // Use ADK's createSession helper to generate session with proper structure
    const session = adkCreateSession({
      id: sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      appName,
      userId,
      state: state || {},
    });

    const key = this.getKey(appName, userId, session.id);

    // Store in Redis with TTL
    await this.redis.setex(key, this.defaultTTL, JSON.stringify(session));

    console.log('[Redis Session] Created session:', session.id);

    return session;
  }

  /**
   * Get an existing session
   * Supports filtering events via config parameter
   */
  async getSession({ appName, userId, sessionId, config }: GetSessionRequest): Promise<Session | undefined> {
    const key = this.getKey(appName, userId, sessionId);
    const data = await this.redis.get(key);

    if (!data) {
      console.log('[Redis Session] Session not found:', sessionId);
      return undefined;
    }

    let session = JSON.parse(data) as Session;
    console.log('[Redis Session] Retrieved session:', sessionId, `(${session.events.length} events)`);

    // Apply event filtering if config is provided
    if (config) {
      const filteredEvents = session.events.filter(event => {
        // Filter by timestamp if specified
        if (config.afterTimestamp && event.timestamp < config.afterTimestamp) {
          return false;
        }
        return true;
      });

      // Limit to recent events if specified
      if (config.numRecentEvents !== undefined) {
        session = {
          ...session,
          events: filteredEvents.slice(-config.numRecentEvents),
        };
      } else {
        session = {
          ...session,
          events: filteredEvents,
        };
      }

      console.log('[Redis Session] Filtered events:', session.events.length);
    }

    return session;
  }

  /**
   * Append event to session and persist to Redis
   * Overrides BaseSessionService to add Redis persistence
   */
  async appendEvent({ session, event }: { session: Session; event: Event }): Promise<Event> {
    // Call base class to modify session object (adds event, updates state)
    const result = await super.appendEvent({ session, event });

    // Update lastUpdateTime
    session.lastUpdateTime = event.timestamp || Date.now();

    // Persist to Redis
    const key = this.getKey(session.appName, session.userId, session.id);
    await this.redis.setex(key, this.defaultTTL, JSON.stringify(session));

    console.log('[Redis Session] Appended event to session:', session.id, `(${session.events.length} events)`);

    return result;
  }

  /**
   * Delete a session
   */
  async deleteSession({ appName, userId, sessionId }: DeleteSessionRequest): Promise<void> {
    const key = this.getKey(appName, userId, sessionId);
    await this.redis.del(key);

    console.log('[Redis Session] Deleted session:', sessionId);
  }

  /**
   * List all sessions for a user
   */
  async listSessions({ appName, userId }: ListSessionsRequest): Promise<ListSessionsResponse> {
    const pattern = `${this.keyPrefix}${appName}:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return { sessions: [] };
    }

    const sessions: Session[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const session = JSON.parse(data);
        // As per ADK docs: events and states are not set when listing
        sessions.push({
          ...session,
          events: [],
          state: {},
        });
      }
    }

    console.log('[Redis Session] Listed sessions:', sessions.length);

    return { sessions };
  }


  /**
   * Extend session TTL (reset expiration)
   */
  async extendSession(appName: string, userId: string, sessionId: string, ttl?: number): Promise<void> {
    const key = this.getKey(appName, userId, sessionId);
    const expirationTime = ttl || this.defaultTTL;
    await this.redis.expire(key, expirationTime);

    console.log('[Redis Session] Extended TTL for session:', sessionId, `(${expirationTime}s)`);
  }

  /**
   * Get session TTL (time until expiration)
   */
  async getSessionTTL(appName: string, userId: string, sessionId: string): Promise<number> {
    const key = this.getKey(appName, userId, sessionId);
    return await this.redis.ttl(key);
  }

  /**
   * Check if session exists
   */
  async sessionExists(appName: string, userId: string, sessionId: string): Promise<boolean> {
    const key = this.getKey(appName, userId, sessionId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
    console.log('[Redis Session] Disconnected from Redis');
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('[Redis Session] Health check failed:', error);
      return false;
    }
  }
}
