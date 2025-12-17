/**
 * Transaction Helper Utilities
 *
 * Provides consistent patterns for Firestore transactions
 * with automatic retry and error handling.
 *
 * Use these utilities for any multi-document operation that requires
 * atomicity, especially financial operations.
 */

import { runTransaction, Firestore, Transaction } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'transactionHelpers' });

/**
 * Context passed to transaction operations
 */
export interface TransactionContext {
  /** The Firestore transaction object */
  transaction: Transaction;
  /** The Firestore database instance */
  db: Firestore;
}

/**
 * Result of a transaction operation
 */
export interface TransactionResult<T> {
  /** Whether the transaction succeeded */
  success: boolean;
  /** The result data if successful */
  data?: T;
  /** The error if failed */
  error?: Error;
  /** Number of retries before success/failure */
  retryCount: number;
}

/**
 * Check if an error is retryable (transient contention)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('aborted') ||
      message.includes('contention') ||
      message.includes('transaction was aborted') ||
      message.includes('resource exhausted')
    );
  }
  return false;
}

/**
 * Execute a multi-document operation within a Firestore transaction
 * with automatic retry on transient failures.
 *
 * @param db - Firestore database instance
 * @param operationName - Name for logging purposes
 * @param operation - The transaction operation to execute
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns TransactionResult with success status and data or error
 *
 * @example
 * ```typescript
 * const result = await withTransaction(
 *   db,
 *   'approveGRForPayment',
 *   async ({ transaction }) => {
 *     const grRef = doc(db, 'goodsReceipts', grId);
 *     const grDoc = await transaction.get(grRef);
 *     transaction.update(grRef, { status: 'APPROVED' });
 *     // ... create payment in same transaction
 *     return paymentId;
 *   }
 * );
 *
 * if (!result.success) {
 *   throw result.error;
 * }
 * ```
 */
export async function withTransaction<T>(
  db: Firestore,
  operationName: string,
  operation: (ctx: TransactionContext) => Promise<T>,
  maxRetries: number = 3
): Promise<TransactionResult<T>> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        return operation({ transaction, db });
      });

      if (attempt > 1) {
        logger.info(`Transaction ${operationName} succeeded after ${attempt - 1} retries`);
      }

      return { success: true, data: result, retryCount: attempt - 1 };
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        // Non-retryable error, fail immediately
        logger.error(`Transaction ${operationName} failed with non-retryable error`, {
          error,
          attempt,
        });
        break;
      }

      if (attempt < maxRetries) {
        logger.warn(`Transaction ${operationName} attempt ${attempt} failed, retrying...`, {
          error,
        });
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
      }
    }
  }

  logger.error(`Transaction ${operationName} failed after ${maxRetries} attempts`, {
    error: lastError,
  });

  return { success: false, error: lastError, retryCount: maxRetries };
}

/**
 * Execute a transaction and throw on failure.
 * Simpler API when you don't need to handle errors specially.
 *
 * @param db - Firestore database instance
 * @param operationName - Name for logging purposes
 * @param operation - The transaction operation to execute
 * @returns The result of the transaction
 * @throws Error if transaction fails after retries
 *
 * @example
 * ```typescript
 * const paymentId = await withTransactionOrThrow(
 *   db,
 *   'createPayment',
 *   async ({ transaction }) => {
 *     // ... transaction operations
 *     return paymentId;
 *   }
 * );
 * ```
 */
export async function withTransactionOrThrow<T>(
  db: Firestore,
  operationName: string,
  operation: (ctx: TransactionContext) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  const result = await withTransaction(db, operationName, operation, maxRetries);

  if (!result.success) {
    throw result.error || new Error(`Transaction ${operationName} failed`);
  }

  return result.data as T;
}

/**
 * Wrap an existing function to make it transactional.
 * Useful for refactoring existing code incrementally.
 *
 * @param db - Firestore database instance
 * @param operationName - Name for logging purposes
 * @param fn - Function that takes TransactionContext and returns a promise
 * @returns The result of the function
 */
export function createTransactionalOperation<TArgs extends unknown[], TResult>(
  db: Firestore,
  operationName: string,
  fn: (ctx: TransactionContext, ...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withTransactionOrThrow(db, operationName, (ctx) => fn(ctx, ...args));
  };
}
