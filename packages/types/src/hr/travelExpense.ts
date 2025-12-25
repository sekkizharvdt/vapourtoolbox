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
  | 'AIR_TRAVEL'
  | 'TRAIN_TRAVEL'
  | 'ROAD_TRAVEL' // Bus, taxi, cab for intercity
  | 'HOTEL'
  | 'FOOD'
  | 'LOCAL_CONVEYANCE' // Auto, metro, local taxi
  | 'OTHER';

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
  gstRate?: number;
  gstAmount?: number;
  vendorGstin?: string; // Vendor's GSTIN if applicable
  ourGstinUsed?: boolean; // Whether our GSTIN was provided

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
  currency?: CurrencyCode;
  gstAmount?: number;
  gstRate?: number;
  vendorGstin?: string;
  lineItems?: {
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }[];
  suggestedCategory?: TravelExpenseCategory;
  confidence: number; // 0-1 confidence score
  rawText?: string; // For debugging
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
