import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Ensure temp directory is writable in sandboxed environments.
// This mirrors scripts/with-local-tmp.sh for when vitest is invoked directly
// (e.g. `npx vitest run`). Setting process.env.TMPDIR here affects the main
// process; forked workers inherit this via process.env at fork time.
const localTmp = path.resolve(__dirname, '.tmp');
fs.mkdirSync(localTmp, { recursive: true });
if (!process.env.TMPDIR || !process.env.TMPDIR.includes('.tmp')) {
    process.env.TMPDIR = localTmp;
}

export default defineConfig({
    test: {
        // pglite uses shared memory — forks avoids serialization issues across worker threads
        pool: 'forks',
        // Increase timeout for DB-heavy tests
        testTimeout: 10000,
        // Exclude Playwright E2E tests (they run via `npx playwright test`)
        exclude: ['node_modules', '.agent/**', 'tests/**'],
        coverage: {
            include: ['lib/**'],
            exclude: [
                'lib/**/index.ts',       // Barrel re-exports — no executable logic
                'lib/engine/types.ts',   // Type-only file — no runtime code
                'lib/persistence/**',    // IndexedDB persistence — tested via E2E
                'lib/auth.ts',           // NextAuth Node config — tested via E2E
                'lib/auth.config.ts',    // NextAuth Edge config — tested via E2E
                'lib/auth-helpers.ts',   // Auth session helpers — tested via E2E
                'lib/tenant-context.ts', // RLS tenant context — tested via E2E
                'lib/db/schema.ts',      // Declarative Drizzle schema — no executable logic
                'lib/__tests__/**',      // Test infrastructure — not production code
            ],
            thresholds: {
                // The Financial Engine is the core brain of the app.
                // It must have 100% logical branch coverage to be considered "World-Class".
                'lib/engine/**': {
                    branches: 100,
                    functions: 100,
                    lines: 100,
                    statements: 100,
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
