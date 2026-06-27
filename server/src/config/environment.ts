import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Snwolley AI APIs are optional until later phases use them.
  SNWOLLEY_BASE_URL: z.string().url().default('https://v1.snwolley.ai'),
  SNWOLLEY_HACKATHON_API_KEY: z.string().optional().default(''),
  SNWOLLEY_AGENT_API_KEY: z.string().optional().default(''),
  SNWOLLEY_AGENT_ID: z.string().optional().default(''),
  SNWOLLEY_TIMEOUT: z.coerce.number().int().positive().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail fast: the server cannot run safely without valid configuration.
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
