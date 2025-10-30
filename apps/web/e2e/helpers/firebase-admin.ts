/**
 * Firebase Admin SDK helper for E2E tests
 * Creates custom auth tokens for testing
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin with emulator settings
if (!admin.apps.length) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  admin.initializeApp({
    projectId: 'vapour-toolbox',
  });
}

const auth: admin.auth.Auth = admin.auth();
const db: admin.firestore.Firestore = admin.firestore();

export interface TestUser {
  uid: string;
  email: string;
  displayName?: string;
  customClaims?: Record<string, any>;
}

/**
 * Create a custom auth token for testing with custom claims
 */
export async function createCustomToken(
  userId: string,
  customClaims?: Record<string, any>
): Promise<string> {
  try {
    const token = await auth.createCustomToken(userId, customClaims);
    return token;
  } catch (error) {
    console.error('Error creating custom token:', error);
    throw error;
  }
}

/**
 * Create test user in emulator (both Auth and Firestore profile)
 */
export async function createTestUser(user: TestUser): Promise<void> {
  try {
    // Check if user already exists
    let userExists = false;
    try {
      await auth.getUser(user.uid);
      console.log(`User ${user.email} already exists`);
      userExists = true;

      // Update custom claims if provided
      if (user.customClaims) {
        await auth.setCustomUserClaims(user.uid, user.customClaims);
      }
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new Auth user if it doesn't exist
    if (!userExists) {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: true,
      });

      // Set custom claims
      if (user.customClaims) {
        await auth.setCustomUserClaims(user.uid, user.customClaims);
      }

      console.log(`Created test user: ${user.email}`);
    }

    // Create or update Firestore user profile
    // Match the app's expected schema for user approval
    const userProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'Test User',
      status: user.customClaims?.roles && user.customClaims.roles.length > 0 ? 'active' : 'pending',
      isActive: user.customClaims?.roles && user.customClaims.roles.length > 0 ? true : false,
      roles: user.customClaims?.roles || [],
      permissions: user.customClaims?.permissions || 0,
      domain: user.customClaims?.domain || 'internal',
      department: user.customClaims?.department || 'Engineering',
      assignedProjects: user.customClaims?.assignedProjects || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(user.uid).set(userProfile, { merge: true });
    console.log(`Created/updated Firestore profile for ${user.email} (status: ${userProfile.status})`);
  } catch (error) {
    console.error(`Error creating test user:`, error);
    throw error;
  }
}

/**
 * Delete test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  try {
    await auth.deleteUser(userId);
    console.log(`Deleted test user: ${userId}`);
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') {
      console.error(`Error deleting test user:`, error);
    }
  }
}

/**
 * Clear all test data
 */
export async function clearTestData(): Promise<void> {
  try {
    // Delete all entities
    const entities = await db.collection('entities').get();
    const batch = db.batch();
    entities.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    console.log('Cleared test data');
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
}

export { auth, db };
