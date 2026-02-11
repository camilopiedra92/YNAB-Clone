import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { TEST_BASE_URL, TEST_DB_NAME, replaceDbName } from './tests/test-constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

// Derive test DB URL from the environment's DATABASE_URL (preserves auth credentials for CI)
const envDbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/ynab_dev';
const testDbUrl = replaceDbName(envDbUrl, TEST_DB_NAME);

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'on-failure' }]],
    globalSetup: './tests/global-setup.ts',
    use: {
        baseURL: TEST_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        viewport: { width: 1280, height: 900 },
    },
    projects: [
        {
            name: 'auth-setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                storageState: AUTH_FILE,
            },
            dependencies: ['auth-setup'],
        },
    ],
    webServer: {
        // NOTE: DB name and port must match TEST_DB_NAME and TEST_BASE_URL from tests/test-constants.ts
        command: `./scripts/with-local-tmp.sh bash -c 'NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=${testDbUrl} AUTH_SECRET=e2e-test-secret-at-least-32-characters-long AUTH_TRUST_HOST=true npx next build && NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=${testDbUrl} AUTH_SECRET=e2e-test-secret-at-least-32-characters-long AUTH_TRUST_HOST=true npx next start -p 3001'`,
        url: TEST_BASE_URL,
        reuseExistingServer: true,
        timeout: 300_000,
        stdout: 'ignore',
        stderr: 'ignore',
    },
});
