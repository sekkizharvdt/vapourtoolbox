/** @type {import('jest').Config} */
// Runs inside `firebase emulators:exec` (see the test:integration script) —
// FIRESTORE_EMULATOR_HOST is injected by the Firebase CLI.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  testMatch: ['**/*.integration.test.[jt]s'],
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],

  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,

  // Trigger propagation through the emulator is asynchronous
  testTimeout: 30000,
};
