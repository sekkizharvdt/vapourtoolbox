// Input Sanitization to prevent XSS attacks

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS
 * Allows only safe HTML tags and attributes
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Strip all HTML tags, leaving only plain text
 * Use this for fields that should never contain HTML
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize user display name
 * - Strips all HTML
 * - Trims whitespace
 * - Normalizes internal whitespace
 * - Limits length to 100 characters
 */
export function sanitizeDisplayName(name: string): string {
  return stripHtml(name)
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .slice(0, 100); // Max 100 characters
}

/**
 * Sanitize email address
 * - Strips HTML
 * - Converts to lowercase
 * - Trims whitespace
 */
export function sanitizeEmail(email: string): string {
  return stripHtml(email).toLowerCase().trim();
}

/**
 * Sanitize phone number
 * - Strips HTML
 * - Removes all non-digit characters except +
 * - Trims whitespace
 */
export function sanitizePhone(phone: string): string {
  return stripHtml(phone)
    .replace(/[^\d+]/g, '')
    .trim();
}

/**
 * Sanitize company/entity name
 * - Strips HTML
 * - Trims whitespace
 * - Normalizes internal whitespace
 * - Limits length to 200 characters
 */
export function sanitizeEntityName(name: string): string {
  return stripHtml(name)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

/**
 * Sanitize description/notes (allows limited HTML)
 * - Allows safe HTML tags (b, i, em, strong, p, br, lists)
 * - Removes dangerous attributes
 * - Limits length to 5000 characters
 */
export function sanitizeDescription(description: string): string {
  return sanitizeHtml(description).slice(0, 5000);
}

/**
 * Sanitize address field
 * - Strips HTML
 * - Trims whitespace
 * - Normalizes internal whitespace
 * - Preserves line breaks
 */
export function sanitizeAddress(address: string): string {
  return stripHtml(address)
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .slice(0, 500);
}

/**
 * Sanitize code/reference number
 * - Strips HTML
 * - Removes special characters except alphanumeric, dash, underscore
 * - Converts to uppercase
 * - Trims whitespace
 */
export function sanitizeCode(code: string): string {
  return stripHtml(code)
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, 50);
}

/**
 * Sanitize URL
 * - Strips HTML
 * - Trims whitespace
 * - Validates URL format
 * - Only allows http/https protocols
 */
export function sanitizeUrl(url: string): string {
  const cleaned = stripHtml(url).trim();

  try {
    const parsed = new URL(cleaned);

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    return parsed.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize JSON string
 * - Validates JSON format
 * - Removes any HTML
 * - Returns empty object string if invalid
 */
export function sanitizeJson(jsonString: string): string {
  try {
    const cleaned = stripHtml(jsonString);
    const parsed = JSON.parse(cleaned);
    return JSON.stringify(parsed);
  } catch {
    return '{}';
  }
}

/**
 * Sanitize search query
 * - Strips HTML
 * - Trims whitespace
 * - Normalizes whitespace
 * - Limits length
 * - Escapes special regex characters
 */
export function sanitizeSearchQuery(query: string): string {
  return stripHtml(query)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 200)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
}

/**
 * Generic sanitizer that applies appropriate sanitization based on field type
 */
export function sanitizeField(value: string, fieldType: SanitizationFieldType): string {
  switch (fieldType) {
    case 'displayName':
      return sanitizeDisplayName(value);
    case 'email':
      return sanitizeEmail(value);
    case 'phone':
      return sanitizePhone(value);
    case 'entityName':
      return sanitizeEntityName(value);
    case 'description':
      return sanitizeDescription(value);
    case 'address':
      return sanitizeAddress(value);
    case 'code':
      return sanitizeCode(value);
    case 'url':
      return sanitizeUrl(value);
    case 'json':
      return sanitizeJson(value);
    case 'search':
      return sanitizeSearchQuery(value);
    case 'plain':
      return stripHtml(value).trim();
    case 'html':
      return sanitizeHtml(value);
    default:
      // Default: strip HTML and trim
      return stripHtml(value).trim();
  }
}

/**
 * Supported field types for sanitization
 */
export type SanitizationFieldType =
  | 'displayName'
  | 'email'
  | 'phone'
  | 'entityName'
  | 'description'
  | 'address'
  | 'code'
  | 'url'
  | 'json'
  | 'search'
  | 'plain'
  | 'html';
