/**
 * Rate Limiting Utility
 *
 * In-memory, client-side rate limiter for single-process web applications.
 * NOT suitable for serverless Cloud Functions (each instance has separate state).
 * For distributed rate limiting in Cloud Functions, use Firestore-backed counters
 * or an external store like Redis.
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum number of requests
  windowMs: number; // Time window in milliseconds
  keyPrefix?: string; // Optional prefix for storage keys
}

/**
 * In-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // Clean up old entries every minute to prevent memory leaks
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed
   * @param key - Unique identifier (e.g., user ID, IP address, email)
   * @returns true if allowed, false if rate limit exceeded
   */
  isAllowed(key: string): boolean {
    const storageKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    const userRequests = this.requests.get(storageKey) || [];

    // Remove old requests outside the time window
    const recentRequests = userRequests.filter((time) => time > windowStart);

    // Check if limit exceeded
    if (recentRequests.length >= this.config.maxRequests) {
      // Persist cleaned-up list so stale timestamps are removed even on rejection
      this.requests.set(storageKey, recentRequests);
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(storageKey, recentRequests);

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const storageKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const userRequests = this.requests.get(storageKey) || [];
    const recentRequests = userRequests.filter((time) => time > windowStart);

    return Math.max(0, this.config.maxRequests - recentRequests.length);
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   */
  getTimeUntilReset(key: string): number {
    const storageKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const userRequests = this.requests.get(storageKey) || [];
    const recentRequests = userRequests.filter((time) => time > windowStart);

    if (recentRequests.length < this.config.maxRequests) {
      return 0; // Can make request now
    }

    // Get the oldest request in the window
    const oldestRequest = Math.min(...recentRequests);
    const timeUntilReset = oldestRequest + this.config.windowMs - now;

    return Math.max(0, timeUntilReset);
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    const storageKey = this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
    this.requests.delete(storageKey);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter((time) => time > windowStart);

      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else if (recentRequests.length < timestamps.length) {
        this.requests.set(key, recentRequests);
      }
    }
  }

  /**
   * Get current size of the rate limiter (for monitoring)
   */
  getSize(): number {
    return this.requests.size;
  }
}

/**
 * Predefined rate limiters for common use cases
 */

// Authentication rate limiter (stricter)
export const authRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 login attempts
  windowMs: 15 * 60 * 1000, // per 15 minutes
  keyPrefix: 'auth',
});

// API rate limiter (general)
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 API calls
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'api',
});

// Write operations rate limiter (moderate)
export const writeRateLimiter = new RateLimiter({
  maxRequests: 30, // 30 write operations
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'write',
});

// Password reset rate limiter (very strict)
export const passwordResetRateLimiter = new RateLimiter({
  maxRequests: 3, // 3 password reset requests
  windowMs: 60 * 60 * 1000, // per hour
  keyPrefix: 'password-reset',
});

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number // Seconds until retry is allowed
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Helper function to enforce rate limit
 * Throws RateLimitError if limit exceeded
 */
export function enforceRateLimit(limiter: RateLimiter, key: string): void {
  if (!limiter.isAllowed(key)) {
    const timeUntilReset = limiter.getTimeUntilReset(key);
    const retryAfterSeconds = Math.ceil(timeUntilReset / 1000);

    throw new RateLimitError(
      `Rate limit exceeded. Please try again in ${retryAfterSeconds} seconds.`,
      retryAfterSeconds
    );
  }
}

/**
 * Example usage in Cloud Functions:
 *
 * import { authRateLimiter, enforceRateLimit } from '@vapour/firebase';
 *
 * async function login(email: string, password: string) {
 *   // Check rate limit
 *   enforceRateLimit(authRateLimiter, email);
 *
 *   // Proceed with login...
 * }
 */
