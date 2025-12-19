/**
 * Playwright E2E Test Configuration
 *
 * Tests run against a local development server or Firebase emulator.
 *
 * Authentication:
 * - With emulator: NEXT_PUBLIC_USE_EMULATOR=true pnpm test:e2e
 * - Without emulator: Auth-required tests will be skipped
 */

import { defineConfig, devices } from '@playwright/test';

// Auth storage state path
const STORAGE_STATE_PATH = 'e2e/.auth/user.json';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

export default defineConfig({
  // Directory containing test files
  testDir: './e2e',

  // Run tests in files in parallel
  // Disabled on WSL to prevent memory exhaustion and disconnects
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers to prevent WSL memory exhaustion
  // WSL has limited memory - too many browser instances cause disconnects
  workers: 1,

  // Reporter to use
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording - disabled to reduce memory usage on WSL
    video: 'off',
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // Main test project - uses authenticated state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use authenticated state from setup
        storageState: STORAGE_STATE_PATH,
      },
      dependencies: ['setup'],
    },
    // Uncomment to add more browsers
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     storageState: STORAGE_STATE_PATH,
    //   },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     storageState: STORAGE_STATE_PATH,
    //   },
    //   dependencies: ['setup'],
    // },
  ],

  // Run your local dev server before starting the tests
  // IMPORTANT: For local development, start the dev server manually BEFORE running tests:
  //   NEXT_PUBLIC_USE_EMULATOR=true pnpm dev --port 3001
  // This prevents Playwright from spawning additional processes that can crash WSL
  webServer: {
    command: 'pnpm dev --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: true, // Always reuse to prevent spawning new processes
    timeout: 120 * 1000, // 2 minutes to start
  },

  // Timeout for each test
  timeout: 60 * 1000, // 1 minute

  // Timeout for each expect assertion
  expect: {
    timeout: 10 * 1000, // 10 seconds
  },

  // Output folder for test artifacts
  outputDir: 'test-results',
});
