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

// ── Procurement ↔ accounting linkage (written by the accounting dialogs and
//    the procurement bridge, read by Cloud Functions and procurement services) ──

/**
 * PO id denormalised onto a VENDOR_BILL / VENDOR_PAYMENT.
 *
 * This is the ONE name for the link. `CreateBillDialog` used to write the same
 * value as `sourceDocumentId` while every reader queried `purchaseOrderId`,
 * which left 0 of 249 live bills discoverable and silently emptied the CF
 * payment rollup, `arePOPaymentsComplete` and three-way match. Do not
 * reintroduce a second name.
 */
export const TXN_FIELD_PURCHASE_ORDER_ID = 'purchaseOrderId' as const;

/**
 * PO number denormalised alongside {@link TXN_FIELD_PURCHASE_ORDER_ID} for
 * display without a lookup (rule 26).
 */
export const TXN_FIELD_SOURCE_PO_NUMBER = 'sourcePoNumber' as const;

/**
 * Payment milestone the bill or payment settles, keyed to
 * `PurchaseOrder.commercialTerms.paymentSchedule[].id`.
 */
export const TXN_FIELD_MILESTONE_ID = 'milestoneId' as const;
