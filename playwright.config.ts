import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'html',
    globalSetup: './tests/global-setup.ts',
    use: {
        baseURL: 'http://localhost:3001',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        viewport: { width: 1280, height: 900 },
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    webServer: {
        command: 'mkdir -p .tmp && TMPDIR=.tmp NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=postgresql://localhost:5432/ynab_test npx next build && TMPDIR=.tmp NODE_ENV=production NEXT_TEST_BUILD=1 DATABASE_URL=postgresql://localhost:5432/ynab_test npx next start -p 3001',
        url: 'http://localhost:3001',
        reuseExistingServer: true,
        timeout: 120_000,
    },
});

