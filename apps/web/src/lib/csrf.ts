/**
 * CSRF Token Utilities
 * Client-side utilities for managing CSRF tokens
 */

import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'csrf' });

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  // Generate cryptographically secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf-token') {
      return value ?? null;
    }
  }
  return null;
}

/**
 * Set CSRF token in cookie
 */
export function setCSRFToken(token: string): void {
  if (typeof document === 'undefined') return;

  // Set cookie with secure attributes
  const cookieOptions = [
    `csrf-token=${token}`,
    'path=/',
    'SameSite=Strict',
    ...(window.location.protocol === 'https:' ? ['Secure'] : []),
  ];

  document.cookie = cookieOptions.join('; ');
}

/**
 * Initialize CSRF token
 * Call this on app initialization
 */
export function initializeCSRFToken(): string {
  let token = getCSRFToken();

  if (!token) {
    token = generateCSRFToken();
    setCSRFToken(token);
  }

  return token;
}

/**
 * Add CSRF token to request headers
 */
export function withCSRFToken(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken();

  if (!token) {
    logger.info('CSRF token not found, initializing');
    const newToken = initializeCSRFToken();
    return {
      ...headers,
      'x-csrf-token': newToken,
    };
  }

  return {
    ...headers,
    'x-csrf-token': token,
  };
}
