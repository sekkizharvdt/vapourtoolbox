/**
 * Firestore Security Rules Test Setup
 *
 * Loads the REAL firestore.rules (not the permissive firestore.test.rules
 * used by the client-SDK __integration__ suites) into an isolated emulator
 * project, so these tests exercise the actual production rules.
 *
 * Uses a distinct projectId ('rules-test-project') from the __integration__
 * suites ('test-project') — @firebase/rules-unit-testing sets rules on the
 * emulator per-project, so sharing a projectId with the permissive
 * __integration__ suites would clobber their rules mid test-run.
 *
 * Prerequisites: Firestore emulator running (`firebase emulators:start` or
 * `firebase emulators:exec --only firestore,auth`). Run with:
 * `pnpm test:integration` (folded into the same jest config/testMatch).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
  type TokenOptions,
} from '@firebase/rules-unit-testing';

const RULES_PATH = path.join(__dirname, '../../../../firestore.rules');
const PROJECT_ID = 'rules-test-project';

let testEnv: RulesTestEnvironment | null = null;

export async function checkEmulatorRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8080/');
    return response.ok;
  } catch {
    return false;
  }
}

export async function initRulesTestEnv(): Promise<RulesTestEnvironment> {
  if (testEnv) return testEnv;
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
  return testEnv;
}

export async function clearFirestore(): Promise<void> {
  if (testEnv) await testEnv.clearFirestore();
}

export async function teardownRulesTestEnv(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

/**
 * Custom-claims shape mirrors functions/src/userManagement.ts::customClaims.
 * Intersected with TokenOptions (rather than a bare interface) so it keeps
 * TokenOptions' `[claim: string]: unknown` index signature — required for
 * structural assignability into authenticatedContext's parameter type.
 */
export type TestClaims = TokenOptions & {
  tenantId?: string;
  permissions?: number;
  permissions2?: number;
  domain?: 'internal' | 'external';
  allowedModules?: string[];
  assignedProjects?: string[];
  agent?: boolean;
};

export function authedContext(uid: string, claims: TestClaims = {}): RulesTestContext {
  if (!testEnv) throw new Error('Call initRulesTestEnv() first');
  return testEnv.authenticatedContext(uid, claims);
}

export function unauthedContext(): RulesTestContext {
  if (!testEnv) throw new Error('Call initRulesTestEnv() first');
  return testEnv.unauthenticatedContext();
}

/**
 * Seed documents bypassing rules entirely (admin-equivalent).
 * withSecurityRulesDisabled's callback is typed Promise<void> — capture any
 * result via a closure variable rather than returning it directly.
 */
export async function withAdmin<T>(fn: (context: RulesTestContext) => Promise<T>): Promise<T> {
  if (!testEnv) throw new Error('Call initRulesTestEnv() first');
  let result: T;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    result = await fn(context);
  });
  return result!;
}

/** Standard internal-user claims with a single permission bit set. */
export function internalUserClaims(permissionBit: number, overrides: TestClaims = {}): TestClaims {
  return {
    tenantId: 'default-entity',
    domain: 'internal',
    permissions: permissionBit,
    permissions2: 0,
    assignedProjects: [],
    ...overrides,
  };
}
