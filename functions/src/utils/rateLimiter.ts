// Rate Limiting Utility for Cloud Functions
// Protects against denial of service attacks and excessive costs

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
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(storageKey, recentRequests);

    return true;
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
}

/**
 * Predefined rate limiters for common use cases
 */

// Write operations rate limiter (moderate)
export const writeRateLimiter = new RateLimiter({
  maxRequests: 30, // 30 write operations
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'write',
});

// Read operations rate limiter (less strict)
export const readRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 read operations
  windowMs: 60 * 1000, // per minute
  keyPrefix: 'read',
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
