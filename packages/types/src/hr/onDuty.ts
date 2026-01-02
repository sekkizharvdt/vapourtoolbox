/**
 * On-Duty Request Types
 *
 * Types for employees requesting to work on holidays.
 * Follows the same pattern as leave requests with 2-step approval workflow.
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields } from '../common';
import { ApprovalFlow, LeaveApprovalRecord } from './leave';

// ============================================
// On-Duty Request Status
// ============================================

/**
 * On-duty request status
 */
export type OnDutyRequestStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PARTIALLY_APPROVED' // First approver approved, awaiting second
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

// ============================================
// On-Duty Request
// ============================================

/**
 * On-duty request - employee applies to work on a holiday
 * Upon approval, employee receives compensatory leave (comp-off)
 */
export interface OnDutyRequest extends TimestampFields {
  id: string;
  requestNumber: string; // OD-2025-001

  // Employee Details
  userId: string;
  userName: string;
  userEmail: string;
  department?: string;

  // Holiday Details
  holidayDate: Timestamp;
  holidayName: string; // e.g., "Diwali", "Sunday", "Independence Day"
  holidayId?: string; // Reference to hrHolidays if applicable (null for recurring holidays)
  reason: string; // Business reason for working on holiday

  // Approval Workflow (same 2-step pattern as leave)
  status: OnDutyRequestStatus;
  approverIds: string[]; // Email addresses of approvers
  approvalFlow?: ApprovalFlow; // 2-step approval flow tracking
  approvedBy?: string; // Final approver userId
  approvedByName?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  submittedAt?: Timestamp;

  // Comp-off tracking
  compOffGranted: boolean; // True when approved and comp-off added to balance
  compOffUsed: boolean; // True when comp-off leave is taken
  fiscalYear: number; // e.g., 2025

  // Audit Trail
  approvalHistory: LeaveApprovalRecord[];
}

// ============================================
// Input Types
// ============================================

/**
 * Input for creating on-duty request
 */
export interface CreateOnDutyRequestInput {
  holidayDate: Date;
  holidayName: string;
  holidayId?: string;
  reason: string;
}

/**
 * Input for updating on-duty request (draft only)
 */
export interface UpdateOnDutyRequestInput {
  holidayDate?: Date;
  holidayName?: string;
  holidayId?: string;
  reason?: string;
}

/**
 * Filters for querying on-duty requests
 */
export interface OnDutyRequestFilters {
  userId?: string;
  status?: OnDutyRequestStatus | OnDutyRequestStatus[];
  fiscalYear?: number;
  dateFrom?: Date;
  dateTo?: Date;
  approverId?: string; // Filter for approver's pending requests
}
