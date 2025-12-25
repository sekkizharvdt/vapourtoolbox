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

  // Limit workers based on environment
  // CI has more resources, WSL has limited memory
  workers: process.env.CI ? 4 : 1,

  // Reporter to use
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3001',

    // Navigation timeout - increased to handle slow first-page compilation
    // Next.js dev server compiles pages on-demand, which can take 20-30s for the first request
    navigationTimeout: 60 * 1000, // 60 seconds for page.goto()

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
      use: {
        // Browser launch options for stability
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage', // Prevents /dev/shm memory issues
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      },
    },

    // Main test project - uses authenticated state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use authenticated state from setup
        storageState: STORAGE_STATE_PATH,
        // Browser launch options for stability
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
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
  // The webServer starts with emulator environment variables when NEXT_PUBLIC_USE_EMULATOR=true
  // For local development, you can also start the dev server manually BEFORE running tests:
  //   NEXT_PUBLIC_USE_EMULATOR=true NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL=http://127.0.0.1:9099 pnpm dev --port 3001
  webServer: {
    command:
      process.env.NEXT_PUBLIC_USE_EMULATOR === 'true'
        ? 'NEXT_PUBLIC_USE_EMULATOR=true NEXT_PUBLIC_FIREBASE_EMULATOR_AUTH_URL=http://127.0.0.1:9099 NEXT_PUBLIC_FIREBASE_EMULATOR_FIRESTORE_URL=127.0.0.1:8080 pnpm dev --port 3001'
        : 'pnpm dev --port 3001',
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
