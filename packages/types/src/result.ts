/**
 * Result Type Pattern
 *
 * A type-safe way to handle success/failure outcomes
 * without relying on try/catch at every call site.
 */

/**
 * Base error structure for application errors
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * Common error codes used across the application
 */
export const ErrorCodes = {
  // Generic errors
  UNKNOWN: 'UNKNOWN',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',

  // Network/Firebase errors
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Business logic errors
  INVALID_STATE: 'INVALID_STATE',
  CONFLICT: 'CONFLICT',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Success result
 */
export interface Success<T> {
  success: true;
  data: T;
}

/**
 * Failure result
 */
export interface Failure<E = AppError> {
  success: false;
  error: E;
}

/**
 * Result type - either success with data or failure with error
 */
export type Result<T, E = AppError> = Success<T> | Failure<E>;

/**
 * Create a success result
 */
export function success<T>(data: T): Success<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function failure<E = AppError>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Create an AppError
 */
export function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): AppError {
  return { code, message, details, cause };
}

/**
 * Check if result is success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * Check if result is failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

/**
 * Unwrap result or throw if failure
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwrap result or return default value if failure
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Map over a success result
 */
export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.data));
  }
  return result;
}

/**
 * FlatMap over a success result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * Convert a Promise to a Result
 */
export async function fromPromise<T>(
  promise: Promise<T>,
  errorMapper?: (error: unknown) => AppError
): Promise<Result<T, AppError>> {
  try {
    const data = await promise;
    return success(data);
  } catch (error) {
    if (errorMapper) {
      return failure(errorMapper(error));
    }
    return failure(
      createError(
        ErrorCodes.UNKNOWN,
        error instanceof Error ? error.message : 'Unknown error',
        undefined,
        error
      )
    );
  }
}

/**
 * Convert Firebase error to AppError
 */
export function mapFirebaseError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as { code: string; message: string };
    const codeMap: Record<string, ErrorCode> = {
      'permission-denied': ErrorCodes.PERMISSION_DENIED,
      'not-found': ErrorCodes.NOT_FOUND,
      unauthenticated: ErrorCodes.UNAUTHENTICATED,
      'already-exists': ErrorCodes.ALREADY_EXISTS,
      'resource-exhausted': ErrorCodes.QUOTA_EXCEEDED,
      unavailable: ErrorCodes.NETWORK,
      'deadline-exceeded': ErrorCodes.TIMEOUT,
    };

    return createError(
      codeMap[firebaseError.code] || ErrorCodes.UNKNOWN,
      firebaseError.message,
      { originalCode: firebaseError.code },
      error
    );
  }

  return createError(
    ErrorCodes.UNKNOWN,
    error instanceof Error ? error.message : 'Unknown error',
    undefined,
    error
  );
}
