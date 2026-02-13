import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://fddec34fb8b0e5616a996d737816d1c6@o4510878756831232.ingest.us.sentry.io/4510878757879808",

  // ── Release & Environment ──────────────────────────────
  release: process.env.COMMIT_SHA || 'dev',
  environment: process.env.NODE_ENV || 'development',

  // ── Performance ────────────────────────────────────────
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,

  // CPU profiling: 10% of traced transactions
  profilesSampleRate: 0.1,

  // ── PII ────────────────────────────────────────────────
  sendDefaultPii: true,

  // ── Integrations ───────────────────────────────────────
  integrations: [
    // Auto-instrument PostgreSQL queries via pg/postgres drivers
    Sentry.postgresIntegration(),
  ],

  // ── Initial Scope — Server Tags ────────────────────────
  initialScope: {
    tags: {
      runtime: 'nodejs',
    },
  },

  // ── beforeSend — Filter operational noise ──────────────
  beforeSend(event, hint) {
    const error = hint?.originalException;

    if (error instanceof Error) {
      // Connection errors — expected during deploys/restarts
      if (/ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT/.test(error.message)) {
        return null;
      }

      // Rate limiting responses (expected, not a bug)
      if (error.message.includes('Too many requests')) {
        return null;
      }
    }

    return event;
  },

  // ── Activation ─────────────────────────────────────────
  enabled: process.env.NODE_ENV === 'production',
});
