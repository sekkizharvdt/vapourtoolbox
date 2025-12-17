/**
 * Idempotency Service
 *
 * Prevents duplicate creation of entities due to network retries or double-clicks.
 * Uses idempotency keys to ensure operations are only executed once.
 *
 * How it works:
 * 1. Client generates a unique idempotency key (e.g., UUID) before starting operation
 * 2. Server checks if key exists before processing
 * 3. If key exists, return the cached result
 * 4. If key doesn't exist, process operation and store key with result
 * 5. Keys expire after TTL (default 24 hours)
 *
 * Usage:
 * ```typescript
 * import { withIdempotency, generateIdempotencyKey } from '@/lib/utils/idempotencyService';
 *
 * // Generate key on client
 * const idempotencyKey = generateIdempotencyKey('create-po', offerId);
 *
 * // Use in service function
 * const poId = await withIdempotency(db, idempotencyKey, async () => {
 *   return await actuallyCreatePO(offerId, ...);
 * });
 * ```
 */

import { doc, getDoc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'idempotencyService' });

/**
 * Collection name for storing idempotency keys
 */
const IDEMPOTENCY_COLLECTION = 'idempotency_keys';

/**
 * Default TTL for idempotency keys (24 hours)
 */
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency key record stored in Firestore
 */
interface IdempotencyRecord {
  /** The idempotency key */
  key: string;
  /** Operation type (e.g., 'create-po', 'create-gr') */
  operation: string;
  /** Result of the operation (typically the created entity ID) */
  result: string;
  /** When the key was created */
  createdAt: Timestamp;
  /** When the key expires (for TTL) */
  expiresAt: Timestamp;
  /** User who initiated the operation */
  userId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error thrown when an idempotency conflict is detected
 */
export class IdempotencyConflictError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly existingResult: string
  ) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Generate an idempotency key for an operation
 *
 * Creates a unique key by combining:
 * - Operation type (e.g., 'create-po')
 * - Related entity ID (e.g., offerId for PO creation)
 * - Optional additional context
 *
 * @param operation - Type of operation
 * @param entityId - Primary entity ID
 * @param additionalContext - Optional additional context (e.g., userId)
 * @returns Unique idempotency key
 */
export function generateIdempotencyKey(
  operation: string,
  entityId: string,
  additionalContext?: string
): string {
  const parts = [operation, entityId];
  if (additionalContext) {
    parts.push(additionalContext);
  }
  return parts.join(':');
}

/**
 * Check if an idempotency key already exists
 *
 * @param db - Firestore instance
 * @param key - Idempotency key to check
 * @returns Existing result if found, null otherwise
 */
export async function checkIdempotencyKey(db: Firestore, key: string): Promise<string | null> {
  const docRef = doc(db, IDEMPOTENCY_COLLECTION, key);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const record = docSnap.data() as IdempotencyRecord;

  // Check if expired
  if (record.expiresAt.toMillis() < Date.now()) {
    logger.debug('Idempotency key expired', { key });
    return null;
  }

  return record.result;
}

/**
 * Store an idempotency key with its result
 *
 * @param db - Firestore instance
 * @param key - Idempotency key
 * @param operation - Operation type
 * @param result - Result of the operation
 * @param options - Additional options
 */
export async function storeIdempotencyKey(
  db: Firestore,
  key: string,
  operation: string,
  result: string,
  options?: {
    userId?: string;
    metadata?: Record<string, unknown>;
    ttlMs?: number;
  }
): Promise<void> {
  const ttlMs = options?.ttlMs || DEFAULT_TTL_MS;
  const now = Timestamp.now();

  const record: IdempotencyRecord = {
    key,
    operation,
    result,
    createdAt: now,
    expiresAt: Timestamp.fromMillis(Date.now() + ttlMs),
    userId: options?.userId,
    metadata: options?.metadata,
  };

  const docRef = doc(db, IDEMPOTENCY_COLLECTION, key);
  await setDoc(docRef, record);

  logger.debug('Idempotency key stored', { key, operation, result });
}

/**
 * Execute an operation with idempotency protection
 *
 * If the idempotency key already exists and is not expired,
 * returns the cached result without executing the operation.
 *
 * @param db - Firestore instance
 * @param key - Idempotency key
 * @param operation - Operation type for logging
 * @param fn - Async function to execute (should return the entity ID)
 * @param options - Additional options
 * @returns Result of the operation (either cached or newly executed)
 */
export async function withIdempotency(
  db: Firestore,
  key: string,
  operation: string,
  fn: () => Promise<string>,
  options?: {
    userId?: string;
    metadata?: Record<string, unknown>;
    ttlMs?: number;
  }
): Promise<string> {
  // Check if key already exists
  const existingResult = await checkIdempotencyKey(db, key);

  if (existingResult) {
    logger.info('Idempotency key hit - returning cached result', {
      key,
      operation,
      cachedResult: existingResult,
    });
    return existingResult;
  }

  // Execute the operation
  const result = await fn();

  // Store the idempotency key with the result
  await storeIdempotencyKey(db, key, operation, result, options);

  return result;
}

/**
 * Execute an operation with idempotency protection and user context
 *
 * Convenience wrapper that includes user ID in the key generation
 *
 * @param db - Firestore instance
 * @param operation - Operation type
 * @param entityId - Primary entity ID
 * @param userId - User performing the operation
 * @param fn - Async function to execute
 * @param options - Additional options
 * @returns Result of the operation
 */
export async function withUserIdempotency(
  db: Firestore,
  operation: string,
  entityId: string,
  userId: string,
  fn: () => Promise<string>,
  options?: {
    metadata?: Record<string, unknown>;
    ttlMs?: number;
  }
): Promise<string> {
  const key = generateIdempotencyKey(operation, entityId, userId);

  return withIdempotency(db, key, operation, fn, {
    ...options,
    userId,
  });
}

/**
 * Check and reserve an idempotency key before starting a long operation
 *
 * Use this to detect duplicates early before expensive processing.
 * If the key exists, throws IdempotencyConflictError.
 * If the key doesn't exist, creates a placeholder that must be finalized.
 *
 * @param db - Firestore instance
 * @param key - Idempotency key to reserve
 * @param operation - Operation type
 * @returns Cleanup function to call after operation completes
 */
export async function reserveIdempotencyKey(
  db: Firestore,
  key: string,
  operation: string
): Promise<{
  finalizeWithResult: (result: string) => Promise<void>;
}> {
  const existingResult = await checkIdempotencyKey(db, key);

  if (existingResult) {
    throw new IdempotencyConflictError(
      `Operation already completed with key: ${key}`,
      key,
      existingResult
    );
  }

  // Store a placeholder (will be updated with actual result)
  const placeholderDocRef = doc(db, IDEMPOTENCY_COLLECTION, key);
  await setDoc(placeholderDocRef, {
    key,
    operation,
    result: '_pending_',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), // 5 minute placeholder TTL
    status: 'pending',
  });

  return {
    finalizeWithResult: async (result: string) => {
      await setDoc(placeholderDocRef, {
        key,
        operation,
        result,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(Date.now() + DEFAULT_TTL_MS),
        status: 'completed',
      });
    },
  };
}
