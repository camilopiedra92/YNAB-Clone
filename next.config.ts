import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Standalone output for Docker — creates self-contained .next/standalone
  // with only production-required files (~150MB vs ~1GB without it).
  // Disabled for test builds (NEXT_TEST_BUILD) — standalone requires
  // `node server.js` startup, but tests use `next start` for simplicity.
  // Production deploys (Coolify/Docker) do NOT set NEXT_TEST_BUILD.
  output: process.env.NEXT_TEST_BUILD ? undefined : 'standalone',

  // Expose COMMIT_SHA to client-side code for Sentry release tracking.
  // Server-side uses COMMIT_SHA directly; client needs NEXT_PUBLIC_ prefix.
  env: {
    NEXT_PUBLIC_COMMIT_SHA: process.env.COMMIT_SHA || 'dev',
  },

  // Use a separate build directory for E2E tests so `next build` doesn't
  // overwrite the dev server's .next/ cache and crash it.
  distDir: process.env.NEXT_TEST_BUILD ? '.next-test' : '.next',

  // ── Security Headers ──────────────────────────────────────────────
  async headers() {
    const securityHeaders = [
      // Prevent MIME-type sniffing
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Prevent clickjacking — page cannot be embedded in iframes
      { key: 'X-Frame-Options', value: 'DENY' },
      // Legacy XSS protection for older browsers
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // Control referrer information sent with requests
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Disable unused browser APIs
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
      },
      // Force HTTPS (2 years, includeSubDomains, preload-eligible)
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      // Content Security Policy — restrict resource loading
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
          "style-src 'self' 'unsafe-inline'",                // CSS-in-JS and inline styles
          "img-src 'self' data: blob:",                       // data URIs for icons, blob for generated images
          "font-src 'self' data:",                            // self-hosted fonts + data URIs
          "connect-src 'self'",                               // API calls to same origin (and Sentry tunnel)
          "frame-ancestors 'none'",                           // Reinforces X-Frame-Options DENY
          "base-uri 'self'",                                  // Prevent base tag hijacking
          "form-action 'self'",                               // Forms can only submit to same origin
        ].join('; '),
      },
    ];

    const corsOrigin = process.env.CORS_ORIGIN || '';

    return [
      // Apply security headers to ALL routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // CORS headers for API routes (production only — same-origin in dev)
      ...(corsOrigin
        ? [
            {
              source: '/api/:path*',
              headers: [
                { key: 'Access-Control-Allow-Origin', value: corsOrigin },
                { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
                { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                { key: 'Access-Control-Max-Age', value: '86400' },
              ],
            },
          ]
        : []),
    ];
  },
};

const sentryWrappedConfig = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-javascript/blob/master/packages/nextjs/src/config/types.ts

  // Sentry org + project (from sentry.io dashboard)
  org: process.env.SENTRY_ORG || "camilo-piedrahita",
  project: process.env.SENTRY_PROJECT || "ynab-app",

  // Explicitly provide auth token — when undefined, Sentry skips upload entirely
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only log Sentry build output when actively uploading (token present in production builds)
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // ── Source Maps ──────────────────────────────────────────
  // Upload source maps during build (requires SENTRY_AUTH_TOKEN).
  // Disabled when no token is present (E2E/local builds) — clean no-op.
  // Delete after upload so they're never served to clients.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },

  // Automatically tree-shake Sentry debug logging to reduce bundle size
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },

  // Route Sentry requests through your server (avoids ad-blockers).
  // Disabled in dev — Sentry's tunnel uses an embedded PGlite DB that
  // crashes with "Operation timed out" when .tmp/ has stale lock files.
  tunnelRoute: process.env.NODE_ENV === 'production' ? "/monitoring" : undefined,
});

// Chain: nextConfig → Sentry → next-intl
export default withNextIntl(sentryWrappedConfig);
