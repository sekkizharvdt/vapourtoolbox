import type { Config } from 'jest';

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',

  // Setup files after environment
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // TypeScript and module resolution
  preset: 'ts-jest',
  moduleNameMapper: {
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@vapour/(.*)$': '<rootDir>/../../packages/$1/src',

    // CSS modules
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',

    // CSS imports (ignore)
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',

    // Image imports
    '^.+\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },

  // Transform files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // Test match patterns
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/out/',
    '/playwright-report/',
    '/test-results/',
    '/e2e/', // Playwright E2E tests - run separately with `pnpm test:e2e`
    '/__integration__/', // Integration tests - run separately with `pnpm test:integration`
    '__tests__/test-utils\\.ts$', // Test utility files, not tests themselves
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],

  // Coverage thresholds
  // Baseline established: 2026-01-29
  // Current: statements 18%, branches 73%, functions 43%, lines 18%
  // Target: 50% by Q2 2026, 80% by Q4 2026
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 40,
      lines: 15,
      statements: 15,
    },
  },
};

export default config;
