/**
 * Shared Firestore Field Name Constants
 *
 * These constants define field names used across both client code (apps/web)
 * and Cloud Functions (functions/). Using shared constants prevents field name
 * mismatches that silently break features (e.g., Cloud Function writing "balance"
 * while client reads "currentBalance").
 *
 * When renaming a Firestore field:
 * 1. Update the constant here
 * 2. TypeScript will break in both client and Cloud Functions
 * 3. Fix all usages before deploying
 */

// ── Account document fields (written by accountBalances Cloud Function) ──

/** Running debit total on an account document */
export const ACCOUNT_FIELD_DEBIT = 'debit' as const;

/** Running credit total on an account document */
export const ACCOUNT_FIELD_CREDIT = 'credit' as const;

/** Running balance on an account document (debit - credit) */
export const ACCOUNT_FIELD_CURRENT_BALANCE = 'currentBalance' as const;

/** Timestamp of last balance update */
export const ACCOUNT_FIELD_LAST_UPDATED = 'lastUpdated' as const;

/** Opening balance set during chart-of-accounts initialization */
export const ACCOUNT_FIELD_OPENING_BALANCE = 'openingBalance' as const;

// ── Transaction document fields (read by Cloud Functions and client) ──

/** Transaction type discriminator */
export const TXN_FIELD_TYPE = 'type' as const;

/** GL entries array on a transaction */
export const TXN_FIELD_ENTRIES = 'entries' as const;

/** Entity ID for multi-tenancy filtering */
export const FIELD_ENTITY_ID = 'entityId' as const;

/** Soft-delete flag */
export const FIELD_IS_DELETED = 'isDeleted' as const;
