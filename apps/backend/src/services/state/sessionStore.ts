import Redis from 'ioredis';
import { env } from '../../config/env.js';
import type { CallSession } from 'shared-types';

let redis: Redis | null = null;
let isConnecting = false;

export async function connectRedis(): Promise<Redis> {
  if (redis && redis.status === 'ready') {
    return redis;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (redis && redis.status === 'ready') {
          clearInterval(checkInterval);
          resolve(redis);
        }
      }, 100);
    });
  }

  isConnecting = true;

  return new Promise((resolve, reject) => {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    client.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    client.on('ready', () => {
      redis = client;
      isConnecting = false;
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      // Only reject if we haven't connected yet
      if (!redis) {
        isConnecting = false;
        reject(err);
      }
    });

    client.on('close', () => {
      console.log('⚠️ Redis connection closed');
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!redis) {
        isConnecting = false;
        client.disconnect();
        reject(new Error('Redis connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Get Redis client, auto-connecting if needed
 */
export async function getRedisAsync(): Promise<Redis> {
  if (redis && redis.status === 'ready') {
    return redis;
  }
  return connectRedis();
}

/**
 * Get Redis client synchronously (throws if not connected)
 * @deprecated Use getRedisAsync() instead
 */
export function getRedis(): Redis {
  if (!redis || redis.status !== 'ready') {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

// Session management functions
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 2; // 2 hours

export async function createSession(callId: string, session: CallSession): Promise<void> {
  const client = await getRedisAsync();
  await client.setex(
    `${SESSION_PREFIX}${callId}`,
    SESSION_TTL,
    JSON.stringify(session)
  );
}

export async function getSession(callId: string): Promise<CallSession | null> {
  try {
    const client = await getRedisAsync();
    const data = await client.get(`${SESSION_PREFIX}${callId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get session from Redis:', error);
    return null;
  }
}

export async function updateSession(
  callId: string, 
  updates: Partial<CallSession>
): Promise<CallSession | null> {
  const current = await getSession(callId);
  if (!current) return null;
  
  const updated = { ...current, ...updates };
  await createSession(callId, updated);
  return updated;
}

export async function deleteSession(callId: string): Promise<void> {
  const client = await getRedisAsync();
  await client.del(`${SESSION_PREFIX}${callId}`);
}

export async function appendTranscript(
  callId: string, 
  speaker: 'AI' | 'HUMAN' | 'CUSTOMER',
  text: string,
  timestamp?: number
): Promise<void> {
  const session = await getSession(callId);
  if (!session) return;
  
  const entry = { speaker, text, timestamp: timestamp ?? Date.now() };
  session.transcript.push(entry);
  await createSession(callId, session);
}
