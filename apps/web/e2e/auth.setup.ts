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
  customToken?: string;
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
 * Create a test user in Firebase Auth Emulator and generate a custom token
 * Returns the custom token for sign-in, or null on failure
 */
async function setupTestUser(): Promise<{ success: boolean; customToken?: string }> {
  try {
    initFirebaseAdmin();
    const auth = admin.auth();
    const firestore = admin.firestore();

    let userRecord: admin.auth.UserRecord;

    // Step 1: Create or Get User
    // Always delete and recreate to ensure clean state
    try {
      const existingUser = await auth.getUserByEmail(TEST_USER.email);
      await auth.deleteUser(existingUser.uid);
      console.log('  Deleted existing test user to recreate with fresh credentials');
    } catch {
      // User doesn't exist, that's fine
    }

    // Create fresh user
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
    );

    console.log('  Created/Updated user document in Firestore');

    // Step 4: Create a custom token for sign-in
    // This is more reliable than email/password sign-in with emulator
    const customToken = await auth.createCustomToken(userId, TEST_USER_CLAIMS);
    console.log('  Created custom token for authentication');

    return { success: true, customToken };
  } catch (error) {
    console.error('  Error setting up test user:', error);
    return { success: false };
  }
}

/**
 * Test entities for E2E tests
 */
const TEST_ENTITIES = [
  {
    id: 'e2e-entity-active-vendor',
    code: 'ENT-E2E-001',
    name: 'E2E Test Vendor',
    nameNormalized: 'e2e test vendor',
    roles: ['vendor'],
    contactPerson: 'John Vendor',
    email: 'vendor@e2etest.com',
    phone: '+1234567890',
    billingAddress: {
      street: '123 Vendor St',
      city: 'Test City',
      state: 'Test State',
      country: 'USA',
      postalCode: '12345',
    },
    isActive: true,
    isArchived: false,
  },
  {
    id: 'e2e-entity-active-customer',
    code: 'ENT-E2E-002',
    name: 'E2E Test Customer',
    nameNormalized: 'e2e test customer',
    roles: ['customer'],
    contactPerson: 'Jane Customer',
    email: 'customer@e2etest.com',
    phone: '+1234567891',
    billingAddress: {
      street: '456 Customer Ave',
      city: 'Test City',
      state: 'Test State',
      country: 'USA',
      postalCode: '12345',
    },
    isActive: true,
    isArchived: false,
  },
  {
    id: 'e2e-entity-archived',
    code: 'ENT-E2E-003',
    name: 'E2E Archived Entity',
    nameNormalized: 'e2e archived entity',
    roles: ['vendor', 'customer'],
    contactPerson: 'Archived Person',
    email: 'archived@e2etest.com',
    phone: '+1234567892',
    billingAddress: {
      street: '789 Archived Rd',
      city: 'Test City',
      state: 'Test State',
      country: 'USA',
      postalCode: '12345',
    },
    isActive: false,
    isArchived: true,
    archiveReason: 'E2E Test - Archived entity for testing',
  },
];

/**
 * Seed test entities in Firestore for E2E tests
 */
async function seedTestEntities(): Promise<boolean> {
  try {
    initFirebaseAdmin();
    const firestore = admin.firestore();
    const now = new Date();
    const batch = firestore.batch();

    // Use different timestamps so entities sort predictably (newest first)
    // Active entities get more recent timestamps to appear first in the list
    for (const [i, entity] of TEST_ENTITIES.entries()) {
      const docRef = firestore.collection('entities').doc(entity.id);
      // Archived entity gets oldest timestamp, active entities get newer timestamps
      const entityTime = new Date(
        now.getTime() - (entity.isArchived ? 10000 : (TEST_ENTITIES.length - i) * 1000)
      );
      batch.set(docRef, {
        ...entity,
        createdAt: admin.firestore.Timestamp.fromDate(entityTime),
        updatedAt: admin.firestore.Timestamp.fromDate(entityTime),
        ...(entity.isArchived && {
          archivedAt: admin.firestore.Timestamp.fromDate(entityTime),
          archivedBy: 'e2e-test',
          archivedByName: 'E2E Test',
        }),
      });
    }

    await batch.commit();
    console.log(`  Seeded ${TEST_ENTITIES.length} test entities`);
    return true;
  } catch (error) {
    console.error('  Error seeding test entities:', error);
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

      // Seed test entities for E2E tests
      if (userSetup.success) {
        await seedTestEntities();
      }

      if (userSetup.success && userSetup.customToken) {
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

        // Sign in using custom token (more reliable than email/password with emulator)
        const signInResult = await page.evaluate(async (token) => {
          const win = window as Window & {
            __e2eSignInWithToken?: (token: string) => Promise<void>;
          };

          if (!win.__e2eSignInWithToken) {
            return {
              success: false,
              error:
                'E2E custom token sign-in method not available. Is NEXT_PUBLIC_USE_EMULATOR=true?',
            };
          }

          try {
            await win.__e2eSignInWithToken(token);
            return { success: true };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        }, userSetup.customToken);

        if (signInResult.success) {
          console.log('  Signed in via custom token');

          // Wait for full auth state (user + claims)
          console.log('  Waiting for full auth state (user + claims)...');
          const authStateReady = await page
            .waitForFunction(
              () => {
                const win = window as Window & {
                  __authLoading?: boolean;
                  __authUser?: boolean;
                  __authClaims?: boolean;
                };
                return (
                  win.__authLoading === false &&
                  win.__authUser === true &&
                  win.__authClaims === true
                );
              },
              { timeout: 15000 }
            )
            .then(() => true)
            .catch(() => false);

          if (authStateReady) {
            console.log('  Full auth state ready');
            isAuthenticated = true;
            console.log('  Authentication successful!');
          } else {
            // Check what state we're in
            const authState = await page.evaluate(() => {
              const win = window as Window & {
                __authLoading?: boolean;
                __authUser?: boolean;
                __authClaims?: boolean;
              };
              return {
                loading: win.__authLoading,
                user: win.__authUser,
                claims: win.__authClaims,
              };
            });
            console.log('  Auth state:', authState);

            if (authState.user && !authState.claims) {
              console.log('  User authenticated but claims not available (pending approval state)');
            } else if (!authState.user) {
              console.log('  Auth state not persisted');
            } else {
              console.log('  Unknown auth state');
            }
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

  // Generate a fresh custom token for other tests to use
  let customTokenForTests: string | undefined;
  if (isAuthenticated) {
    try {
      initFirebaseAdmin();
      const auth = admin.auth();
      const user = await auth.getUserByEmail(TEST_USER.email);
      customTokenForTests = await auth.createCustomToken(user.uid, TEST_USER_CLAIMS);
    } catch {
      console.log('  Could not generate custom token for tests');
    }
  }

  // Write auth status file for test coordination
  await writeAuthStatus({
    ready: isAuthenticated,
    email: TEST_USER.email,
    password: TEST_USER.password,
    customToken: customTokenForTests,
    timestamp: Date.now(),
  });

  console.log(`  Auth setup complete (authenticated: ${isAuthenticated})\n`);
});
