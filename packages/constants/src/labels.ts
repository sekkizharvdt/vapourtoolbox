/**
 * Domain-facing label constants (CLAUDE.md rule 29).
 *
 * Single source of truth for user-visible strings that represent domain
 * concepts. Change these here, not inline in components, so procurement /
 * accounting / HR staff can flip terminology ("Ex-Works" → "Price Basis")
 * without a diff hunt across the codebase.
 *
 * Scope: form labels, table column headers, status chips, enum values shown
 * in dropdowns, dashboard card labels, PDF section headings. NOT error
 * messages, console logs, or internal identifiers.
 *
 * Reviewed quarterly with the domain owners. Additions go in via PR against
 * this file.
 */

// ============================================================================
// PROCUREMENT — offer commercial terms (review #29, #31)
// ============================================================================

export const OFFER_COMMERCIAL_LABELS = {
  /** Historic field `exWorks` surfaced to users as "Price Basis". */
  priceBasis: 'Price Basis',
  transportation: 'Transportation',
  packingForwarding: 'Packing & Forwarding',
  insurance: 'Insurance',
  /** Historic field `erectionAfterPurchase` surfaced to users as "Erection & Commissioning". */
  erectionAndCommissioning: 'Erection & Commissioning',
  inspection: 'Inspection',
  discount: 'Discount',
  validityDate: 'Offer Validity',
} as const;

// ============================================================================
// PROCUREMENT — payment lifecycle (review #36)
// ============================================================================

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved for Payment',
  PARTLY_CLEARED: 'Partly Cleared',
  CLEARED: 'Cleared',
} as const;

export type PaymentStatusKey = keyof typeof PAYMENT_STATUS_LABELS;

/** Column header and chip legend for payment tracking on GRs / POs. */
export const PAYMENT_STATUS_COLUMN_LABEL = 'Payment Status';

// ============================================================================
// PROCUREMENT — document references (review #35)
// ============================================================================

export const PO_LABELS = {
  vendorOfferReference: 'Vendor Offer Reference',
  systemOfferNumber: 'System Offer No.',
  vendorOfferNumber: 'Vendor Offer No.',
  sourceRFQ: 'Source RFQ',
  billingAddress: 'Billing Address',
  deliveryAddress: 'Delivery Address',
  specialInstructions: 'Special Instructions',
} as const;

export const RFQ_LABELS = {
  sourcePR: 'Source PR',
  supportingDocuments: 'Supporting Documents',
} as const;

// ============================================================================
// PROCUREMENT — PR dashboard chips (review #13)
// ============================================================================

export const PR_STATUS_CATEGORY_LABELS = {
  /** Top-row primary categories. */
  draft: 'Draft',
  submitted: 'Submitted',
  convertedToRFQ: 'Converted to RFQ',
  /** Sub-breakdown of Submitted. */
  pendingApproval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
} as const;
