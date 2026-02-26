import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  timeout: 120_000,

  expect: {
    timeout: 60_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.3,
    },
  },

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: '../../../backend-integration/vercel-ai-sdk',
      port: 3003,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev',
      cwd: '..',
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],

  snapshotDir: './screenshots',
  outputDir: './test-results',
});
