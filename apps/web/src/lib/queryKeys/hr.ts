/**
 * HR Module Query Keys
 *
 * Centralized query key factories for HR-related queries.
 * Follows TanStack Query best practices for query key management.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

import { LeaveRequestStatus, LeaveTypeCode } from '@vapour/types';

export interface LeaveRequestFilters {
  status?: LeaveRequestStatus;
  userId?: string;
  leaveTypeCode?: LeaveTypeCode;
  fiscalYear?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface LeaveBalanceFilters {
  userId?: string;
  fiscalYear?: number;
  leaveTypeCode?: LeaveTypeCode;
}

/**
 * Leave Type query keys
 */
export const leaveTypeKeys = {
  all: ['leaveTypes'] as const,
  lists: () => [...leaveTypeKeys.all, 'list'] as const,
  list: (filters?: { isActive?: boolean }) => [...leaveTypeKeys.lists(), filters ?? {}] as const,
  details: () => [...leaveTypeKeys.all, 'detail'] as const,
  detail: (id: string) => [...leaveTypeKeys.details(), id] as const,
  byCode: (code: LeaveTypeCode) => [...leaveTypeKeys.all, 'byCode', code] as const,
};

/**
 * Leave Balance query keys
 */
export const leaveBalanceKeys = {
  all: ['leaveBalances'] as const,
  lists: () => [...leaveBalanceKeys.all, 'list'] as const,
  list: (filters?: LeaveBalanceFilters) => [...leaveBalanceKeys.lists(), filters ?? {}] as const,
  details: () => [...leaveBalanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...leaveBalanceKeys.details(), id] as const,
  byUser: (userId: string) => [...leaveBalanceKeys.all, 'byUser', userId] as const,
  byUserAndYear: (userId: string, fiscalYear: number) =>
    [...leaveBalanceKeys.all, 'byUserAndYear', userId, fiscalYear] as const,
  myBalance: (fiscalYear?: number) =>
    [...leaveBalanceKeys.all, 'myBalance', fiscalYear ?? 'current'] as const,
};

/**
 * Leave Request query keys
 */
export const leaveRequestKeys = {
  all: ['leaveRequests'] as const,
  lists: () => [...leaveRequestKeys.all, 'list'] as const,
  list: (filters?: LeaveRequestFilters) => [...leaveRequestKeys.lists(), filters ?? {}] as const,
  details: () => [...leaveRequestKeys.all, 'detail'] as const,
  detail: (id: string) => [...leaveRequestKeys.details(), id] as const,
  myRequests: (filters?: Omit<LeaveRequestFilters, 'userId'>) =>
    [...leaveRequestKeys.all, 'myRequests', filters ?? {}] as const,
  pendingApproval: () => [...leaveRequestKeys.all, 'pendingApproval'] as const,
  byUser: (userId: string) => [...leaveRequestKeys.all, 'byUser', userId] as const,
  calendar: (year: number, month?: number) =>
    [...leaveRequestKeys.all, 'calendar', year, month ?? 'all'] as const,
};

/**
 * HR Stats query keys (for dashboard)
 */
export const hrStatsKeys = {
  all: ['hrStats'] as const,
  teamOnLeave: (date?: string) => [...hrStatsKeys.all, 'teamOnLeave', date ?? 'today'] as const,
  pendingApprovalCount: () => [...hrStatsKeys.all, 'pendingApprovalCount'] as const,
  myLeaveStats: (fiscalYear?: number) =>
    [...hrStatsKeys.all, 'myLeaveStats', fiscalYear ?? 'current'] as const,
};
