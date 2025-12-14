/**
 * HR Leave Management Types
 *
 * Types for leave types, leave balances, and leave requests
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields } from '../common';

// ============================================
// Leave Type Configuration
// ============================================

/**
 * Leave type codes
 */
export type LeaveTypeCode = 'SICK' | 'CASUAL' | 'EARNED' | 'UNPAID' | 'MATERNITY' | 'PATERNITY';

/**
 * Leave type configuration (master data)
 */
export interface LeaveType extends TimestampFields {
  id: string;
  code: LeaveTypeCode;
  name: string; // e.g., "Sick Leave"
  description?: string;
  annualQuota: number; // 12 for sick, 12 for casual
  carryForwardAllowed: boolean;
  maxCarryForward?: number; // Max days that can be carried forward
  isPaid: boolean;
  requiresApproval: boolean; // Whether approval workflow is required
  minNoticeDays?: number; // Minimum days notice required
  maxConsecutiveDays?: number; // Maximum consecutive days allowed
  allowHalfDay: boolean; // Whether half-day leaves are allowed
  color?: string; // Display color for calendar/UI
  isActive: boolean;
  order?: number; // Display order
}

// ============================================
// Leave Balance
// ============================================

/**
 * Leave balance per employee per leave type per fiscal year
 */
export interface LeaveBalance extends TimestampFields {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  leaveTypeId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  fiscalYear: number; // e.g., 2025 (Jan 1 - Dec 31)
  entitled: number; // Annual quota
  carryForward: number; // From previous year (alias for carriedForward)
  used: number; // Days taken (approved)
  pending: number; // Days in pending requests
  available: number; // entitled + carryForward - used - pending
}

// ============================================
// Leave Request
// ============================================

/**
 * Leave request status
 */
export type LeaveRequestStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

/**
 * Half day type
 */
export type HalfDayType = 'FIRST_HALF' | 'SECOND_HALF';

/**
 * Leave approval record for audit trail
 */
export interface LeaveApprovalRecord {
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  actorId: string;
  actorName: string;
  timestamp: Timestamp;
  remarks?: string;
}

/**
 * Leave request
 */
export interface LeaveRequest extends TimestampFields {
  id: string;
  requestNumber: string; // LR-2025-001

  // Employee Details
  userId: string;
  userName: string;
  userEmail: string;
  department?: string;

  // Leave Details
  leaveTypeId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  numberOfDays: number; // Calculated (can be 0.5 for half day)
  isHalfDay: boolean;
  halfDayType?: HalfDayType;
  reason: string;
  attachmentUrls?: string[];
  fiscalYear: number; // Fiscal year the leave belongs to

  // Approval Workflow (parallel - any one can approve)
  status: LeaveRequestStatus;
  approverIds: string[]; // UIDs of designated approvers
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;

  // Submission
  submittedAt?: Timestamp;

  // Audit Trail
  approvalHistory: LeaveApprovalRecord[];
}

// ============================================
// Input Types for Services
// ============================================

/**
 * Input for creating a leave request
 */
export interface CreateLeaveRequestInput {
  userId: string;
  userName: string;
  userEmail: string;
  department?: string;
  leaveTypeId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  halfDayType?: HalfDayType;
  reason: string;
}

/**
 * Filters for listing leave requests
 */
export interface LeaveRequestFilters {
  userId?: string;
  status?: LeaveRequestStatus | LeaveRequestStatus[];
  leaveTypeCode?: LeaveTypeCode;
  fiscalYear?: number;
  startDateFrom?: Date;
  startDateTo?: Date;
}

/**
 * Leave calendar entry (for team calendar view)
 */
export interface LeaveCalendarEntry {
  id: string;
  userId: string;
  userName: string;
  leaveTypeName: string;
  leaveTypeCode: LeaveTypeCode;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  status: LeaveRequestStatus;
  isHalfDay: boolean;
  halfDayType?: HalfDayType;
}
