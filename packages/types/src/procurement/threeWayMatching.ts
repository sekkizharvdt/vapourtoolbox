/**
 * Three-Way Matching Type Definitions
 *
 * Types for matching PO, Goods Receipt, and Vendor Invoice in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// 3-WAY MATCHING TYPES
// ============================================================================

/**
 * Three-Way Match Status
 * Tracks the result of matching PO, GR, and Vendor Invoice
 */
export type ThreeWayMatchStatus =
  | 'MATCHED' // All three documents match within tolerance
  | 'PARTIALLY_MATCHED' // Some items match, some have discrepancies
  | 'NOT_MATCHED' // Significant discrepancies found
  | 'PENDING_REVIEW'; // Needs manual review

/**
 * Discrepancy Type
 * Categories of mismatches in 3-way matching
 */
export type DiscrepancyType =
  | 'QUANTITY_MISMATCH' // Invoiced qty != received qty
  | 'PRICE_MISMATCH' // Invoice price != PO price
  | 'AMOUNT_MISMATCH' // Invoice total != expected total
  | 'MISSING_GOODS_RECEIPT' // Invoice without corresponding GR
  | 'MISSING_PURCHASE_ORDER' // Invoice without corresponding PO
  | 'TAX_MISMATCH' // Tax calculation discrepancy
  | 'ITEM_NOT_ORDERED' // Item on invoice but not on PO
  | 'ITEM_NOT_RECEIVED' // Item on invoice but not received
  | 'TOLERANCE_EXCEEDED'; // Variance exceeds allowed tolerance

/**
 * Three-Way Match
 * Core matching record linking PO, GR, and Vendor Bill
 */
export interface ThreeWayMatch {
  id: string;
  matchNumber: string; // TWM/YYYY/MM/XXXX

  // Source documents
  purchaseOrderId: string;
  poNumber: string; // Denormalized

  goodsReceiptId: string;
  grNumber: string; // Denormalized

  vendorBillId: string; // Reference to transaction (VendorBill)
  vendorBillNumber: string; // Denormalized
  vendorInvoiceNumber: string; // Vendor's original invoice number

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Project
  projectId: string;
  projectName: string; // Denormalized

  // Matching results
  status: ThreeWayMatchStatus;
  overallMatchPercentage: number; // 0-100%

  // Financial summary
  poAmount: number; // Total PO amount
  grAmount: number; // Total value of goods received
  invoiceAmount: number; // Total invoice amount
  variance: number; // Invoice - GR amount
  variancePercentage: number; // (variance / GR amount) * 100

  // Tax comparison
  poTaxAmount: number;
  invoiceTaxAmount: number;
  taxVariance: number;

  // Line-level matching
  totalLines: number;
  matchedLines: number;
  unmatchedLines: number;

  // Discrepancies
  hasDiscrepancies: boolean;
  discrepancyCount: number;
  criticalDiscrepancyCount: number;

  // Tolerance check
  withinTolerance: boolean;
  toleranceConfigId?: string; // Reference to tolerance settings used

  // Approval workflow
  requiresApproval: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  approvalComments?: string;

  // Resolution
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  resolutionNotes?: string;

  // Automated vs Manual
  matchType: 'AUTOMATIC' | 'MANUAL' | 'SYSTEM_ASSISTED';
  matchedBy: string;
  matchedByName: string;

  // Timestamps
  matchedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * Match Line Item
 * Line-level matching details for PO, GR, and Invoice items
 */
export interface MatchLineItem {
  id: string;
  threeWayMatchId: string;

  // Item identification
  lineNumber: number;
  description: string;

  // Source line items
  poItemId: string;
  grItemId: string;
  invoiceLineItemId?: string; // May be null if item not on invoice

  // Quantity comparison
  orderedQuantity: number; // From PO
  receivedQuantity: number; // From GR
  invoicedQuantity: number; // From Invoice
  acceptedQuantity: number; // From GR (accepted qty)

  quantityMatched: boolean;
  quantityVariance: number; // Invoiced - Received
  quantityVariancePercentage: number;

  // Unit of measure
  unit: string;

  // Price comparison
  poUnitPrice: number;
  invoiceUnitPrice: number;
  priceMatched: boolean;
  priceVariance: number; // Invoice - PO
  priceVariancePercentage: number;

  // Amount comparison
  poLineTotal: number; // orderedQty * poUnitPrice
  grLineTotal: number; // receivedQty * poUnitPrice
  invoiceLineTotal: number; // invoicedQty * invoiceUnitPrice
  amountMatched: boolean;
  amountVariance: number;
  amountVariancePercentage: number;

  // Tax comparison (if applicable)
  poTaxRate?: number;
  invoiceTaxRate?: number;
  poTaxAmount?: number;
  invoiceTaxAmount?: number;
  taxMatched: boolean;
  taxVariance: number;

  // Match status
  lineStatus:
    | 'MATCHED'
    | 'VARIANCE_WITHIN_TOLERANCE'
    | 'VARIANCE_EXCEEDS_TOLERANCE'
    | 'NOT_MATCHED';
  withinTolerance: boolean;

  // Discrepancies
  hasDiscrepancy: boolean;
  discrepancyTypes: DiscrepancyType[];

  // Notes
  notes?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Match Discrepancy
 * Detailed discrepancy record for exceptions and variances
 */
export interface MatchDiscrepancy {
  id: string;
  threeWayMatchId: string;
  matchLineItemId?: string; // Null for header-level discrepancies

  // Discrepancy details
  discrepancyType: DiscrepancyType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Description
  description: string; // Human-readable description
  fieldName: string; // e.g., "quantity", "unitPrice", "totalAmount"

  // Values
  expectedValue: number | string; // Value from PO/GR
  actualValue: number | string; // Value from Invoice
  variance: number; // Difference (if numeric)
  variancePercentage: number | null;

  // Impact
  financialImpact: number; // Monetary impact of discrepancy
  affectsPayment: boolean; // Does this block payment?

  // Resolution
  resolved: boolean;
  resolution?:
    | 'ACCEPTED'
    | 'CORRECTED_BY_VENDOR'
    | 'PRICE_ADJUSTMENT'
    | 'QUANTITY_ADJUSTMENT'
    | 'WAIVED';
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: Timestamp;
  resolutionNotes?: string;

  // Approval (if waived)
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

/**
 * Match Tolerance Configuration
 * Defines acceptable variance thresholds for auto-matching
 */
export interface MatchToleranceConfig {
  id: string;
  name: string; // e.g., "Standard Tolerance", "Strict Tolerance"
  description?: string;

  // Quantity tolerances (percentage)
  quantityTolerancePercent: number; // e.g., 5% = 5.0
  allowQuantityOverage: boolean; // Allow invoiced qty > received qty
  allowQuantityShortage: boolean; // Allow invoiced qty < received qty

  // Price tolerances (percentage)
  priceTolerancePercent: number; // e.g., 2% = 2.0
  allowPriceIncrease: boolean; // Allow invoice price > PO price
  allowPriceDecrease: boolean; // Allow invoice price < PO price

  // Amount tolerances (absolute and percentage)
  amountTolerancePercent: number; // e.g., 5% = 5.0
  amountToleranceAbsolute: number; // e.g., 1000 INR
  useAbsoluteOrPercentage: 'ABSOLUTE' | 'PERCENTAGE' | 'WHICHEVER_IS_LOWER';

  // Tax tolerance
  taxTolerancePercent: number; // e.g., 1% = 1.0

  // Auto-approval thresholds
  autoApproveIfWithinTolerance: boolean;
  autoApproveMaxAmount: number; // Max invoice amount for auto-approval

  // Rounding
  roundingPrecision: number; // Decimal places for rounding (default: 2)

  // Status
  isActive: boolean;
  isDefault: boolean;

  // Application scope
  applicableTo: 'ALL' | 'SPECIFIC_VENDORS' | 'SPECIFIC_PROJECTS';
  vendorIds?: string[]; // If applicableTo = SPECIFIC_VENDORS
  projectIds?: string[]; // If applicableTo = SPECIFIC_PROJECTS

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
