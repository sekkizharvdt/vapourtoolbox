'use client';

/**
 * React Query Hooks for Travel Expenses
 *
 * Provides cached and efficient data fetching for travel expense reports.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { travelExpenseKeys, type TravelExpenseFilters } from '@/lib/queryKeys';
import {
  getTravelExpenseReport,
  listTravelExpenseReports,
  getMyTravelExpenseReports,
  getPendingApprovalReports,
  createTravelExpenseReport,
  updateTravelExpenseReport,
  deleteTravelExpenseReport,
  addExpenseItem,
  updateExpenseItem,
  removeExpenseItem,
  updateExpenseItemReceipt,
} from '../travelExpenseService';
import type {
  TravelExpenseReport,
  CreateTravelExpenseInput,
  UpdateTravelExpenseInput,
  TravelExpenseItemInput,
  TravelExpenseFilters as ServiceFilters,
} from '@vapour/types';

// ============================================
// Query Hooks
// ============================================

/**
 * Hook to fetch a single travel expense report by ID
 */
export function useTravelExpenseReport(
  reportId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: reportId ? travelExpenseKeys.detail(reportId) : ['travelExpenses', 'null'],
    queryFn: () => (reportId ? getTravelExpenseReport(reportId) : null),
    enabled: (options?.enabled ?? true) && !!reportId,
    staleTime: options?.staleTime ?? 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch all travel expense reports with filters
 */
export function useTravelExpenseReports(
  filters?: TravelExpenseFilters,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  // Convert string dates to Date objects for the service
  const serviceFilters: ServiceFilters | undefined = filters
    ? {
        ...filters,
        tripStartDateFrom: filters.tripStartDateFrom
          ? new Date(filters.tripStartDateFrom)
          : undefined,
        tripStartDateTo: filters.tripStartDateTo ? new Date(filters.tripStartDateTo) : undefined,
      }
    : undefined;

  return useQuery({
    queryKey: travelExpenseKeys.list(filters),
    queryFn: () => listTravelExpenseReports(serviceFilters),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 30 * 1000,
  });
}

/**
 * Hook to fetch current user's travel expense reports
 */
export function useMyTravelExpenseReports(
  employeeId: string | null | undefined,
  filters?: Omit<TravelExpenseFilters, 'employeeId'>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const serviceFilters: Omit<ServiceFilters, 'employeeId'> | undefined = filters
    ? {
        ...filters,
        tripStartDateFrom: filters.tripStartDateFrom
          ? new Date(filters.tripStartDateFrom)
          : undefined,
        tripStartDateTo: filters.tripStartDateTo ? new Date(filters.tripStartDateTo) : undefined,
      }
    : undefined;

  return useQuery({
    queryKey: travelExpenseKeys.myReports(filters),
    queryFn: () => (employeeId ? getMyTravelExpenseReports(employeeId, serviceFilters) : []),
    enabled: (options?.enabled ?? true) && !!employeeId,
    staleTime: options?.staleTime ?? 30 * 1000,
  });
}

/**
 * Hook to fetch travel expense reports pending approval
 */
export function usePendingApprovalTravelExpenses(
  approverId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: travelExpenseKeys.pendingApproval(approverId ?? undefined),
    queryFn: () => (approverId ? getPendingApprovalReports(approverId) : []),
    enabled: (options?.enabled ?? true) && !!approverId,
    staleTime: options?.staleTime ?? 30 * 1000,
  });
}

// ============================================
// Mutation Hooks
// ============================================

interface CreateTravelExpenseParams {
  input: CreateTravelExpenseInput;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department?: string;
}

/**
 * Hook to create a new travel expense report
 */
export function useCreateTravelExpenseReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      employeeId,
      employeeName,
      employeeEmail,
      department,
    }: CreateTravelExpenseParams) =>
      createTravelExpenseReport(input, employeeId, employeeName, employeeEmail, department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.myReports() });
    },
  });
}

interface UpdateTravelExpenseParams {
  reportId: string;
  updates: UpdateTravelExpenseInput;
  userId: string;
}

/**
 * Hook to update a travel expense report
 */
export function useUpdateTravelExpenseReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, updates, userId }: UpdateTravelExpenseParams) =>
      updateTravelExpenseReport(reportId, updates, userId),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.lists() });
    },
  });
}

interface DeleteTravelExpenseParams {
  reportId: string;
  userId: string;
}

/**
 * Hook to delete a travel expense report
 */
export function useDeleteTravelExpenseReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, userId }: DeleteTravelExpenseParams) =>
      deleteTravelExpenseReport(reportId, userId),
    onSuccess: (_, { reportId }) => {
      queryClient.removeQueries({ queryKey: travelExpenseKeys.detail(reportId) });
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.lists() });
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.myReports() });
    },
  });
}

// ============================================
// Expense Item Mutation Hooks
// ============================================

interface AddExpenseItemParams {
  reportId: string;
  input: TravelExpenseItemInput;
  userId: string;
  receiptAttachmentId?: string;
  receiptFileName?: string;
  receiptUrl?: string;
}

/**
 * Hook to add an expense item to a report
 */
export function useAddExpenseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      input,
      userId,
      receiptAttachmentId,
      receiptFileName,
      receiptUrl,
    }: AddExpenseItemParams) =>
      addExpenseItem(reportId, input, userId, receiptAttachmentId, receiptFileName, receiptUrl),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
    },
  });
}

interface UpdateExpenseItemParams {
  reportId: string;
  itemId: string;
  updates: Partial<TravelExpenseItemInput>;
  userId: string;
}

/**
 * Hook to update an expense item
 */
export function useUpdateExpenseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, itemId, updates, userId }: UpdateExpenseItemParams) =>
      updateExpenseItem(reportId, itemId, updates, userId),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
    },
  });
}

interface RemoveExpenseItemParams {
  reportId: string;
  itemId: string;
  userId: string;
}

/**
 * Hook to remove an expense item from a report
 */
export function useRemoveExpenseItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reportId, itemId, userId }: RemoveExpenseItemParams) =>
      removeExpenseItem(reportId, itemId, userId),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
    },
  });
}

interface UpdateExpenseItemReceiptParams {
  reportId: string;
  itemId: string;
  receiptAttachmentId: string;
  receiptFileName: string;
  receiptUrl: string;
  userId: string;
}

/**
 * Hook to update receipt attachment for an expense item
 */
export function useUpdateExpenseItemReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reportId,
      itemId,
      receiptAttachmentId,
      receiptFileName,
      receiptUrl,
      userId,
    }: UpdateExpenseItemReceiptParams) =>
      updateExpenseItemReceipt(
        reportId,
        itemId,
        receiptAttachmentId,
        receiptFileName,
        receiptUrl,
        userId
      ),
    onSuccess: (_, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
    },
  });
}

// ============================================
// Optimistic Update Helpers
// ============================================

/**
 * Helper to optimistically update a report in the cache
 */
export function useOptimisticTravelExpenseUpdate() {
  const queryClient = useQueryClient();

  return {
    setOptimisticData: (
      reportId: string,
      updater: (old: TravelExpenseReport | null) => TravelExpenseReport | null
    ) => {
      queryClient.setQueryData<TravelExpenseReport | null>(
        travelExpenseKeys.detail(reportId),
        (old) => updater(old ?? null)
      );
    },
    revertOptimisticData: (reportId: string) => {
      queryClient.invalidateQueries({ queryKey: travelExpenseKeys.detail(reportId) });
    },
  };
}
