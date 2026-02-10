import { defineConfig } from 'vitest/config';
import path from 'path';

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
                'lib/repos/client.ts',   // Production I/O singleton — not unit-testable
                'lib/engine/types.ts',   // Type-only file — no runtime code
                'lib/persistence/**',    // IndexedDB persistence — tested via E2E
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
