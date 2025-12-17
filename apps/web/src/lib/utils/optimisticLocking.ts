/**
 * Optimistic Locking Utilities
 *
 * Provides concurrency control for Firestore documents to prevent
 * lost updates when multiple users edit the same document.
 *
 * Strategy: Version-based optimistic locking
 * - Each document has a `version` field (number, starting at 1)
 * - Updates increment the version
 * - Update fails if version doesn't match expected value
 *
 * @example
 * ```typescript
 * // Check version before update
 * const currentDoc = await getDoc(docRef);
 * const { version } = currentDoc.data();
 *
 * // Try to update with version check
 * await updateWithVersionCheck(docRef, { name: 'New Name' }, version);
 * ```
 */

import {
  getDoc,
  updateDoc,
  runTransaction,
  type Firestore,
  type DocumentReference,
  type UpdateData,
  increment,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'optimisticLocking' });

/**
 * Error thrown when optimistic lock fails (version mismatch)
 */
export class OptimisticLockError extends Error {
  constructor(
    message: string,
    public readonly documentPath: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

/**
 * Base interface for versioned documents
 */
export interface VersionedDocument {
  version: number;
  updatedAt?: unknown;
}

/**
 * Update a document with version check (optimistic locking)
 *
 * Uses a Firestore transaction to:
 * 1. Read current version
 * 2. Compare with expected version
 * 3. Update only if versions match
 * 4. Increment version atomically
 *
 * @param db - Firestore instance
 * @param docRef - Document reference to update
 * @param updates - Fields to update
 * @param expectedVersion - Expected current version (from when data was loaded)
 * @throws OptimisticLockError if version doesn't match
 */
export async function updateWithVersionCheck<T extends Record<string, unknown>>(
  db: Firestore,
  docRef: DocumentReference,
  updates: UpdateData<T>,
  expectedVersion: number
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(docRef);

    if (!docSnap.exists()) {
      throw new Error(`Document not found: ${docRef.path}`);
    }

    const data = docSnap.data();
    const currentVersion = data?.version ?? 0;

    if (currentVersion !== expectedVersion) {
      logger.warn('Optimistic lock conflict detected', {
        path: docRef.path,
        expectedVersion,
        currentVersion,
      });

      throw new OptimisticLockError(
        `Document was modified by another user. Please refresh and try again.`,
        docRef.path,
        expectedVersion,
        currentVersion
      );
    }

    // Update with incremented version
    transaction.update(docRef, {
      ...updates,
      version: currentVersion + 1,
    } as UpdateData<T>);

    logger.debug('Document updated with version check', {
      path: docRef.path,
      newVersion: currentVersion + 1,
    });
  });
}

/**
 * Update a document, auto-incrementing version without checking
 *
 * Use this for updates that don't need conflict detection,
 * but still want to track version for audit purposes.
 *
 * @param docRef - Document reference to update
 * @param updates - Fields to update
 */
export async function updateWithVersionIncrement<T extends Record<string, unknown>>(
  docRef: DocumentReference,
  updates: UpdateData<T>
): Promise<void> {
  await updateDoc(docRef, {
    ...updates,
    version: increment(1),
  } as UpdateData<T>);
}

/**
 * Get current version of a document
 *
 * @param docRef - Document reference
 * @returns Current version number (0 if not set)
 */
export async function getDocumentVersion(docRef: DocumentReference): Promise<number> {
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Document not found: ${docRef.path}`);
  }

  const data = docSnap.data();
  return data?.version ?? 0;
}

/**
 * Check if a document has been modified since a given version
 *
 * @param docRef - Document reference
 * @param knownVersion - Version to compare against
 * @returns true if document has been modified (version is higher)
 */
export async function hasBeenModified(
  docRef: DocumentReference,
  knownVersion: number
): Promise<boolean> {
  const currentVersion = await getDocumentVersion(docRef);
  return currentVersion > knownVersion;
}

/**
 * Create initial version field for new documents
 *
 * @returns Object with version set to 1
 */
export function initialVersion(): { version: number } {
  return { version: 1 };
}

/**
 * Higher-order function for safe updates with retry
 *
 * Attempts the update, and if OptimisticLockError occurs,
 * calls the refreshFn to get fresh data and retries once.
 *
 * @param updateFn - Function that performs the update
 * @param refreshFn - Function to refresh data before retry
 * @param maxRetries - Maximum retry attempts (default: 1)
 */
export async function withOptimisticRetry<T>(
  updateFn: () => Promise<T>,
  refreshFn: () => Promise<void>,
  maxRetries: number = 1
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await updateFn();
    } catch (error) {
      if (error instanceof OptimisticLockError && attempt < maxRetries) {
        logger.info('Retrying after optimistic lock conflict', {
          attempt: attempt + 1,
          maxRetries,
        });
        await refreshFn();
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
