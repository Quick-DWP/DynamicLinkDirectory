// Playwright config for the Dynamic Link Directory UX/UI smoke tests.
// Points at a locally running portal (run.bat / `npm --prefix Backend start`).
// Override the target with BASE_URL=... if the app runs on a different port.
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:9008';

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results',
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
