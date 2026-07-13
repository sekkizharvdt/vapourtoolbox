/**
 * Unit tests for the pure parts of the Firestore-backed rate limiter.
 * The transaction path needs the emulator; the window math and error shape
 * are what the callers depend on for correct retry behaviour.
 */

import {
  windowIndex,
  retryAfterSeconds,
  RateLimitError,
  WRITE_LIMIT,
  AI_HELP_LIMIT,
  PARSE_OFFER_LIMIT,
} from './firestoreRateLimit';

describe('windowIndex', () => {
  it('buckets timestamps into fixed windows', () => {
    const windowMs = 60_000;
    expect(windowIndex(0, windowMs)).toBe(0);
    expect(windowIndex(59_999, windowMs)).toBe(0);
    expect(windowIndex(60_000, windowMs)).toBe(1);
    expect(windowIndex(150_000, windowMs)).toBe(2);
  });

  it('two calls in the same window share a bucket; across the boundary they do not', () => {
    const windowMs = 60 * 60 * 1000;
    const t1 = 1_752_200_000_000;
    expect(windowIndex(t1, windowMs)).toBe(
      windowIndex(t1 + windowMs - 1 - (t1 % windowMs), windowMs)
    );
    expect(windowIndex(t1, windowMs)).not.toBe(windowIndex(t1 + windowMs, windowMs));
  });
});

describe('retryAfterSeconds', () => {
  it('counts down to the end of the current window', () => {
    const windowMs = 60_000;
    expect(retryAfterSeconds(0, windowMs)).toBe(60);
    expect(retryAfterSeconds(30_000, windowMs)).toBe(30);
    expect(retryAfterSeconds(59_500, windowMs)).toBe(1);
  });

  it('never returns less than 1 second', () => {
    expect(retryAfterSeconds(59_999, 60_000)).toBeGreaterThanOrEqual(1);
  });
});

describe('RateLimitError', () => {
  it('carries retryAfter for the resource-exhausted HttpsError details', () => {
    const err = new RateLimitError('too many', 42);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RateLimitError');
    expect(err.retryAfter).toBe(42);
  });
});

describe('shared limit configs', () => {
  it.each([WRITE_LIMIT, AI_HELP_LIMIT, PARSE_OFFER_LIMIT])(
    'config %# has a distinct name and sane bounds',
    (config) => {
      expect(config.name.length).toBeGreaterThan(0);
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThanOrEqual(60_000);
    }
  );

  it('limiter names are unique (they namespace the counter docs)', () => {
    const names = [WRITE_LIMIT.name, AI_HELP_LIMIT.name, PARSE_OFFER_LIMIT.name];
    expect(new Set(names).size).toBe(names.length);
  });
});
