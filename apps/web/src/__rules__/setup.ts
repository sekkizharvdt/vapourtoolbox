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
const STORAGE_RULES_PATH = path.join(__dirname, '../../../../storage.rules');
const PROJECT_ID = 'rules-test-project';
const STORAGE_PROJECT_ID = 'storage-rules-test-project';

let testEnv: RulesTestEnvironment | null = null;
let storageTestEnv: RulesTestEnvironment | null = null;

export async function checkEmulatorRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8080/');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Storage emulator (port 9199 per firebase.json). Any HTTP response counts
 * as "running" — the root path isn't a health endpoint, only reachability
 * matters.
 */
export async function checkStorageEmulatorRunning(): Promise<boolean> {
  try {
    await fetch('http://localhost:9199/');
    return true;
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

/**
 * Separate environment for Storage rules tests: loads the REAL storage.rules
 * into the Storage emulator under its own projectId so it can't interfere
 * with the Firestore rules environments.
 */
export async function initStorageRulesTestEnv(): Promise<RulesTestEnvironment> {
  if (storageTestEnv) return storageTestEnv;
  storageTestEnv = await initializeTestEnvironment({
    projectId: STORAGE_PROJECT_ID,
    storage: {
      rules: fs.readFileSync(STORAGE_RULES_PATH, 'utf8'),
      host: 'localhost',
      port: 9199,
    },
  });
  return storageTestEnv;
}

export async function clearFirestore(): Promise<void> {
  if (testEnv) await testEnv.clearFirestore();
}

export async function clearStorage(): Promise<void> {
  if (storageTestEnv) await storageTestEnv.clearStorage();
}

export async function teardownRulesTestEnv(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

export async function teardownStorageRulesTestEnv(): Promise<void> {
  if (storageTestEnv) {
    await storageTestEnv.cleanup();
    storageTestEnv = null;
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

export function authedStorageContext(uid: string, claims: TestClaims = {}): RulesTestContext {
  if (!storageTestEnv) throw new Error('Call initStorageRulesTestEnv() first');
  return storageTestEnv.authenticatedContext(uid, claims);
}

/**
 * Seed / inspect Storage objects bypassing rules entirely (admin-equivalent).
 */
export async function withStorageAdmin<T>(
  fn: (context: RulesTestContext) => Promise<T>
): Promise<T> {
  if (!storageTestEnv) throw new Error('Call initStorageRulesTestEnv() first');
  let result: T;
  await storageTestEnv.withSecurityRulesDisabled(async (context) => {
    result = await fn(context);
  });
  return result!;
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
