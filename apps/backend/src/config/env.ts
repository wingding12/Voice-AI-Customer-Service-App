import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment validation schema.
 * 
 * Required for basic operation:
 * - DATABASE_URL, REDIS_URL, PORT, NODE_ENV, FRONTEND_URL
 * 
 * Optional for Phase 0 development (will show warnings if missing):
 * - External API keys (Telnyx, Retell, AssemblyAI, OpenAI)
 * - WEBHOOK_BASE_URL
 */
const envSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().url(),
  
  // Redis (required)
  REDIS_URL: z.string().url(),
  
  // Server (required with defaults)
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Frontend (required)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  // Telnyx (optional for Phase 0)
  TELNYX_API_KEY: z.string().optional(),
  TELNYX_PUBLIC_KEY: z.string().optional(),
  TELNYX_CONNECTION_ID: z.string().optional(),
  TELNYX_PHONE_NUMBER: z.string().optional(),
  
  // Retell AI (optional for Phase 0)
  RETELL_API_KEY: z.string().optional(),
  RETELL_AGENT_ID: z.string().optional(),
  
  // AssemblyAI (optional for Phase 0)
  ASSEMBLYAI_API_KEY: z.string().optional(),
  
  // OpenAI (optional for Phase 0)
  OPENAI_API_KEY: z.string().optional(),
  
  // Webhooks (optional for Phase 0)
  WEBHOOK_BASE_URL: z.string().url().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  
  const env = parsed.data;
  
  // Warn about missing optional keys in development
  if (env.NODE_ENV === 'development') {
    const missingOptional: string[] = [];
    
    if (!env.TELNYX_API_KEY) missingOptional.push('TELNYX_API_KEY');
    if (!env.RETELL_API_KEY) missingOptional.push('RETELL_API_KEY');
    if (!env.ASSEMBLYAI_API_KEY) missingOptional.push('ASSEMBLYAI_API_KEY');
    if (!env.OPENAI_API_KEY) missingOptional.push('OPENAI_API_KEY');
    if (!env.WEBHOOK_BASE_URL) missingOptional.push('WEBHOOK_BASE_URL');
    
    if (missingOptional.length > 0) {
      console.warn('⚠️  Missing optional environment variables (features will be limited):');
      missingOptional.forEach(key => console.warn(`   - ${key}`));
    }
  }
  
  return env;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;

// Type guards for optional services
export function hasTelnyxConfig(): boolean {
  return !!(env.TELNYX_API_KEY && env.TELNYX_CONNECTION_ID);
}

export function hasRetellConfig(): boolean {
  return !!(env.RETELL_API_KEY && env.RETELL_AGENT_ID);
}

export function hasAssemblyAIConfig(): boolean {
  return !!env.ASSEMBLYAI_API_KEY;
}

export function hasOpenAIConfig(): boolean {
  return !!env.OPENAI_API_KEY;
}
