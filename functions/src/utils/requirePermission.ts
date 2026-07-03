import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';

/**
 * Permission enforcement for callable Cloud Functions.
 *
 * Client SDK writes are guarded by Firestore rules, but callables run with the
 * Admin SDK and bypass rules entirely — so every privileged callable MUST check
 * the caller's permission bits itself (CLAUDE.md rule 5). Custom claims are the
 * source of truth (minted by onUserUpdate); `request.auth.token.permissions` and
 * `permissions2` mirror the user document's permission bitfields.
 *
 * Bit values live in packages/constants/src/permissions.ts. Common ones:
 *   MANAGE_USERS      = 1        (admin indicator)
 *   CREATE_ENTITIES   = 64
 *   MANAGE_ACCOUNTING = 16384
 */

/** Bitwise "has this permission" against a claims bitfield. */
function bitfieldHas(bitfield: unknown, bit: number): boolean {
  const value = typeof bitfield === 'number' ? bitfield : 0;
  return (value & bit) === bit;
}

/**
 * Assert the caller is authenticated and holds `requiredBit` in `permissions`.
 * Throws the appropriate HttpsError otherwise. Returns the caller uid.
 */
export function requirePermission(
  request: CallableRequest,
  requiredBit: number,
  action: string
): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', `Authentication required to ${action}.`);
  }
  if (!bitfieldHas(request.auth.token.permissions, requiredBit)) {
    throw new HttpsError('permission-denied', `You do not have permission to ${action}.`);
  }
  return request.auth.uid;
}

/** Same as requirePermission but checks the extended `permissions2` bitfield. */
export function requirePermission2(
  request: CallableRequest,
  requiredBit: number,
  action: string
): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', `Authentication required to ${action}.`);
  }
  if (!bitfieldHas(request.auth.token.permissions2, requiredBit)) {
    throw new HttpsError('permission-denied', `You do not have permission to ${action}.`);
  }
  return request.auth.uid;
}

/** MANAGE_USERS (bit 0) is the app's admin indicator. */
export const MANAGE_USERS_BIT = 1;
/** CREATE_ENTITIES (bit 6). */
export const CREATE_ENTITIES_BIT = 64;
