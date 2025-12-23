/**
 * Input Validation Utilities
 *
 * Provides consistent input validation and sanitization
 * for all CRUD operations across the application.
 *
 * Security features:
 * - String length limits to prevent memory exhaustion
 * - HTML/XSS sanitization
 * - Control character removal
 * - Number range validation
 */

import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'inputValidation' });

// ============================================================================
// Constants
// ============================================================================

/** Maximum lengths for common field types */
export const MAX_LENGTHS = {
  /** Short text fields like titles, names */
  SHORT_TEXT: 200,
  /** Medium text fields like descriptions */
  MEDIUM_TEXT: 1000,
  /** Long text fields like notes, comments */
  LONG_TEXT: 5000,
  /** Very long text fields like rich content */
  RICH_TEXT: 50000,
  /** Codes, identifiers, numbers */
  CODE: 50,
  /** Email addresses */
  EMAIL: 254,
  /** Phone numbers */
  PHONE: 20,
  /** URLs */
  URL: 2000,
} as const;

/**
 * Characters that should be stripped from input
 * Matches control characters: NUL, SOH-BS, VT, FF, SO-US, DEL
 * We use a function instead of regex to avoid ESLint no-control-regex
 */
function removeControlChars(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Skip control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F)
    // But allow tab (0x09), newline (0x0A), carriage return (0x0D)
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    result += str[i];
  }
  return result;
}

/** Common XSS patterns to detect */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /data:/gi,
  /vbscript:/gi,
];

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface BatchValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validate and sanitize a string field
 *
 * @param value - The input value
 * @param fieldName - Name of the field (for error messages)
 * @param options - Validation options
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    patternMessage?: string;
    sanitize?: boolean;
    allowHtml?: boolean;
  } = {}
): ValidationResult {
  const {
    required = false,
    maxLength = MAX_LENGTHS.MEDIUM_TEXT,
    minLength = 0,
    pattern,
    patternMessage,
    sanitize = true,
    allowHtml = false,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, sanitized: '' };
  }

  // Ensure it's a string
  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  let processedValue = value;

  // Sanitize if requested
  if (sanitize) {
    processedValue = sanitizeString(processedValue, { allowHtml });
  }

  // Check length
  if (processedValue.length < minLength) {
    return {
      valid: false,
      error: `${fieldName} must be at least ${minLength} characters`,
    };
  }

  if (processedValue.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must not exceed ${maxLength} characters`,
    };
  }

  // Check pattern
  if (pattern && !pattern.test(processedValue)) {
    return {
      valid: false,
      error: patternMessage || `${fieldName} has an invalid format`,
    };
  }

  // Check for XSS if HTML is not allowed
  if (!allowHtml && containsXSS(processedValue)) {
    logger.warn('XSS attempt detected', { fieldName, value: processedValue.substring(0, 100) });
    return {
      valid: false,
      error: `${fieldName} contains invalid content`,
    };
  }

  return { valid: true, sanitized: processedValue };
}

/**
 * Validate a number field
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}
): ValidationResult {
  const { required = false, min, max, integer = false, positive = false } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }

  // Parse if string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  // Ensure it's a valid number
  if (typeof numValue !== 'number' || isNaN(numValue) || !isFinite(numValue)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  // Check integer
  if (integer && !Number.isInteger(numValue)) {
    return { valid: false, error: `${fieldName} must be a whole number` };
  }

  // Check positive
  if (positive && numValue < 0) {
    return { valid: false, error: `${fieldName} must be positive` };
  }

  // Check range
  if (min !== undefined && numValue < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (max !== undefined && numValue > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }

  return { valid: true };
}

/**
 * Validate an email address
 */
export function validateEmail(
  value: unknown,
  fieldName: string = 'Email',
  options: { required?: boolean } = {}
): ValidationResult {
  const { required = false } = options;

  if (!value) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }

  // Email regex (RFC 5322 simplified)
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return validateString(value, fieldName, {
    required,
    maxLength: MAX_LENGTHS.EMAIL,
    pattern: emailPattern,
    patternMessage: `${fieldName} must be a valid email address`,
  });
}

/**
 * Validate an array field
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    itemValidator?: (item: T, index: number) => ValidationResult;
  } = {}
): BatchValidationResult {
  const { required = false, minLength = 0, maxLength = 1000, itemValidator } = options;

  const errors: ValidationError[] = [];

  // Handle null/undefined
  if (!value) {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }
    return { valid: errors.length === 0, errors };
  }

  // Ensure it's an array
  if (!Array.isArray(value)) {
    errors.push({ field: fieldName, message: `${fieldName} must be an array` });
    return { valid: false, errors };
  }

  // Check length
  if (value.length < minLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must have at least ${minLength} items`,
    });
  }

  if (value.length > maxLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must not have more than ${maxLength} items`,
    });
  }

  // Validate individual items
  if (itemValidator) {
    value.forEach((item, index) => {
      const result = itemValidator(item as T, index);
      if (!result.valid && result.error) {
        errors.push({
          field: `${fieldName}[${index}]`,
          message: result.error,
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize a string by removing dangerous content
 */
export function sanitizeString(
  value: string,
  options: { allowHtml?: boolean; trim?: boolean } = {}
): string {
  const { allowHtml = false, trim = true } = options;

  let result = value;

  // Remove control characters (except newlines and tabs)
  result = removeControlChars(result);

  // Trim whitespace
  if (trim) {
    result = result.trim();
  }

  // Remove or escape HTML if not allowed
  if (!allowHtml) {
    result = escapeHtml(result);
  }

  return result;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(value: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return value.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Check if a string contains potential XSS content
 */
export function containsXSS(value: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(value));
}

// ============================================================================
// Batch Validation Helper
// ============================================================================

/**
 * Validate multiple fields at once
 *
 * @example
 * const result = validateFields({
 *   title: { value: input.title, validator: (v) => validateString(v, 'Title', { required: true, maxLength: 200 }) },
 *   amount: { value: input.amount, validator: (v) => validateNumber(v, 'Amount', { required: true, positive: true }) },
 * });
 *
 * if (!result.valid) {
 *   throw new ValidationError(result.errors);
 * }
 */
export function validateFields(
  fields: Record<string, { value: unknown; validator: (value: unknown) => ValidationResult }>
): BatchValidationResult {
  const errors: ValidationError[] = [];

  for (const [fieldName, { value, validator }] of Object.entries(fields)) {
    const result = validator(value);
    if (!result.valid && result.error) {
      errors.push({ field: fieldName, message: result.error });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Throw an error if validation fails
 */
export function assertValid(result: BatchValidationResult): void {
  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Validation failed: ${messages}`);
  }
}
