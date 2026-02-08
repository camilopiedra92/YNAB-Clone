import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // better-sqlite3 is a native module — can't serialize across worker threads
        pool: 'forks',
        // Increase timeout for DB-heavy tests
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
