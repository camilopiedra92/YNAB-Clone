import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { TEST_BASE_URL, TEST_DB_NAME } from './tests/test-constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'html',
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
        command: `mkdir -p .tmp && TMPDIR=.tmp NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=postgresql://localhost:5432/${TEST_DB_NAME} AUTH_SECRET=e2e-test-secret-at-least-32-characters-long AUTH_TRUST_HOST=true npx next build && TMPDIR=.tmp NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=postgresql://localhost:5432/${TEST_DB_NAME} AUTH_SECRET=e2e-test-secret-at-least-32-characters-long AUTH_TRUST_HOST=true npx next start -p 3001`,
        url: TEST_BASE_URL,
        reuseExistingServer: true,
        timeout: 300_000,
    },
});
