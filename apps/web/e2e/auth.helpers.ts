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
  const status = await readAuthStatus();

  if (!status?.ready) {
    return false;
  }

  // Navigate to login first to ensure Firebase is initialized
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for auth to initialize
  await page
    .waitForFunction(
      () => {
        const win = window as Window & { __authLoading?: boolean };
        return win.__authLoading === false;
      },
      { timeout: 10000 }
    )
    .catch(() => {});

  // Sign in using the E2E method
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

  if (!signInResult.success) {
    return false;
  }

  // Wait for auth state to update
  await page.waitForTimeout(500);

  return true;
}
