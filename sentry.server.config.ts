import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://fddec34fb8b0e5616a996d737816d1c6@o4510878756831232.ingest.us.sentry.io/4510878757879808",
  
  // Performance: 100% in dev, 20% in production
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.2,
  
  // Send user IP + request headers for debugging
  sendDefaultPii: true,
  
  // Tag environment for filtering in Sentry dashboard
  environment: process.env.NODE_ENV || 'development',
  
  // Tag releases with commit SHA for deployment tracking
  release: process.env.COMMIT_SHA || 'dev',
  
  enabled: process.env.NODE_ENV === 'production',
});
