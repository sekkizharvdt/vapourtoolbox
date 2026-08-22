/**
 * Purchase Order Type Definitions
 *
 * Types for purchase orders and commercial terms in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';
import type { CatalogLineDimensions, CatalogRef } from '../catalog';

// ============================================================================
// PURCHASE ORDER TYPES
// ============================================================================

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL' // first of two approvers (chosen by the submitter)
  | 'PENDING_FINAL_APPROVAL' // second/final approver
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'AMENDED';

export interface PurchaseOrder {
  id: string;
  number: string; // PO/YYYY/MM/XXXX

  // Multi-tenancy
  tenantId?: string;

  // Source
  rfqId: string;
  rfqNumber?: string; // Denormalized — source RFQ reference
  offerId: string;
  selectedOfferNumber: string; // Denormalized — system-generated (e.g., OFFER/2026/04/0001)
  vendorOfferNumber?: string; // Denormalized — vendor's own quotation reference
  vendorOfferDate?: Timestamp; // Denormalized — date on vendor's quotation

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized
  vendorContactPerson?: string; // From entity master at PO creation
  vendorEmail?: string;
  vendorPhone?: string;

  // Projects (can span multiple)
  projectIds: string[];
  projectNames: string[]; // Denormalized

  // Requester of the source Purchase Request (primary PR when several feed this
  // PO). Denormalised at creation so it can pre-fill the first approver — the
  // requester confirms the PO matches what they asked for (review 2.3).
  requestedBy?: string;
  requestedByName?: string;

  // Header
  title: string;
  description?: string;

  // Financial — `subtotal` is the basic price (pre-discount, pre-P&F). The
  // taxable value GST is computed on is `subtotal - discount + packingForwardingAmount`.
  subtotal: number;

  /**
   * Header discount amount in `currency` (absolute). Applied PRE-TAX: it
   * reduces the taxable value before GST, so `grandTotal` IS net of the
   * discount (procurement review round 3, item 2.2a).
   */
  discount?: number;

  /**
   * Packing & forwarding charge in `currency`, when not included in the line
   * prices (`commercialTerms.packingForwardingIncluded === false`). Added to
   * the taxable value before GST, so it flows into `grandTotal` (item 2.2b).
   */
  packingForwardingAmount?: number;

  /**
   * Pre-tax value GST is charged on: `subtotal - discount + packingForwardingAmount`.
   *
   * Persisted because the payment-milestone amounts are computed from it, and
   * a milestone that does not carry GST must be priced on this, not on
   * `grandTotal` (feedback jRO7w8mg). It was previously computed at write time
   * and thrown away, leaving every consumer to reconstruct it as
   * `grandTotal - totalTax`.
   *
   * Optional: POs written before this field existed do not carry it. Read it
   * through `getTaxableValue(po)` rather than directly.
   */
  taxableValue?: number;

  // Tax breakdown — computed on the taxable value above (not the raw subtotal)
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;

  grandTotal: number;
  currency: string;

  // Terms and Conditions (legacy - simple text fields)
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms?: string;
  penaltyClause?: string;
  otherClauses: string[];

  // Commercial Terms (new - structured fields)
  commercialTermsTemplateId?: string;
  commercialTermsTemplateName?: string; // Denormalized
  commercialTerms?: POCommercialTerms;

  // Delivery
  deliveryAddress: string;
  expectedDeliveryDate?: Timestamp;

  // Documents
  pdfVersion: number;
  latestPdfUrl?: string;
  /** Buyer-uploaded supporting documents (drawings, specs, certificates, ...). */
  attachments?: POAttachment[];

  // Order Acknowledgement
  oaFormUrl?: string;
  vendorSignedOaUrl?: string;
  oaReceivedAt?: Timestamp;
  oaComments?: string;

  // Status
  status: PurchaseOrderStatus;

  // Amendment tracking — written when an amendment is applied. The status
  // itself is NOT changed to AMENDED (feedback wsvWR2UnRSlwYmxMTi4w); the PO
  // list shows these in an "Amend. No." column instead.
  lastAmendmentNumber?: number; // sequential: 1, 2, 3...
  lastAmendmentDate?: Timestamp;

  // Approval workflow
  submittedForApprovalAt?: Timestamp;
  submittedBy?: string;

  // Two approvers, both chosen by the submitter at submit time (review 2.3).
  // The PO is approved sequentially: first approver, then second/final approver.
  approverId?: string; // first approver
  approverName?: string;
  secondApproverId?: string; // second / final approver
  secondApproverName?: string;

  // First-approval record — set when the first approver approves and the PO
  // moves to PENDING_FINAL_APPROVAL.
  firstApprovedBy?: string;
  firstApprovedByName?: string;
  firstApprovedAt?: Timestamp;

  // Final (second approver) approval record.
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  approvalSignature?: string; // Base64 or URL
  approvalComments?: string;

  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // "Return with Comments" — an approver sends the PO back to DRAFT for
  // revision instead of rejecting outright (full restart: on resubmission
  // both approvers approve again in sequence).
  returnedBy?: string;
  returnedByName?: string;
  returnedAt?: Timestamp;
  returnComments?: string;

  // Issuance
  issuedAt?: Timestamp;
  issuedBy?: string;

  // Advance payment
  advancePaymentRequired: boolean;
  advancePercentage?: number;
  advanceAmount?: number;
  advancePaymentStatus?: 'PENDING' | 'REQUESTED' | 'PAID';
  advancePaymentId?: string; // Link to accounting payment

  // Progress tracking
  deliveryProgress: number; // 0-100%

  /**
   * @deprecated Superseded by `paymentSummary`, which derives the same figure
   * from the actual bills and payments. This was written in exactly two places
   * and never updated after the advance, so it read 0 or the advance
   * percentage forever. Read `paymentSummary` instead; kept on the type only
   * so existing documents still parse.
   */
  paymentProgress: number; // 0-100%

  /**
   * Payment position, maintained by the `syncPOPaymentSummary` Cloud Function.
   * The ONLY way procurement can see what has been paid — see
   * {@link POPaymentSummary}. Absent until the first sync for this PO runs.
   */
  paymentSummary?: POPaymentSummary;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * Payment status of a PO or of one of its milestones.
 *
 * Labels live in `@vapour/constants/labels.ts` and render through
 * `StatusChip` (rule 29).
 */
export type POPaymentStatus = 'PENDING' | 'DUE' | 'PAYMENT_REQUESTED' | 'PARTIALLY_PAID' | 'PAID';

/** One payment recorded against a PO, as procurement sees it. */
export interface POPaymentHistoryEntry {
  /** VENDOR_PAYMENT transaction id. */
  paymentId: string;
  paymentNumber: string;
  paymentDate: Timestamp;
  /** Amount of this payment attributed to the PO, in the PO's currency. */
  amount: number;
  /** UTR / cheque / UPI reference, whichever the payment carries. */
  reference?: string;
  /** Milestone settled, when known. */
  milestoneId?: string;
  /** Bill the payment was allocated to, when it went through one. */
  billId?: string;
  billNumber?: string;
}

/** Per-milestone rollup inside {@link POPaymentSummary}. */
export interface POMilestonePaymentSummary {
  milestoneId: string;
  serialNumber: number;
  paymentType: string;
  percentage: number;
  /** Contract value of the milestone (PaymentMilestone.amount). */
  amount: number;
  /** Settled so far, derived from the bills and direct payments tagged to it. */
  paid: number;
  /** amount - paid, floored at zero. */
  pending: number;
  status: POPaymentStatus;
}

/**
 * Payment position of a PO, written by the `syncPOPaymentSummary` Cloud
 * Function and read by procurement.
 *
 * **This projection exists because procurement cannot read `transactions`.**
 * That collection requires VIEW_ACCOUNTING (firestore.rules), and four of the
 * nine live users hold MANAGE_PROCUREMENT without it — so a client-side query
 * for the bills behind a PO returns permission-denied for exactly the people
 * this feature is for. The Cloud Function runs with admin credentials, reads
 * the transactions, and publishes only the fields below onto the PO document,
 * which procurement already reads.
 *
 * **The field list is therefore a disclosure boundary, not a convenience.** It
 * carries what §7 of the feature request asks for — totals, milestone status,
 * and payment date/amount/reference — and deliberately nothing else. Never add
 * bank account, GL entries, TDS, bill line items or vendor pricing here;
 * widening it is a permissions decision.
 *
 * Recomputed from source on every trigger rather than incremented, so repeated
 * or out-of-order triggers converge (rule 21 — this is a projection, not a
 * cached counter).
 */
export interface POPaymentSummary {
  /** PO grand total at the time of the last sync. */
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: POPaymentStatus;
  milestones: POMilestonePaymentSummary[];
  /** Newest first. */
  history: POPaymentHistoryEntry[];
  /**
   * When the projection was last rebuilt. Render it: if the trigger fails,
   * procurement sees stale numbers with no other signal that anything is wrong.
   */
  syncedAt: Timestamp;
}

/** A buyer-uploaded supporting document stored against a PO. */
export interface POAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  /** Storage path, needed to delete the underlying file. */
  storagePath: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;

  // Source
  offerItemId: string;
  rfqItemId: string;

  // Item details
  lineNumber: number;
  description: string;
  specification?: string;

  /**
   * Structured plate size carried down the offer/RFQ chain, so the PO PDF and
   * the goods receipt both state the ordered size. `quantity` is a piece count
   * whenever this is present.
   */
  dimensions?: CatalogLineDimensions;

  // Equipment linkage
  projectId: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Quantity and pricing
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;

  // Per-line discount, carried verbatim from the winning vendor quote item
  // (feedback Mqj9wmh96ui3mlBtWNOF; same vocabulary as VendorQuoteItem).
  // `amount` is already net of this discount. Absent on POs created before
  // 2026-07; display derives qty×unitPrice−amount.
  discountType?: 'PERCENT' | 'ABSOLUTE';
  discountValue?: number;
  discountAmount?: number;

  // Tax
  gstRate: number;
  gstAmount: number;
  /** HSN code (goods) or SAC code (services) for this line — printed on the PO PDF. */
  hsnSacCode?: string;

  // Make/model
  makeModel?: string;

  // Delivery
  deliveryDate?: Timestamp;
  deliveryLocation?: string;

  // Status tracking
  quantityDelivered: number;
  quantityAccepted: number;
  quantityRejected: number;

  deliveryStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';

  // Material database linkage (carried from offer/RFQ chain)
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Bought-out catalog linkage (carried from offer/RFQ chain — A2 pricing
  // bridge: lets PO/GR/bill events feed bought_out_prices the same way
  // materialId feeds materialPrices)
  boughtOutItemId?: string;
  /**
   * Which SIZE of the bought-out product — `BoughtOutVariant.id` plus its code,
   * denormalized per rule 26 (see PurchaseRequestItem for the reasoning).
   */
  boughtOutVariantId?: string;
  boughtOutVariantCode?: string;
  /** Unified catalog linkage, denormalized alongside the per-kind id (rule 26). */
  catalogRef?: CatalogRef;

  // Service catalog linkage (carried from offer/RFQ chain)
  itemType?: 'MATERIAL' | 'BOUGHT_OUT' | 'SERVICE';
  serviceId?: string;
  serviceCode?: string;
  serviceName?: string;
  serviceCategory?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// PO COMMERCIAL TERMS TYPES
// ============================================================================

/**
 * Payment milestone for structured payment schedule
 * Used to define percentage-based payment terms in POs
 */
export interface PaymentMilestone {
  id: string;
  serialNumber: number;
  paymentType: string; // "Advance", "Before Dispatch", "On Receipt", etc.
  percentage: number; // 0-100
  deliverables: string; // What triggers this payment
  /**
   * Whether the tax (GST) portion is paid with this milestone. Buyers usually
   * pay the full tax with the dispatch/main payment, not with advances or
   * retention — this flags that stage so the payment terms and accounts release
   * are unambiguous (procurement review round 3, items 2.2c/2.2d).
   */
  carriesTax?: boolean;

  /**
   * Contract value of this milestone in the PO's currency.
   *
   * DERIVED from `percentage` and the PO totals, not entered by hand —
   * `percentage` remains the source of truth. It is persisted because the
   * figure is contractual: it prints on the PO, the vendor's proforma quotes
   * it, and the payment tracking measures against it, so all three must cite
   * one number rather than each re-deriving it.
   *
   * Recomputed by `calculateMilestoneAmounts` on every path that moves
   * `grandTotal` — PO create, draft edit, and amendment apply.
   *
   * Optional: milestones written before this field existed do not carry it.
   */
  amount?: number;
}

/**
 * Price basis options for PO pricing
 */
export type POPriceBasis = 'FOR_SITE' | 'EX_WORKS' | 'FOR_DESTINATION';

/**
 * Delivery trigger options
 */
export type PODeliveryTrigger = 'PO_DATE' | 'ADVANCE_PAYMENT' | 'DRAWING_APPROVAL';

/**
 * Delivery period unit options
 * READY_STOCK: Items available immediately (no period needed)
 * DAYS: Delivery period in days
 * WEEKS: Delivery period in weeks
 * MONTHS: Delivery period in months
 */
export type PODeliveryUnit = 'READY_STOCK' | 'DAYS' | 'WEEKS' | 'MONTHS';

/**
 * Scope assignment - who is responsible
 */
export type POScopeAssignment = 'VENDOR' | 'CUSTOMER';

/**
 * Erection scope options
 */
export type POErectionScope = 'VENDOR' | 'NA' | 'CUSTOM';

/**
 * Document types that can be required
 */
export type PORequiredDocument = 'DRAWING' | 'DATA_SHEET' | 'QAP' | 'OTHER';

/**
 * Inspector type options
 */
export type POInspectorType = 'VDT' | 'VDT_CONSULTANT' | 'THIRD_PARTY';

/**
 * Structured commercial terms for Purchase Orders
 * 19 sections matching VDT's standard format for Bought-Out Items
 */
export interface POCommercialTerms {
  // 1. Price Basis
  priceBasis: POPriceBasis;
  /** Named location for the price basis, e.g. "Chennai" — relevant for EX_WORKS (review 2.3). */
  priceBasisLocation?: string;

  // 2. Payment Terms (structured table)
  paymentSchedule: PaymentMilestone[];

  // 3. Currency
  currency: string;

  // 4. Delivery
  deliveryPeriod: number; // Value depends on deliveryUnit (ignored if READY_STOCK)
  deliveryUnit: PODeliveryUnit; // READY_STOCK, DAYS, WEEKS, MONTHS
  deliveryTrigger: PODeliveryTrigger; // When delivery period starts counting

  /**
   * Free-text delivery schedule / milestones, e.g. "First-cut drawing within 10
   * working days from PO; engineering complete within 30 days." Shown in the PDF
   * delivery block when set (feedback iZqGG). Optional — supplements the
   * structured deliveryPeriod/Unit fields above.
   */
  deliverySchedule?: string;

  /**
   * @deprecated Use deliveryPeriod instead. Kept for backward compatibility.
   * If deliveryUnit is not set, this value is assumed to be in weeks.
   */
  deliveryWeeks?: number;

  // Section visibility toggles (Service Orders — feedback iZqGG).
  // When `false`, the corresponding section is omitted from the PO PDF (e.g. a
  // service order with no freight/transport). Undefined/true => shown
  // (back-compat with POs created before these fields existed).
  freightRequired?: boolean;
  transportRequired?: boolean;
  transitInsuranceRequired?: boolean;
  erectionRequired?: boolean;
  inspectionRequired?: boolean;

  // 5. Packing & Forwarding
  packingForwardingIncluded: boolean;
  pfChargeType?: 'PERCENTAGE' | 'LUMPSUM';
  pfChargeValue?: number;

  // 6-8. Scope assignments
  freightScope: POScopeAssignment;
  /** When freight is in the customer's scope, whether it is prepaid or to-pay (review 2.3). */
  freightPaymentType?: 'PREPAID' | 'TO_PAY';
  transportScope: POScopeAssignment;
  /** Optional named transporter (review 2.3). */
  transporterName?: string;
  /** Delivery type — to the vendor's godown or to the destination door (review 2.3). */
  deliveryType?: 'GODOWN' | 'DOOR';
  transitInsuranceScope: POScopeAssignment;
  /** Free-text instruction, e.g. share dispatch details / open-policy details (review 2.3). */
  transitInsuranceInstruction?: string;

  // 9. Erection & Commissioning
  erectionScope: POErectionScope;
  erectionCustomText?: string;
  /** Vendor-scope erection sub-items: whether the vendor covers these (review 2.3). */
  erectionIncludesTransport?: boolean;
  erectionIncludesFood?: boolean;
  erectionIncludesAccommodation?: boolean;

  // 10. Billing Address (fixed VDT)
  billingAddress: string;

  // 11. Delivery Address
  deliveryAddress: string;
  /**
   * Project-specific packing requirements for the supplier — sea-worthy export
   * packing, moisture/corrosion protection, precautions for rough handling
   * (feedback K8tVouBR). Free text; shown on the PO view and the PO PDF so the
   * requirement reaches the vendor. Used for both indigenous and import orders.
   */
  packingInstructions?: string;

  // 12. Document Submission — "post order documents" (GAD, datasheet, QAP, ...)
  // the vendor must submit before starting production (review 2.3).
  requiredDocuments: PORequiredDocument[];
  otherDocuments?: string[];

  // 13. Inspection
  inspectorType: POInspectorType;
  /** Stage inspection vs final inspection (review 2.3). */
  inspectionType?: 'STAGE' | 'FINAL';
  /** Documents the vendor must submit along with the inspection call (review 2.3). */
  inspectionDocuments?: string[];

  // 14. MDCC Required
  mdccRequired: boolean;

  // 15. Liquidated Damages
  ldPerWeekPercent: number; // Default 0.5
  ldMaxPercent: number; // Default 5

  // 16. Force Majeure (standard text - not editable per-PO)
  // 17. Rejection Clause (standard text - not editable per-PO)
  // These are stored in the template's fixedTexts

  // 18. Warranty
  /**
   * When false, the warranty clause renders "Not applicable" instead of a
   * "0 months from supply..." string. Undefined is treated as applicable
   * (back-compat with POs created before this field existed).
   */
  warrantyApplicable?: boolean;
  warrantyMonthsFromSupply: number; // Default 18
  warrantyMonthsFromCommissioning: number; // Default 12
  /**
   * VDT's standard is "whichever is later"; some vendors agree "whichever is
   * earlier". Undefined is treated as 'LATER' (back-compat).
   */
  warrantyComparison?: 'EARLIER' | 'LATER';

  // 19. Buyer Contact
  buyerContactName: string;
  buyerContactPhone: string;
  buyerContactEmail: string;

  // 20. Service Terms — present when the PO covers service line items
  // (a Service Order is just a PO carrying service lines + these terms).
  // All optional; left blank for pure-material POs.
  serviceTerms?: POServiceTerms;

  // 21. Safety & Compliance — optional, checkbox-gated detail per item.
  safetyCompliance?: POSafetyCompliance;
}

/**
 * Service-oriented terms for a PO that includes service line items.
 * The material sections above (freight, transport, packing, dispatch,
 * material inspection, warranty-from-supply) stay optional and are simply
 * left blank on a pure-service PO. Service payment milestones reuse the
 * same `paymentSchedule` (PaymentMilestone[]) — no separate type.
 */
export interface POServiceTerms {
  /** What the vendor will perform. */
  scopeOfWork?: string;
  /** Deliverables / outputs expected from the service. */
  deliverables?: string;
  /** Service completion period value — paired with completionPeriodUnit. */
  completionPeriod?: number;
  completionPeriodUnit?: 'DAYS' | 'WEEKS' | 'MONTHS';
  /** Where the service is performed (site / vendor works / remote). */
  serviceLocation?: string;
  /** How completion is verified / signed off. */
  acceptanceCriteria?: string;
  /** Anything explicitly out of scope. */
  exclusions?: string;
}

/**
 * Optional safety & compliance requirements for on-site service work.
 * Each requirement is a checkbox; ticking it reveals a free-text detail.
 */
export interface POSafetyCompliance {
  safetyRequired?: boolean;
  safetyDetails?: string;
  ppeRequired?: boolean;
  ppeDetails?: string;
  workPermitRequired?: boolean;
  workPermitDetails?: string;
  insuranceRequired?: boolean;
  insuranceDetails?: string;
}

/**
 * Template for commercial terms by equipment type
 * Provides defaults that can be overridden per-PO
 */
export interface CommercialTermsTemplate {
  id: string;
  name: string; // "Bought-Out Items", "Services", "Fabrication", etc.
  code: string; // "BO", "SVC", "FAB"
  description?: string;

  // Default values for all editable fields
  defaultTerms: Partial<POCommercialTerms>;

  // Fixed text clauses (not editable per-PO)
  fixedTexts: {
    packingForwarding: string;
    inspection: string;
    mdcc: string;
    forceMajeure: string;
    rejectionClause: string;
    warranty: string;
  };

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
