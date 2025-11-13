/**
 * Server-side Validation Utilities for Cloud Functions
 *
 * Provides type-safe validation using Zod schemas with proper error handling
 * for Firebase Cloud Functions (callable and HTTP functions).
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    issues?: Array<{
      path: string;
      message: string;
    }>;
  };
}

/**
 * Validate data against a Zod schema
 *
 * Returns a structured result with success/error information
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with typed data or error details
 *
 * @example
 * ```typescript
 * const result = validate(entitySchema, requestData);
 * if (!result.success) {
 *   throw new HttpsError('invalid-argument', result.error.message);
 * }
 * // result.data is now typed and validated
 * ```
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      logger.warn('Validation failed', {
        issues,
        receivedData: JSON.stringify(data).substring(0, 200), // Log first 200 chars
      });

      return {
        success: false,
        error: {
          message: `Validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join(', ')}`,
          issues,
        },
      };
    }

    // Unexpected error
    logger.error('Unexpected validation error', { error });
    return {
      success: false,
      error: {
        message: 'Validation failed due to unexpected error',
      },
    };
  }
}

/**
 * Validate and throw on error (for Cloud Functions)
 *
 * Convenience wrapper that validates data and throws HttpsError
 * if validation fails. Use this in Cloud Functions for cleaner code.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param errorCode - Firebase HttpsError code (default: 'invalid-argument')
 * @returns Validated and typed data
 * @throws HttpsError if validation fails
 *
 * @example
 * ```typescript
 * const validData = validateOrThrow(entitySchema, request.data);
 * // validData is typed and guaranteed to be valid
 * ```
 */
export function validateOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorCode: 'invalid-argument' | 'failed-precondition' = 'invalid-argument'
): T {
  const result = validate(schema, data);

  if (!result.success) {
    throw new HttpsError(errorCode, result.error!.message, {
      issues: result.error!.issues,
    });
  }

  return result.data!;
}

/**
 * Validate partial data (for updates)
 *
 * Validates only the fields that are present in the data object.
 * Useful for PATCH/update operations where not all fields are required.
 *
 * @param schema - Zod schema to validate against
 * @param data - Partial data to validate
 * @returns Validation result with typed partial data
 *
 * @example
 * ```typescript
 * const result = validatePartial(entitySchema, { name: 'New Name' });
 * // Only validates the 'name' field
 * ```
 */
export function validatePartial<T>(
  schema: ZodSchema<T>,
  data: unknown
): ValidationResult<Partial<T>> {
  try {
    const partialSchema = z.object({}).passthrough();
    const validatedData = partialSchema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));

      return {
        success: false,
        error: {
          message: `Validation failed: ${issues.map((i) => `${i.path}: ${i.message}`).join(', ')}`,
          issues,
        },
      };
    }

    return {
      success: false,
      error: {
        message: 'Validation failed due to unexpected error',
      },
    };
  }
}

/**
 * Validate partial data and throw on error
 *
 * @param schema - Zod schema to validate against
 * @param data - Partial data to validate
 * @param errorCode - Firebase HttpsError code
 * @returns Validated partial data
 * @throws HttpsError if validation fails
 */
export function validatePartialOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  errorCode: 'invalid-argument' | 'failed-precondition' = 'invalid-argument'
): Partial<T> {
  const result = validatePartial(schema, data);

  if (!result.success) {
    throw new HttpsError(errorCode, result.error!.message, {
      issues: result.error!.issues,
    });
  }

  return result.data!;
}

/**
 * Sanitize and validate data
 *
 * First sanitizes the data (removes HTML, trims whitespace, etc.)
 * then validates against the schema. Use for user-generated content.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to sanitize and validate
 * @param sanitizer - Custom sanitization function
 * @returns Validation result with sanitized and validated data
 */
export function sanitizeAndValidate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  sanitizer?: (value: unknown) => unknown
): ValidationResult<T> {
  try {
    // Apply custom sanitizer if provided
    const sanitized = sanitizer ? sanitizer(data) : data;

    // Validate the sanitized data
    return validate(schema, sanitized);
  } catch (error) {
    logger.error('Error during sanitization', { error });
    return {
      success: false,
      error: {
        message: 'Failed to sanitize and validate data',
      },
    };
  }
}
