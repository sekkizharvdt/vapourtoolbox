/**
 * Integration Test Setup
 *
 * Configures Firebase Emulator connections for integration tests.
 * Tests run against local emulators, not production.
 */

import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, Firestore, terminate } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';

// Emulator configuration
const EMULATOR_CONFIG = {
  firestore: {
    host: 'localhost',
    port: 8080,
  },
  auth: {
    host: 'http://localhost',
    port: 9099,
  },
};

// Test Firebase config (doesn't need real values for emulator)
const TEST_FIREBASE_CONFIG = {
  apiKey: 'test-api-key',
  authDomain: 'test-project.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

let testApp: FirebaseApp | null = null;
let testDb: Firestore | null = null;
let testAuth: Auth | null = null;
let isEmulatorConnected = false;

/**
 * Initialize Firebase for integration tests
 * Connects to local emulators
 */
export function initializeTestFirebase(): { db: Firestore; auth: Auth } {
  // Clean up any existing apps
  const existingApps = getApps();
  existingApps.forEach((app) => {
    if (app.name === 'integration-test') {
      deleteApp(app);
    }
  });

  // Initialize test app
  testApp = initializeApp(TEST_FIREBASE_CONFIG, 'integration-test');
  testDb = getFirestore(testApp);
  testAuth = getAuth(testApp);

  // Connect to emulators (only once)
  if (!isEmulatorConnected) {
    connectFirestoreEmulator(
      testDb,
      EMULATOR_CONFIG.firestore.host,
      EMULATOR_CONFIG.firestore.port
    );
    connectAuthEmulator(testAuth, `${EMULATOR_CONFIG.auth.host}:${EMULATOR_CONFIG.auth.port}`);
    isEmulatorConnected = true;
  }

  return { db: testDb, auth: testAuth };
}

/**
 * Get the test Firestore instance
 */
export function getTestDb(): Firestore {
  if (!testDb) {
    throw new Error('Test Firebase not initialized. Call initializeTestFirebase() first.');
  }
  return testDb;
}

/**
 * Get the test Auth instance
 */
export function getTestAuth(): Auth {
  if (!testAuth) {
    throw new Error('Test Firebase not initialized. Call initializeTestFirebase() first.');
  }
  return testAuth;
}

/**
 * Clean up test data after tests
 * Note: In emulator, you can also use the REST API to clear all data
 */
export async function cleanupTestData(): Promise<void> {
  // The emulator can be cleared via REST API:
  // POST http://localhost:8080/emulator/v1/projects/test-project/databases/(default)/documents
  // with body: {}
  try {
    const response = await fetch(
      `http://${EMULATOR_CONFIG.firestore.host}:${EMULATOR_CONFIG.firestore.port}/emulator/v1/projects/test-project/databases/(default)/documents`,
      {
        method: 'DELETE',
      }
    );
    if (!response.ok) {
      console.warn('Failed to clear emulator data:', response.statusText);
    }
  } catch {
    console.warn('Could not connect to emulator for cleanup');
  }
}

/**
 * Check if emulators are running
 */
export async function checkEmulatorsRunning(): Promise<boolean> {
  try {
    const response = await fetch(
      `http://${EMULATOR_CONFIG.firestore.host}:${EMULATOR_CONFIG.firestore.port}/`
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Cleanup Firebase connections after tests
 * Call this in afterAll to properly close connections and allow Jest to exit
 */
export async function cleanupTestFirebase(): Promise<void> {
  try {
    // Terminate Firestore connections
    if (testDb) {
      await terminate(testDb);
      testDb = null;
    }

    // Delete the Firebase app
    if (testApp) {
      await deleteApp(testApp);
      testApp = null;
    }

    testAuth = null;
    isEmulatorConnected = false;
  } catch (error) {
    console.warn('Error during Firebase cleanup:', error);
  }
}
