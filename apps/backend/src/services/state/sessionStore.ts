import Redis from 'ioredis';
import { env } from '../../config/env.js';
import type { CallSession } from 'shared-types';

let redis: Redis | null = null;

export async function connectRedis(): Promise<Redis> {
  if (redis) return redis;

  return new Promise((resolve, reject) => {
    const client = new Redis(env.REDIS_URL);

    client.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    client.on('ready', () => {
      redis = client;
      resolve(client);
    });

    client.on('error', (err) => {
      console.error('❌ Redis error:', err);
      // Only reject if we haven't connected yet
      if (!redis) {
        reject(err);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!redis) {
        client.disconnect();
        reject(new Error('Redis connection timeout'));
      }
    }, 10000);
  });
}

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

// Session management functions
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 2; // 2 hours

export async function createSession(callId: string, session: CallSession): Promise<void> {
  const client = getRedis();
  await client.setex(
    `${SESSION_PREFIX}${callId}`,
    SESSION_TTL,
    JSON.stringify(session)
  );
}

export async function getSession(callId: string): Promise<CallSession | null> {
  const client = getRedis();
  const data = await client.get(`${SESSION_PREFIX}${callId}`);
  return data ? JSON.parse(data) : null;
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
  const client = getRedis();
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

