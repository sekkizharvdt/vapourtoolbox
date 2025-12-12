/**
 * Dashboard Query Keys
 *
 * Centralized query key factories for dashboard-related queries.
 * Follows TanStack Query best practices for query key management.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

/**
 * Module Stats query keys
 *
 * Used for caching dashboard module statistics
 */
export const moduleStatsKeys = {
  all: ['moduleStats'] as const,
  lists: () => [...moduleStatsKeys.all, 'list'] as const,
  list: (moduleIds: string[]) => [...moduleStatsKeys.lists(), moduleIds] as const,
  details: () => [...moduleStatsKeys.all, 'detail'] as const,
  detail: (moduleId: string) => [...moduleStatsKeys.details(), moduleId] as const,
};

/**
 * Activity Dashboard query keys
 *
 * Used for caching user-specific activity data
 */
export const activityKeys = {
  all: ['activity'] as const,
  actionItems: (userId: string) => [...activityKeys.all, 'actionItems', userId] as const,
  summary: (userId: string) => [...activityKeys.all, 'summary', userId] as const,
  recentActivity: (userId: string) => [...activityKeys.all, 'recent', userId] as const,
};

/**
 * Notifications query keys
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (userId: string) => [...notificationKeys.lists(), userId] as const,
  unreadCount: (userId: string) => [...notificationKeys.all, 'unread', userId] as const,
};
