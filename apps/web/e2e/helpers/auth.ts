import { Page } from '@playwright/test';
import { createCustomToken, createTestUser, type TestUser } from './firebase-admin';

/**
 * Default test users
 */
export const TEST_USERS = {
  admin: {
    uid: 'test-admin-001',
    email: 'test-admin@vapourdesal.com',
    displayName: 'Test Admin',
    customClaims: {
      roles: ['SUPER_ADMIN'],
      permissions: 1048575, // All permissions (getAllPermissions())
      domain: 'internal',
      assignedProjects: [],
      department: 'Engineering',
    },
  },
  user: {
    uid: 'test-user-001',
    email: 'test-user@vapourdesal.com',
    displayName: 'Test User',
    customClaims: {
      roles: ['SUPER_ADMIN'],
      permissions: 1048575, // All permissions for testing
      domain: 'internal',
      assignedProjects: [],
      department: 'Engineering',
    },
  },
  pending: {
    uid: 'test-pending-001',
    email: 'test-pending@vapourdesal.com',
    displayName: 'Test Pending User',
    customClaims: {},
  },
} as const;

/**
 * Authenticate using custom token
 * This uses the app's own Firebase instance via window
 */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
  // Ensure user exists
  await createTestUser(user);

  // Create custom token
  const customToken = await createCustomToken(user.uid);

  // Navigate to app (loads Firebase)
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Sign in using the app's Firebase Auth instance (exposed to window for testing)
  const signedIn = await page.evaluate(async (token) => {
    try {
      // Wait for Firebase Auth to be available on window
      let attempts = 0;
      while (!(window as any).__firebaseAuth && attempts < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (!(window as any).__firebaseAuth) {
        throw new Error('Firebase Auth not available on window after waiting');
      }

      const auth = (window as any).__firebaseAuth;

      // Import signInWithCustomToken from the Firebase Auth CDN
      // @ts-expect-error - Dynamic CDN import not recognized by TypeScript
      const { signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js');

      const userCredential = await signInWithCustomToken(auth, token);

      // Force token refresh to get custom claims
      await userCredential.user.getIdToken(true);

      // Get the ID token result to verify claims
      const idTokenResult = await userCredential.user.getIdTokenResult();

      return {
        success: true,
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        claims: idTokenResult.claims,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }, customToken);

  if (!signedIn.success) {
    throw new Error(`Failed to sign in: ${signedIn.error}`);
  }

  // Wait for auth state to propagate
  await page.waitForTimeout(1000);

  console.log(`✅ Signed in as ${user.email} (${user.uid})`);
  console.log(`   Claims: ${JSON.stringify(signedIn.claims, null, 2)}`);
}

/**
 * Login as admin
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginUser(page, TEST_USERS.admin);
}

/**
 * Login as regular user
 */
export async function loginAsUser(page: Page): Promise<void> {
  await loginUser(page, TEST_USERS.user);
}

/**
 * Logout
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { signOut, getAuth } = await import('firebase/auth');
    const auth = getAuth();
    await signOut(auth);
  });

  console.log('✅ Signed out');
}

/**
 * Check if authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    return auth.currentUser !== null;
  });
}
