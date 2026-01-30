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
  | 'PENDING_APPROVAL'
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

  // Source
  rfqId: string;
  offerId: string;
  selectedOfferNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Projects (can span multiple)
  projectIds: string[];
  projectNames: string[]; // Denormalized

  // Header
  title: string;
  description?: string;

  // Financial
  subtotal: number;

  // Tax breakdown
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

  // Selected approver (optional - if specified, creates task notification)
  approverId?: string;

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
  transportScope: POScopeAssignment;
  transitInsuranceScope: POScopeAssignment;

  // 9. Erection & Commissioning
  erectionScope: POErectionScope;
  erectionCustomText?: string;

  // 10. Billing Address (fixed VDT)
  billingAddress: string;

  // 11. Delivery Address
  deliveryAddress: string;

  // 12. Document Submission
  requiredDocuments: PORequiredDocument[];
  otherDocuments?: string[];

  // 13. Inspection
  inspectorType: POInspectorType;

  // 14. MDCC Required
  mdccRequired: boolean;

  // 15. Liquidated Damages
  ldPerWeekPercent: number; // Default 0.5
  ldMaxPercent: number; // Default 5

  // 16. Force Majeure (standard text - not editable per-PO)
  // 17. Rejection Clause (standard text - not editable per-PO)
  // These are stored in the template's fixedTexts

  // 18. Warranty
  warrantyMonthsFromSupply: number; // Default 18
  warrantyMonthsFromCommissioning: number; // Default 12

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
