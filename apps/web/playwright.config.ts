import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Tests run against local development server or deployed environments
 */

// Use environment variable or default to local dev server
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run Firebase Emulator and dev server before tests
  webServer: [
    // Firebase Emulators (Auth + Firestore)
    {
      command: 'firebase emulators:start --only auth,firestore',
      port: 9099,
      reuseExistingServer: !process.env.CI, // Don't reuse in CI
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 60 * 1000,
    },
    // Application server
    {
      // Use production server in CI (faster startup), dev server locally (hot reload)
      command: process.env.CI ? 'pnpm start' : 'pnpm dev',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI, // Don't reuse in CI
      timeout: process.env.CI ? 60 * 1000 : 120 * 1000, // Production server starts faster
      env: {
        // Firebase Client Configuration (required by app)
        NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key-for-emulator',
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vapour-toolbox',
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vapour-toolbox.appspot.com',
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
        NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:fakefakefakefake',
        // Use Firebase Emulator for tests
        NEXT_PUBLIC_USE_EMULATOR: process.env.NEXT_PUBLIC_USE_EMULATOR || 'true',
        NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL || 'http://localhost:9099',
        NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL || 'localhost:8080',
      },
    },
  ],

  // Global setup to create test users before all tests
  globalSetup: require.resolve('./e2e/global-setup.ts'),
});
