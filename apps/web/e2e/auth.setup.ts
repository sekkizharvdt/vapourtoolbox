/**
 * Playwright Authentication Setup
 *
 * This setup file handles authentication for E2E tests using Firebase Emulator.
 *
 * IMPORTANT: For authenticated tests to work, you need:
 * 1. Firebase Emulators running: firebase emulators:start --only auth,firestore
 * 2. Dev server started with emulator mode:
 *    NEXT_PUBLIC_USE_EMULATOR=true pnpm dev --port 3001
 *
 * Quick start:
 *   Terminal 1: firebase emulators:start --only auth,firestore
 *   Terminal 2: NEXT_PUBLIC_USE_EMULATOR=true pnpm dev --port 3001
 *   Terminal 3: NEXT_PUBLIC_USE_EMULATOR=true pnpm test:e2e
 *
 * How it works:
 * 1. Creates a test user in the Firebase Auth Emulator with custom claims using firebase-admin
 * 2. Signs in using email/password via the app's __e2eSignIn method
 * 3. Saves credentials and setup status for use in subsequent tests
 *
 * NOTE: Firebase Auth stores state in IndexedDB, which isn't captured by Playwright's
 * storageState. Each test must re-authenticate using the signInForTest() helper.
 */

import { test as setup } from '@playwright/test';
import * as admin from 'firebase-admin';

// Storage state file path
export const STORAGE_STATE_PATH = 'e2e/.auth/user.json';

// Auth status file path (used to communicate between setup and tests)
const AUTH_STATUS_PATH = 'e2e/.auth/status.json';

// Firebase Emulator URLs
const EMULATOR_AUTH_URL = 'http://127.0.0.1:9099';
const EMULATOR_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vapour-toolbox';

// Test user credentials for Firebase Emulator
const TEST_USER = {
  email: 'e2e-test@vapourdesal.com',
  password: 'testpassword123',
  displayName: 'E2E Test User',
};

// Custom claims for the test user (internal user with full permissions)
// 0x783FFFFF = getAllPermissions() - all defined permission flags
const TEST_USER_CLAIMS = {
  permissions: 0x783fffff, // Full permissions (bits 0-21 + 27-30)
  domain: 'internal',
  department: 'Engineering',
};

interface AuthStatus {
  ready: boolean;
  email: string;
  password: string;
  timestamp: number;
}

/**
 * Write auth status to file
 */
async function writeAuthStatus(status: AuthStatus): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  await fs.mkdir(path.dirname(AUTH_STATUS_PATH), { recursive: true });
  await fs.writeFile(AUTH_STATUS_PATH, JSON.stringify(status, null, 2));
}

/**
 * Check if Firebase Auth Emulator is running
 */
async function isEmulatorRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${EMULATOR_AUTH_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Initialize Firebase Admin SDK for the Emulator
 */
function initFirebaseAdmin() {
  // Set environment variables for the Admin SDK to use the emulators
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: EMULATOR_PROJECT_ID,
    });
    console.log('  Initialized Firebase Admin SDK');
  }
}

/**
 * Create a test user in Firebase Auth Emulator and set custom claims
 * Deletes existing user first to ensure password is correct
 */
async function setupTestUser(): Promise<boolean> {
  try {
    initFirebaseAdmin();
    const auth = admin.auth();
    const firestore = admin.firestore();

    let userRecord: admin.auth.UserRecord;

    // Step 1: Create or Get User
    // Always delete and recreate to ensure password is correct
    try {
      const existingUser = await auth.getUserByEmail(TEST_USER.email);
      await auth.deleteUser(existingUser.uid);
      console.log('  Deleted existing test user to recreate with fresh credentials');
    } catch {
      // User doesn't exist, that's fine
    }

    // Create fresh user with known password
    userRecord = await auth.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      displayName: TEST_USER.displayName,
      emailVerified: true,
    });
    console.log('  Created test user with fresh credentials');

    const userId = userRecord.uid;

    // Step 2: Set Custom Claims
    await auth.setCustomUserClaims(userId, TEST_USER_CLAIMS);
    console.log('  Set custom claims for test user');

    // Step 3: Create user document in Firestore
    const userDocRef = firestore.collection('users').doc(userId);
    const now = new Date();

    await userDocRef.set(
      {
        uid: userId,
        email: TEST_USER.email,
        displayName: TEST_USER.displayName,
        photoURL: '',
        status: 'active',
        isActive: true,
        permissions: TEST_USER_CLAIMS.permissions,
        domain: TEST_USER_CLAIMS.domain,
        department: TEST_USER_CLAIMS.department,
        assignedProjects: [],
        createdAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
      },
      { merge: true }
    ); // Merge to avoid overwriting if exists

    console.log('  Created/Updated user document in Firestore');

    return true;
  } catch (error) {
    console.error('  Error setting up test user:', error);
    return false;
  }
}

/**
 * Main authentication setup
 */
setup('authenticate', async ({ browser }) => {
  const useEmulator = process.env.NEXT_PUBLIC_USE_EMULATOR === 'true';

  console.log('\n  Setting up E2E authentication...');

  const context = await browser.newContext();
  const page = await context.newPage();

  let isAuthenticated = false;

  if (useEmulator) {
    console.log('  Mode: Firebase Emulator');

    const emulatorRunning = await isEmulatorRunning();
    if (!emulatorRunning) {
      console.log('  Firebase Auth Emulator not running at', EMULATOR_AUTH_URL);
      console.log('  Start with: firebase emulators:start --only auth,firestore');
    } else {
      const userSetup = await setupTestUser();

      if (userSetup) {
        // Navigate to the app
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
          .catch(() => {
            console.log('  Auth did not finish loading in time');
          });

        // Try to sign in using email/password (requires Email/Password provider enabled in Firebase Console)
        // This is the most reliable method when the provider is enabled
        const signInResult = await page.evaluate(
          async (creds) => {
            const win = window as Window & {
              __e2eSignIn?: (email: string, password: string) => Promise<void>;
            };

            if (!win.__e2eSignIn) {
              return {
                success: false,
                error: 'E2E sign-in method not available. Is NEXT_PUBLIC_USE_EMULATOR=true?',
              };
            }

            try {
              await win.__e2eSignIn(creds.email, creds.password);
              return { success: true };
            } catch (error) {
              return { success: false, error: String(error) };
            }
          },
          { email: TEST_USER.email, password: TEST_USER.password }
        );

        if (signInResult.success) {
          console.log('  Signed in via email/password');

          // Wait for auth state to update
          await page.waitForTimeout(1000);

          // Navigate to a protected page to verify auth worked
          await page.goto('/feedback');
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);

          const currentUrl = page.url();
          isAuthenticated =
            !currentUrl.includes('/login') && !currentUrl.includes('/pending-approval');

          if (isAuthenticated) {
            console.log('  Authentication successful!');
          } else if (currentUrl.includes('/pending-approval')) {
            console.log('  User authenticated but pending approval (claims not set properly)');
          } else {
            console.log('  Auth state not persisted');
          }
        } else {
          console.log('  Sign-in failed:', signInResult.error);
        }
      }
    }
  } else {
    console.log('  Mode: Production (no emulator)');
    console.log('  Tests requiring authentication will be skipped.');
    console.log('');
    console.log('  To enable authenticated tests:');
    console.log('  1. Start emulators: firebase emulators:start --only auth,firestore');
    console.log('  2. Start dev server: NEXT_PUBLIC_USE_EMULATOR=true pnpm dev --port 3001');
    console.log('  3. Run tests: NEXT_PUBLIC_USE_EMULATOR=true pnpm test:e2e');
  }

  // Ensure we have a valid page state
  if (!isAuthenticated) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  }

  await page.close();

  // Save storage state (for cookies/localStorage, though Firebase uses IndexedDB)
  await context.storageState({ path: STORAGE_STATE_PATH });
  await context.close();

  // Write auth status file for test coordination
  await writeAuthStatus({
    ready: isAuthenticated,
    email: TEST_USER.email,
    password: TEST_USER.password,
    timestamp: Date.now(),
  });

  console.log(`  Auth setup complete (authenticated: ${isAuthenticated})\n`);
});
