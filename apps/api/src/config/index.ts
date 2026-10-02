import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_PORT: z.coerce.number().default(4000),
  APP_HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),
  DEFAULT_COUNTRY_CODE: z.string().default('ID'),
  DEFAULT_LOCALE: z.string().default('id-ID'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Jakarta'),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/padupos'),

  // Supabase Auth
  SUPABASE_URL: z.string().default('https://example.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('mock_anon_key_for_dev'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('mock_service_key_for_dev'),

  // Payment
  PAYMENT_PROVIDER: z.string().default('MOCK_SANDBOX'),
  PAYMENT_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  PAYMENT_API_KEY: z.string().default('sandbox_key'),
  PAYMENT_WEBHOOK_SECRET: z.string().default('sandbox_webhook_secret'),
  PAYMENT_WEBHOOK_TOKEN: z.string().default('sandbox_webhook_token'),

  // AI & ML
  LLM_PROVIDER: z.string().default('openai'),
  LLM_API_KEY: z.string().default('mock-key'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  ML_SERVICE_URL: z.string().default('http://localhost:8000'),
  ML_MIN_TRANSACTIONS_THRESHOLD: z.coerce.number().default(30),

  // Security
  JWT_SECRET: z.string().default('default-super-secret-jwt-key-minimum-32-chars-long'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().default(60000),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.parse(process.env);

if (parsed.APP_ENV === 'production') {
  if (parsed.JWT_SECRET === 'default-super-secret-jwt-key-minimum-32-chars-long' || parsed.JWT_SECRET.length < 32) {
    throw new Error('PRODUCTION SECURITY VIOLATION: JWT_SECRET must be configured with a secure key of at least 32 characters.');
  }
  if (parsed.PAYMENT_PROVIDER === 'MOCK_SANDBOX') {
    throw new Error('PRODUCTION CONFIGURATION ERROR: PAYMENT_PROVIDER cannot be MOCK_SANDBOX in production.');
  }
  if (parsed.PAYMENT_ENVIRONMENT === 'sandbox') {
    throw new Error('PRODUCTION CONFIGURATION ERROR: PAYMENT_ENVIRONMENT cannot be sandbox in production.');
  }
  if (parsed.CORS_ORIGIN === '*') {
    throw new Error('PRODUCTION SECURITY VIOLATION: CORS_ORIGIN cannot be wildcard (*) in production.');
  }
  if (parsed.DATABASE_URL.includes('localhost:5432/padupos') || parsed.DATABASE_URL.includes('postgres:postgres@')) {
    throw new Error('PRODUCTION CONFIGURATION ERROR: DATABASE_URL cannot use default localhost credentials in production.');
  }
}

export const config: EnvConfig = parsed;
