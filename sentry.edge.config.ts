import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://fddec34fb8b0e5616a996d737816d1c6@o4510878756831232.ingest.us.sentry.io/4510878757879808",

  // ── Release & Environment ──────────────────────────────
  release: process.env.COMMIT_SHA || 'dev',
  environment: process.env.NODE_ENV || 'development',

  // ── Performance ────────────────────────────────────────
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,

  // ── PII ────────────────────────────────────────────────
  sendDefaultPii: true,

  // ── Initial Scope — Edge Tags ──────────────────────────
  initialScope: {
    tags: {
      runtime: 'edge',
    },
  },

  // ── beforeSend — Filter operational noise ──────────────
  beforeSend(event, hint) {
    const error = hint?.originalException;

    if (error instanceof Error) {
      if (/ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT/.test(error.message)) {
        return null;
      }
    }

    return event;
  },

  // ── Activation ─────────────────────────────────────────
  enabled: process.env.NODE_ENV === 'production',
});
