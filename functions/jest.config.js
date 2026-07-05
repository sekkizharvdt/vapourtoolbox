/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Unit tests only — *.integration.test.ts runs via test:integration (needs emulators)
  testMatch: ['**/?(*.)+(spec|test).[jt]s'],
  testPathIgnorePatterns: ['/node_modules/', '/lib/', '\\.integration\\.test\\.ts$'],

  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
};
