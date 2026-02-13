import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://fddec34fb8b0e5616a996d737816d1c6@o4510878756831232.ingest.us.sentry.io/4510878757879808",

  // ── Release & Environment ──────────────────────────────
  // Correlate client errors to exact deploy. NEXT_PUBLIC_COMMIT_SHA
  // is set via Dockerfile build-arg → next.config.ts env exposure.
  release: process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev',
  environment: process.env.NODE_ENV || 'development',

  // ── Performance ────────────────────────────────────────
  // 100% in dev for debugging, 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,

  // CPU profiling: 10% of traced sessions (adds ~5% overhead)
  profilesSampleRate: 0.1,

  // ── Session Replay ─────────────────────────────────────
  replaysSessionSampleRate: 0.1,   // 10% of normal sessions
  replaysOnErrorSampleRate: 1.0,   // 100% when an error occurs

  // ── PII ────────────────────────────────────────────────
  sendDefaultPii: true,

  // ── Integrations ───────────────────────────────────────
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,     // PII protection: mask all text
      blockAllMedia: true,   // Block media recordings
    }),
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      autoInject: false,     // Manual trigger — not auto-injected
      colorScheme: 'dark',
      showBranding: false,
      formTitle: 'Reportar un problema',
      submitButtonLabel: 'Enviar',
      cancelButtonLabel: 'Cancelar',
      nameLabel: 'Nombre',
      namePlaceholder: 'Tu nombre',
      emailLabel: 'Correo',
      emailPlaceholder: 'correo@ejemplo.com',
      messageLabel: 'Descripción',
      messagePlaceholder: '¿Qué pasó? ¿Qué esperabas que pasara?',
      successMessageText: '¡Gracias! Tu reporte fue enviado.',
    }),
  ],

  // ── Noise Filtering ────────────────────────────────────
  // Known-benign errors that pollute Sentry without actionable value.
  ignoreErrors: [
    // Browser extensions & third-party scripts
    /^Script error\.?$/,
    /^Non-Error promise rejection captured/,
    // ResizeObserver — benign browser quirk, fires on rapid layout changes
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors — expected during offline/flaky connections
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'AbortError',
    // Next.js hydration (usually caused by browser extensions injecting DOM)
    'Hydration failed',
    'There was an error while hydrating',
    'Minified React error #418',
    'Minified React error #423',
  ],

  // Exclude errors originating from browser extensions
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
  ],

  // ── beforeSend — Last-mile filter ──────────────────────
  beforeSend(event, hint) {
    const error = hint?.originalException;

    // Drop errors from browser extensions (extra safety beyond denyUrls)
    if (error instanceof Error && error.stack) {
      if (/chrome-extension:|moz-extension:|safari-extension:/.test(error.stack)) {
        return null;
      }
    }

    // Drop cancelled navigation (user clicked away)
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }

    return event;
  },

  // ── Activation ─────────────────────────────────────────
  enabled: process.env.NODE_ENV === 'production',
});
