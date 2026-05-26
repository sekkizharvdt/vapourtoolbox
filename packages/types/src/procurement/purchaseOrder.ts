/**
 * Purchase Order Type Definitions
 *
 * Types for purchase orders and commercial terms in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

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

  // Order Acknowledgement
  oaFormUrl?: string;
  vendorSignedOaUrl?: string;
  oaReceivedAt?: Timestamp;
  oaComments?: string;

  // Status
  status: PurchaseOrderStatus;

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
  paymentProgress: number; // 0-100%

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
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

  // Equipment linkage
  projectId: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Quantity and pricing
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;

  // Tax
  gstRate: number;
  gstAmount: number;

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

  // Service catalog linkage (carried from offer/RFQ chain)
  itemType?: 'MATERIAL' | 'SERVICE';
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
   * @deprecated Use deliveryPeriod instead. Kept for backward compatibility.
   * If deliveryUnit is not set, this value is assumed to be in weeks.
   */
  deliveryWeeks?: number;

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
