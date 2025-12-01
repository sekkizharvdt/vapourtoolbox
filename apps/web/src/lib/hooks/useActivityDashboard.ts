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

/**
 * Query keys for activity dashboard
 */
export const activityKeys = {
  all: ['activity'] as const,
  actionItems: (userId: string) => [...activityKeys.all, 'actionItems', userId] as const,
  summary: (userId: string) => [...activityKeys.all, 'summary', userId] as const,
  recentActivity: (userId: string) => [...activityKeys.all, 'recent', userId] as const,
};

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
    refetch: () => {
      actionItems.refetch();
      summary.refetch();
      recentActivity.refetch();
    },
  };
}

export type { ActionItem, DashboardSummary, ActivityItem };
