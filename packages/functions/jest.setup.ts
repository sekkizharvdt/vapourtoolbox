/**
 * Jest Setup for Cloud Functions
 *
 * This file runs before each test file and sets up the test environment.
 */

import firebaseFunctionsTest from 'firebase-functions-test';

// Initialize firebase-functions-test in offline mode (no Firebase project required)
// For online mode with emulator, pass project config and emulator settings
export const testEnv = firebaseFunctionsTest();

// Set test timeout
jest.setTimeout(10000);

// Clean up after all tests
afterAll(() => {
  testEnv.cleanup();
});
