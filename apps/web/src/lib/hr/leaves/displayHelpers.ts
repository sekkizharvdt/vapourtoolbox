/**
 * Leave Display Helpers
 *
 * Shared utilities for displaying leave-related data across the HR module.
 */

import type { LeaveRequestStatus } from '@vapour/types';
import { LEAVE_REQUEST_STATUS_LABELS } from '@vapour/constants';
import { formatDate as formatDateCanonical } from '@/lib/utils/formatters';

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
 * Human-readable labels for leave request statuses.
 * Re-exported from @vapour/constants — single source of truth (rule 29).
 */
export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = LEAVE_REQUEST_STATUS_LABELS;

/**
 * Format a date for display in the HR module
 * Uses Indian English locale with short month format
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "15 Dec 2025")
 */
export function formatLeaveDate(date: Date): string {
  return formatDateCanonical(date);
}

/**
 * Format a date and time for display in the HR module
 * Uses Indian English locale with short month format
 *
 * @param date - Date to format
 * @returns Formatted date-time string (e.g., "15 Dec 2025, 14:30")
 */
export function formatLeaveDateTime(date: Date): string {
  return formatDateCanonical(date, 'datetime');
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
