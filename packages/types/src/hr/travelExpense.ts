/**
 * HR Travel Expense Management Types
 *
 * Types for travel expense reports, expense items, and approval workflow
 */

import { Timestamp } from 'firebase/firestore';
import { CurrencyCode, TimestampFields } from '../common';

// ============================================
// Expense Categories
// ============================================

/**
 * Travel expense category codes
 */
export type TravelExpenseCategory =
  | 'TRAVEL' // Air, train, bus for intercity travel
  | 'ACCOMMODATION' // Hotel, lodging
  | 'LOCAL_CONVEYANCE' // Auto, metro, local taxi, cab
  | 'FOOD' // Meals, refreshments
  | 'OTHER'; // Miscellaneous expenses

// ============================================
// Expense Item
// ============================================

/**
 * Individual expense line item
 */
export interface TravelExpenseItem {
  id: string;
  category: TravelExpenseCategory;
  description: string;
  expenseDate: Timestamp;
  amount: number;
  currency: CurrencyCode;

  // Bill/Receipt
  hasReceipt: boolean;
  receiptAttachmentId?: string;
  receiptFileName?: string;
  receiptUrl?: string;

  // Vendor info (parsed or manual)
  vendorName?: string;
  invoiceNumber?: string;

  // GST (for Indian compliance)
  gstRate?: number; // Total GST rate (e.g., 18)
  gstAmount?: number; // Total GST amount
  cgstAmount?: number; // CGST amount (intra-state)
  sgstAmount?: number; // SGST amount (intra-state)
  igstAmount?: number; // IGST amount (inter-state)
  vendorGstin?: string; // Vendor's GSTIN if applicable
  ourGstinUsed?: boolean; // Whether company GSTIN was provided on receipt
  taxableAmount?: number; // Amount before GST

  // For travel categories
  fromLocation?: string;
  toLocation?: string;

  // Approval (item-level)
  isApproved?: boolean;
  approvedAmount?: number;
  rejectionReason?: string;
}

/**
 * Input for adding/updating an expense item
 */
export interface TravelExpenseItemInput {
  category: TravelExpenseCategory;
  description: string;
  expenseDate: Date;
  amount: number;
  currency?: CurrencyCode;
  vendorName?: string;
  invoiceNumber?: string;
  gstRate?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxableAmount?: number;
  vendorGstin?: string;
  ourGstinUsed?: boolean;
  fromLocation?: string;
  toLocation?: string;
}

// ============================================
// Expense Report Status
// ============================================

/**
 * Travel expense report status
 */
export type TravelExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REIMBURSED';

// ============================================
// Approval Record
// ============================================

/**
 * Approval action types
 */
export type TravelExpenseApprovalAction = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RETURNED'; // Returned for revision

/**
 * Approval history record
 */
export interface TravelExpenseApprovalRecord {
  action: TravelExpenseApprovalAction;
  userId: string;
  userName: string;
  timestamp: Timestamp;
  comments?: string;
  approvedAmount?: number; // For partial approvals
}

// ============================================
// Travel Expense Report
// ============================================

/**
 * Main travel expense report
 */
export interface TravelExpenseReport extends TimestampFields {
  id: string;
  reportNumber: string; // TE-2025-001

  // Trip Details
  tripPurpose: string;
  tripStartDate: Timestamp;
  tripEndDate: Timestamp;
  destinations: string[]; // Cities visited
  projectId?: string; // Link to project if applicable
  projectName?: string;
  costCentreId?: string;
  costCentreName?: string;

  // Employee
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department?: string;

  // Expenses
  items: TravelExpenseItem[];

  // Totals by category
  categoryTotals: Partial<Record<TravelExpenseCategory, number>>;
  totalAmount: number;
  totalGstAmount: number;
  currency: CurrencyCode;

  // Approval
  status: TravelExpenseStatus;
  approverIds: string[]; // UIDs of designated approvers (reporting managers)
  approvalHistory: TravelExpenseApprovalRecord[];
  approvedAmount?: number;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Submission
  submittedAt?: Timestamp;

  // Reimbursement (from accounting)
  reimbursementTransactionId?: string;
  reimbursedAmount?: number;
  reimbursementDate?: Timestamp;

  // Generated PDF
  pdfUrl?: string;
  pdfGeneratedAt?: Timestamp;

  // Notes
  notes?: string;
}

// ============================================
// Input Types for Services
// ============================================

/**
 * Input for creating a new travel expense report
 */
export interface CreateTravelExpenseInput {
  tripPurpose: string;
  tripStartDate: Date;
  tripEndDate: Date;
  destinations: string[];
  projectId?: string;
  projectName?: string;
  costCentreId?: string;
  costCentreName?: string;
  notes?: string;
}

/**
 * Input for updating a travel expense report
 */
export interface UpdateTravelExpenseInput {
  tripPurpose?: string;
  tripStartDate?: Date;
  tripEndDate?: Date;
  destinations?: string[];
  projectId?: string;
  projectName?: string;
  costCentreId?: string;
  costCentreName?: string;
  notes?: string;
}

/**
 * Filters for listing travel expense reports
 */
export interface TravelExpenseFilters {
  employeeId?: string;
  status?: TravelExpenseStatus | TravelExpenseStatus[];
  projectId?: string;
  costCentreId?: string;
  tripStartDateFrom?: Date;
  tripStartDateTo?: Date;
  submittedDateFrom?: Date;
  submittedDateTo?: Date;
}

// ============================================
// Parsed Receipt Data (from Document AI)
// ============================================

/**
 * Data extracted from receipt by Document AI
 */
export interface ParsedReceiptData {
  vendorName?: string;
  invoiceNumber?: string;
  transactionDate?: Date;
  totalAmount?: number;
  taxableAmount?: number;
  currency?: CurrencyCode;

  // GST breakdown
  gstAmount?: number;
  gstRate?: number;
  cgstAmount?: number;
  cgstRate?: number;
  sgstAmount?: number;
  sgstRate?: number;
  igstAmount?: number;
  igstRate?: number;

  // GSTIN
  vendorGstin?: string;
  companyGstinFound?: boolean; // True if company's GSTIN was found on receipt
  companyGstinOnReceipt?: string; // The GSTIN found (for verification)

  // Line items
  lineItems?: {
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
    gstRate?: number;
  }[];

  // Categorization
  suggestedCategory?: TravelExpenseCategory;
  categoryConfidence?: number;

  // Metadata
  confidence: number; // 0-1 overall confidence score
  rawText?: string; // For debugging
  processingTimeMs?: number;
}

/**
 * Receipt parsing result
 */
export interface ReceiptParseResult {
  success: boolean;
  data?: ParsedReceiptData;
  error?: string;
  attachmentId: string;
  fileName: string;
}
