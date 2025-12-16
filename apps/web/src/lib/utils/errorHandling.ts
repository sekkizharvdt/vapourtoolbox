/**
 * Standardized Error Handling Utilities
 *
 * Provides consistent error handling patterns across the codebase.
 * Replaces silent error swallowing with proper logging and optional re-throwing.
 */

import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'errorHandler' });

/**
 * Error handling options
 */
export interface ErrorHandlingOptions<T> {
  /** If true, don't re-throw the error (default: false - errors are re-thrown) */
  silent?: boolean;
  /** Fallback value to return on error (implies silent: true) */
  fallback?: T;
  /** Custom error handler callback */
  onError?: (error: Error) => void;
  /** Additional metadata to include in logs */
  metadata?: Record<string, unknown>;
  /** Whether to notify the user (for UI-facing operations) */
  notifyUser?: boolean;
}

/**
 * Result type for operations that may fail
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Execute an async operation with standardized error handling
 *
 * By default, errors are logged and re-thrown. Use options to customize behavior.
 *
 * @param operation - Async function to execute
 * @param context - Context string for logging (e.g., "fetchUsers", "createInvoice")
 * @param options - Error handling options
 * @returns Promise resolving to the operation result, or fallback value on error
 *
 * @example
 * // Re-throw errors (default - for critical operations)
 * const user = await withErrorHandling(
 *   () => fetchUser(id),
 *   'fetchUser'
 * );
 *
 * @example
 * // Return fallback on error (for non-critical operations)
 * const users = await withErrorHandling(
 *   () => fetchUsers(),
 *   'fetchUsers',
 *   { fallback: [] }
 * );
 *
 * @example
 * // Silent with custom handler (for side-effect operations)
 * await withErrorHandling(
 *   () => trackAnalytics(event),
 *   'trackAnalytics',
 *   { silent: true, onError: (e) => reportToSentry(e) }
 * );
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options?: ErrorHandlingOptions<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Always log the error with context
    logger.error(`${context} failed`, {
      error: err.message,
      stack: err.stack,
      ...options?.metadata,
    });

    // Call custom error handler if provided
    if (options?.onError) {
      try {
        options.onError(err);
      } catch (handlerError) {
        logger.error(`Error handler for ${context} threw an error`, { handlerError });
      }
    }

    // Return fallback if provided (implies silent behavior)
    if (options?.fallback !== undefined) {
      return options.fallback;
    }

    // Silent mode - don't re-throw
    if (options?.silent) {
      // TypeScript needs this cast since we're not returning anything in silent mode
      // This is intentional - silent mode without fallback returns undefined
      return undefined as T;
    }

    // Default: re-throw the error
    throw err;
  }
}

/**
 * Execute a sync operation with standardized error handling
 *
 * @param operation - Sync function to execute
 * @param context - Context string for logging
 * @param options - Error handling options
 * @returns Operation result, or fallback value on error
 */
export function withErrorHandlingSync<T>(
  operation: () => T,
  context: string,
  options?: ErrorHandlingOptions<T>
): T {
  try {
    return operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(`${context} failed`, {
      error: err.message,
      stack: err.stack,
      ...options?.metadata,
    });

    if (options?.onError) {
      try {
        options.onError(err);
      } catch (handlerError) {
        logger.error(`Error handler for ${context} threw an error`, { handlerError });
      }
    }

    if (options?.fallback !== undefined) {
      return options.fallback;
    }

    if (options?.silent) {
      return undefined as T;
    }

    throw err;
  }
}

/**
 * Execute an operation and return a Result type instead of throwing
 *
 * Useful for operations where you want to handle success/failure explicitly.
 *
 * @param operation - Async function to execute
 * @param context - Context string for logging
 * @returns Result object with either data or error
 *
 * @example
 * const result = await tryOperation(() => fetchUser(id), 'fetchUser');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   handleError(result.error);
 * }
 */
export async function tryOperation<T>(
  operation: () => Promise<T>,
  context: string,
  metadata?: Record<string, unknown>
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(`${context} failed`, {
      error: err.message,
      stack: err.stack,
      ...metadata,
    });

    return { success: false, error: err };
  }
}

/**
 * Wrap an async function to add error handling
 *
 * Creates a new function with built-in error handling.
 *
 * @param fn - Async function to wrap
 * @param context - Context string for logging
 * @param options - Default error handling options
 * @returns Wrapped function with error handling
 *
 * @example
 * const safeFetchUser = wrapWithErrorHandling(fetchUser, 'fetchUser');
 * const user = await safeFetchUser(id);
 */
export function wrapWithErrorHandling<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  context: string,
  options?: ErrorHandlingOptions<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => withErrorHandling(() => fn(...args), context, options);
}

/**
 * Create a retry wrapper for operations that may fail transiently
 *
 * @param operation - Async function to execute
 * @param context - Context string for logging
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param delayMs - Delay between retries in milliseconds (default: 1000)
 * @returns Promise resolving to the operation result
 *
 * @example
 * const data = await withRetry(
 *   () => fetchFromAPI(url),
 *   'fetchFromAPI',
 *   3,
 *   1000
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(`${context} failed (attempt ${attempt}/${maxRetries})`, {
        error: lastError.message,
        attempt,
        maxRetries,
      });

      if (attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  logger.error(`${context} failed after ${maxRetries} attempts`, {
    error: lastError?.message,
  });

  throw lastError;
}

/**
 * Assert a condition and throw if false
 *
 * @param condition - Condition to check
 * @param message - Error message if condition is false
 * @param context - Optional context for logging
 */
export function assertCondition(
  condition: boolean,
  message: string,
  context?: string
): asserts condition {
  if (!condition) {
    const fullMessage = context ? `[${context}] ${message}` : message;
    logger.error('Assertion failed', { message: fullMessage, context });
    throw new Error(fullMessage);
  }
}

/**
 * Type guard for checking if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
