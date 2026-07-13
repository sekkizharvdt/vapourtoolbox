// Firestore-backed rate limiting for Cloud Functions (security finding #2).
//
// The old in-memory RateLimiter was unsuitable for serverless: each instance
// kept its own counters and every cold start reset them, so the limits were
// decorative. This implementation uses a fixed-window counter document per
// (limiter, key, window) in the `rateLimits` collection, incremented inside a
// Firestore transaction — shared across instances and cold starts.
//
// Fixed windows allow at most 2× the limit across a window boundary, which is
// an acceptable trade for one small doc per active user per window. Documents
// carry `expiresAt` (two windows ahead); enable a Firestore TTL policy on
// rateLimits.expiresAt in the console to garbage-collect them — stale docs are
// otherwise inert (never read again).
//
// Clients can never touch the collection: firestore.rules ends in a
// default-deny and the Admin SDK bypasses rules.

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export interface FirestoreRateLimitConfig {
  /** Limiter namespace, e.g. 'aiHelp' — one quota per name. */
  name: string;
  maxRequests: number;
  windowMs: number;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number // seconds until the current window ends
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Index of the fixed window containing `nowMs`. Pure — unit-tested. */
export function windowIndex(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs);
}

/** Seconds until the current fixed window ends. Pure — unit-tested. */
export function retryAfterSeconds(nowMs: number, windowMs: number): number {
  const windowEnd = (windowIndex(nowMs, windowMs) + 1) * windowMs;
  return Math.max(1, Math.ceil((windowEnd - nowMs) / 1000));
}

/** Doc ids may not contain '/'; keys are uids/emails so this is belt-and-braces. */
function sanitizeKey(key: string): string {
  return key.replace(/\//g, '_');
}

/**
 * Enforce a rate limit for `key` (usually the caller's uid).
 * Throws RateLimitError when the limit is exceeded; the denied request is NOT
 * counted, so a user cannot lock themselves out further by retrying.
 */
export async function enforceFirestoreRateLimit(
  config: FirestoreRateLimitConfig,
  key: string,
  nowMs: number = Date.now()
): Promise<void> {
  const db = getFirestore();
  const idx = windowIndex(nowMs, config.windowMs);
  const ref = db.collection('rateLimits').doc(`${config.name}_${sanitizeKey(key)}_${idx}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data()?.count as number | undefined) ?? 0;

    if (count >= config.maxRequests) {
      const retryAfter = retryAfterSeconds(nowMs, config.windowMs);
      throw new RateLimitError(
        `Rate limit exceeded for ${config.name} (${config.maxRequests} per ${Math.round(
          config.windowMs / 1000
        )}s). Please try again in ${retryAfter} seconds.`,
        retryAfter
      );
    }

    tx.set(
      ref,
      {
        count: FieldValue.increment(1),
        name: config.name,
        key: sanitizeKey(key),
        windowIndex: idx,
        updatedAt: Timestamp.fromMillis(nowMs),
        // Two windows ahead so a TTL policy never deletes a doc still in use
        expiresAt: Timestamp.fromMillis((idx + 2) * config.windowMs),
      },
      { merge: true }
    );
  });
}

// ---------------------------------------------------------------------------
// Shared limit configurations
// ---------------------------------------------------------------------------

/** Moderate limit for state-changing callables (entity writes, recalculations). */
export const WRITE_LIMIT: FirestoreRateLimitConfig = {
  name: 'write',
  maxRequests: 30,
  windowMs: 60 * 1000,
};

/** AI helper — Anthropic API cost is the concern, not Firestore load. */
export const AI_HELP_LIMIT: FirestoreRateLimitConfig = {
  name: 'aiHelp',
  maxRequests: 30,
  windowMs: 60 * 60 * 1000,
};

/** Offer-document parsing — Document AI + Anthropic, the most expensive call. */
export const PARSE_OFFER_LIMIT: FirestoreRateLimitConfig = {
  name: 'parseOffer',
  maxRequests: 20,
  windowMs: 60 * 60 * 1000,
};
