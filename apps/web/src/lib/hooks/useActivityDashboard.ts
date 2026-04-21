/**
 * Activity Dashboard Hook
 *
 * React Query hook for fetching user-specific dashboard data
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActionItems,
  getDashboardSummary,
  getRecentActivity,
  type ActionItem,
  type DashboardSummary,
  type ActivityItem,
} from '@/lib/dashboard/activityService';
import { activityKeys } from '@/lib/queryKeys';

// Re-export for backwards compatibility
export { activityKeys };

/**
 * Hook to fetch action items for "Today's Focus"
 */
export function useActionItems() {
  const { user } = useAuth();
  const userId = user?.uid;

  return useQuery({
    queryKey: activityKeys.actionItems(userId || ''),
    queryFn: () => getActionItems(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch dashboard summary counts
 */
export function useDashboardSummary() {
  const { user } = useAuth();
  const userId = user?.uid;

  return useQuery({
    queryKey: activityKeys.summary(userId || ''),
    queryFn: () => getDashboardSummary(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch recent activity
 */
export function useRecentActivity(limit = 10) {
  const { user } = useAuth();
  const userId = user?.uid;

  return useQuery({
    queryKey: activityKeys.recentActivity(userId || ''),
    queryFn: () => getRecentActivity(userId!, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Combined hook for all dashboard data
 */
export function useActivityDashboard() {
  const actionItems = useActionItems();
  const summary = useDashboardSummary();
  const recentActivity = useRecentActivity();

  // Most recent successful fetch across the two primary queries — used by
  // the dashboard's "Updated X ago" timestamp next to the refresh button.
  const lastUpdated = Math.max(actionItems.dataUpdatedAt, summary.dataUpdatedAt) || null;

  return {
    actionItems: {
      data: actionItems.data || [],
      isLoading: actionItems.isLoading,
      error: actionItems.error,
    },
    summary: {
      data: summary.data,
      isLoading: summary.isLoading,
      error: summary.error,
    },
    recentActivity: {
      data: recentActivity.data || [],
      isLoading: recentActivity.isLoading,
      error: recentActivity.error,
    },
    isLoading: actionItems.isLoading || summary.isLoading,
    /** Epoch ms of the most recent successful fetch, or null if never fetched. */
    lastUpdated,
    /** Refetch every dashboard query in one call. */
    refetch: () => {
      actionItems.refetch();
      summary.refetch();
      recentActivity.refetch();
    },
  };
}

export type { ActionItem, DashboardSummary, ActivityItem };
