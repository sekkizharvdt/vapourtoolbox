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

// ============================================================================
// ACCOUNTING — transaction workflow status (sweep 2026-04-21)
// ============================================================================

/**
 * Labels for `TransactionStatus` enum (packages/types/src/transaction.ts).
 * Used by accounting dialogs (bills, invoices, journal entries, payments)
 * for chips, filter menus, and table columns.
 */
export const TRANSACTION_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  POSTED: 'Posted',
  VOID: 'Voided',
} as const;

/**
 * Labels for accounting `PaymentStatus` (UNPAID / PARTIALLY_PAID / PAID /
 * OVERDUE). Distinct from the procurement-side `PAYMENT_STATUS_LABELS`
 * above which tracks GR payment lifecycle.
 */
export const ACCOUNTING_PAYMENT_STATUS_LABELS = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
} as const;

// ============================================================================
// HR — leave / on-duty / travel expense status (sweep 2026-04-21)
// ============================================================================

/** Labels for `LeaveRequestStatus`. */
export const LEAVE_REQUEST_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
} as const;

/** Labels for `OnDutyRequestStatus` (same shape as leave). */
export const ON_DUTY_REQUEST_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
} as const;

/** Labels for `TravelExpenseStatus`. */
export const TRAVEL_EXPENSE_STATUS_LABELS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REIMBURSED: 'Reimbursed',
} as const;

// ============================================================================
// PROJECTS — proposal status (sweep 2026-04-21)
// ============================================================================

/** Labels for `ProposalStatus`. */
export const PROPOSAL_STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  SUBMITTED: 'Submitted',
  UNDER_NEGOTIATION: 'Under Negotiation',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
} as const;

/**
 * Labels for `EngagementType` — the kind of work a proposal is for.
 * Title is the short label; description is the one-liner shown under the picker card.
 */
export const ENGAGEMENT_TYPE_LABELS = {
  SITE_SURVEY: {
    title: 'Site Survey',
    description: 'Inspect a site and report on its condition.',
  },
  ENGINEERING: {
    title: 'Engineering & Design',
    description: 'Drawings, calculations, and technical documents.',
  },
  EPC: {
    title: 'Equipment & Plant Supply',
    description: 'Design, fabricate, supply, and install — the whole job.',
  },
  EPC_WITH_OM: {
    title: 'Plant Supply with O&M',
    description: 'Build the plant and operate it for an agreed period.',
  },
  OM: {
    title: 'Operations & Maintenance',
    description: 'Run an existing plant.',
  },
  CUSTOM: {
    title: 'Mixed / Other',
    description: "A combination, or doesn't fit the options above.",
  },
} as const;

/** Display order for the engagement-type picker. */
export const ENGAGEMENT_TYPE_ORDER = [
  'SITE_SURVEY',
  'ENGINEERING',
  'EPC',
  'EPC_WITH_OM',
  'OM',
  'CUSTOM',
] as const;

// ============================================================================
// FLOW — meeting + task labels (sweep 2026-04-21)
// ============================================================================

/** Labels for `MeetingStatus`. Lowercase enum values match existing type. */
export const MEETING_STATUS_LABELS = {
  draft: 'Draft',
  finalized: 'Finalized',
} as const;

/** Labels for `ManualTaskPriority`. */
export const MANUAL_TASK_PRIORITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
} as const;
