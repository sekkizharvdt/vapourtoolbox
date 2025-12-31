/**
 * Leave Display Helpers
 *
 * Shared utilities for displaying leave-related data across the HR module.
 */

import type { LeaveRequestStatus } from '@vapour/types';

/**
 * MUI Chip color mapping for leave request statuses
 */
export const LEAVE_STATUS_COLORS: Record<
  LeaveRequestStatus,
  'default' | 'warning' | 'success' | 'error' | 'info'
> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  PARTIALLY_APPROVED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'info',
};

/**
 * Human-readable labels for leave request statuses
 */
export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  PARTIALLY_APPROVED: 'Partially Approved',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/**
 * Format a date for display in the HR module
 * Uses Indian English locale with short month format
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "15 Dec 2025")
 */
export function formatLeaveDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date and time for display in the HR module
 * Uses Indian English locale with short month format
 *
 * @param date - Date to format
 * @returns Formatted date-time string (e.g., "15 Dec 2025, 14:30")
 */
export function formatLeaveDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get the display properties for a leave request status
 *
 * @param status - Leave request status
 * @returns Object with label and color for the status
 */
export function getLeaveStatusDisplay(status: LeaveRequestStatus): {
  label: string;
  color: 'default' | 'warning' | 'success' | 'error' | 'info';
} {
  return {
    label: LEAVE_STATUS_LABELS[status],
    color: LEAVE_STATUS_COLORS[status],
  };
}
