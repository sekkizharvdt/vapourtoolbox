/**
 * Jest Configuration for Integration Tests
 *
 * Runs tests that require Firebase Emulator
 * Use: pnpm test:integration
 */

import type { Config } from 'jest';

const config: Config = {
  displayName: 'integration',
  testEnvironment: 'node', // Integration tests run in Node, not jsdom

  // Only run integration tests
  testMatch: ['**/__integration__/**/*.test.ts'],

  // TypeScript and module resolution
  preset: 'ts-jest',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@vapour/(.*)$': '<rootDir>/../../packages/$1/src',
  },

  // Transform files with ts-jest
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Longer timeout for integration tests (emulator operations)
  testTimeout: 30000,

  // Run tests serially (avoid emulator conflicts)
  maxWorkers: 1,

  // Verbose output
  verbose: true,

  // Force exit after tests complete (Firebase keeps connections open)
  forceExit: true,
};

export default config;
