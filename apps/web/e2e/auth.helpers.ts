/**
 * Authentication helpers for E2E tests
 *
 * These helpers allow tests to sign in using the Firebase emulator.
 * The setup test (auth.setup.ts) must run first to create the test user.
 */

import { Page } from '@playwright/test';

// Auth status file path (must match auth.setup.ts)
const AUTH_STATUS_PATH = 'e2e/.auth/status.json';

interface AuthStatus {
  ready: boolean;
  email: string;
  password: string;
  timestamp: number;
}

/**
 * Read auth status from file
 */
async function readAuthStatus(): Promise<AuthStatus | null> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(AUTH_STATUS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if emulator is available and test user is set up
 */
export async function isTestUserReady(): Promise<boolean> {
  const status = await readAuthStatus();
  return status?.ready ?? false;
}

/**
 * Sign in for a test page
 * Call this at the start of each test that needs authentication
 */
export async function signInForTest(page: Page): Promise<boolean> {
  console.log(`  [signInForTest] Starting sign-in process...`);

  const status = await readAuthStatus();
  console.log(`  [signInForTest] Auth status: ready=${status?.ready}`);

  if (!status?.ready) {
    console.log(`  [signInForTest] Status not ready - returning false`);
    return false;
  }

  // Navigate to login first to ensure Firebase is initialized
  console.log(`  [signInForTest] Navigating to /login...`);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  console.log(`  [signInForTest] Login page loaded, URL: ${page.url()}`);

  // Wait for auth to initialize
  console.log(`  [signInForTest] Waiting for __authLoading === false...`);
  const authLoadingResult = await page
    .waitForFunction(
      () => {
        const win = window as Window & { __authLoading?: boolean };
        return win.__authLoading === false;
      },
      { timeout: 10000 }
    )
    .then(() => true)
    .catch(() => false);

  console.log(`  [signInForTest] Auth loading wait result: ${authLoadingResult}`);

  // Sign in using the E2E method
  console.log(`  [signInForTest] Calling __e2eSignIn...`);
  const signInResult = await page.evaluate(
    async (creds) => {
      const win = window as Window & {
        __e2eSignIn?: (email: string, password: string) => Promise<void>;
      };

      if (!win.__e2eSignIn) {
        return { success: false, error: 'E2E sign-in method not available' };
      }

      try {
        await win.__e2eSignIn(creds.email, creds.password);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    { email: status.email, password: status.password }
  );

  console.log(
    `  [signInForTest] Sign-in result: success=${signInResult.success}, error=${signInResult.success ? 'none' : signInResult.error}`
  );

  if (!signInResult.success) {
    console.log(`  [signInForTest] Sign-in failed - returning false`);
    return false;
  }

  // Wait for full auth state (user + claims) not just loading
  // This ensures Firebase has fully restored auth and claims are available
  console.log(`  [signInForTest] Waiting for full auth state (user + claims)...`);
  const authStateReady = await page
    .waitForFunction(
      () => {
        const win = window as Window & {
          __authLoading?: boolean;
          __authUser?: boolean;
          __authClaims?: boolean;
        };
        return win.__authLoading === false && win.__authUser === true && win.__authClaims === true;
      },
      { timeout: 10000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!authStateReady) {
    console.log(`  [signInForTest] Auth state wait timed out - returning false`);
    return false;
  }

  console.log(`  [signInForTest] Full auth state ready - returning true`);
  return true;
}
