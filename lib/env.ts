import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1),

  // Authentication (Auth.js v5)
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(), // Auto-detected in dev
  AUTH_TRUST_HOST: z.string().optional().default('true'),

  // Application
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),

  // Deployment (optional — used in production)
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.string().optional(),

  // YNAB Data Import (Local file paths or URLs)
  // Optional because they are only needed for the import script
  YNAB_REGISTER_CSV: z.string().optional(),
  YNAB_PLAN_CSV: z.string().optional(),
  
  // Next.js - build time only, usually
  NEXT_TEST_BUILD: z.string().optional(),
});

// Validate `process.env` against the schema
// We use `parse` so it throws if validation fails, halting the app startup immediately.
const env = envSchema.parse(process.env);

export default env;
