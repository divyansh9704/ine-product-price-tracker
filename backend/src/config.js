// backend/src/config.js
// Central environment variable validation and configuration loader using Zod.

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Supabase credentials (optional in test mode where injected fake DB is used)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  
  // Cron security secret (used for constant-time comparison on POST /api/cron/scrape)
  CRON_SECRET: z.string().default('local-dev-cron-secret-change-in-production'),
  
  // CORS configuration
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Hard rule: Scrape ONLY demo.inelabteamdev.com
  STORE_BASE_URL: z.string().url().default('https://demo.inelabteamdev.com'),
  
  // Optional alerts
  SENDGRID_API_KEY: z.string().optional(),
  ALERT_EMAIL_TO: z.string().email().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error. Check your .env file.');
}

const env = parsed.data;

// In production, ensure required secrets are present
if (env.NODE_ENV === 'production') {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  }
  if (!env.CRON_SECRET || env.CRON_SECRET === 'local-dev-cron-secret-change-in-production') {
    throw new Error('A secure CRON_SECRET is required in production.');
  }
}

export const config = Object.freeze({
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  supabase: {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  },
  cronSecret: env.CRON_SECRET,
  frontendOrigin: env.FRONTEND_ORIGIN,
  storeBaseUrl: env.STORE_BASE_URL,
  email: {
    apiKey: env.SENDGRID_API_KEY,
    to: env.ALERT_EMAIL_TO
  }
});

export default config;
