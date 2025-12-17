'use client';

/**
 * React Query Hooks for Leave Types
 *
 * Provides cached and efficient data fetching for leave type configuration.
 * Leave types are infrequently updated, so aggressive caching is beneficial.
 */

import { useQuery } from '@tanstack/react-query';
import { leaveTypeKeys } from '@/lib/queryKeys';
import { getLeaveTypes, getLeaveTypeById, getLeaveTypeByCode } from '../leaveTypeService';
import type { LeaveTypeCode } from '@vapour/types';

/**
 * Hook to fetch all leave types
 *
 * Features:
 * - 10-minute stale time (leave types rarely change)
 * - Automatic caching and deduplication
 * - Background refetching when stale
 *
 * @param includeInactive - Whether to include inactive leave types (default: false)
 * @param options - Additional query options
 */
export function useLeaveTypes(
  includeInactive = false,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: leaveTypeKeys.list({ isActive: !includeInactive }),
    queryFn: () => getLeaveTypes(includeInactive),
    enabled: options?.enabled ?? true,
    // Leave types rarely change - cache for 10 minutes
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch a single leave type by ID
 *
 * @param id - Leave type ID
 * @param options - Additional query options
 */
export function useLeaveType(
  id: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: id ? leaveTypeKeys.detail(id) : ['leaveTypes', 'null'],
    queryFn: () => (id ? getLeaveTypeById(id) : null),
    enabled: (options?.enabled ?? true) && !!id,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch a leave type by code
 *
 * @param code - Leave type code (e.g., 'CL', 'SL', 'EL')
 * @param options - Additional query options
 */
export function useLeaveTypeByCode(
  code: LeaveTypeCode | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: code ? leaveTypeKeys.byCode(code) : ['leaveTypes', 'byCode', 'null'],
    queryFn: () => (code ? getLeaveTypeByCode(code) : null),
    enabled: (options?.enabled ?? true) && !!code,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
  });
}
