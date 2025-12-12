/**
 * React Query Hooks for Module Stats
 *
 * Provides cached and efficient data fetching for dashboard module statistics
 */

import { useQuery } from '@tanstack/react-query';
import {
  getAllModuleStats,
  getModuleStats,
  type ModuleStats,
} from '@/lib/dashboard/moduleStatsService';
import { moduleStatsKeys } from '@/lib/queryKeys';
import { createLogger } from '@vapour/utils';

const logger = createLogger('useModuleStats');

// Re-export for backwards compatibility
export { moduleStatsKeys };

/**
 * Hook to fetch stats for all accessible modules
 *
 * Features:
 * - Automatic caching for 5 minutes
 * - Background refetching when data becomes stale
 * - Automatic retry on failure
 * - Loading and error states
 *
 * @param accessibleModuleIds - Array of module IDs the user has access to
 * @param options - Additional query options
 */
export function useAllModuleStats(
  accessibleModuleIds: string[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: moduleStatsKeys.list(accessibleModuleIds),
    queryFn: async () => {
      logger.debug('Fetching module stats', { moduleIds: accessibleModuleIds });
      const stats = await getAllModuleStats(accessibleModuleIds);
      logger.info('Module stats fetched successfully', { count: stats.length });
      return stats;
    },
    enabled: options?.enabled ?? accessibleModuleIds.length > 0,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch stats for a single module
 *
 * @param moduleId - Module ID to fetch stats for
 * @param options - Additional query options
 */
export function useModuleStats(
  moduleId: string | null,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: moduleId ? moduleStatsKeys.detail(moduleId) : ['moduleStats', 'null'],
    queryFn: async () => {
      if (!moduleId) return null;
      logger.debug('Fetching single module stats', { moduleId });
      const stats = await getModuleStats(moduleId);
      logger.info('Single module stats fetched', { moduleId, stats });
      return stats;
    },
    enabled: options?.enabled ?? !!moduleId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Helper to get stats for a specific module from cached data
 *
 * @param moduleStats - Array of all module stats from useAllModuleStats
 * @param moduleId - Module ID to find
 */
export function getStatsForModule(
  moduleStats: ModuleStats[] | undefined,
  moduleId: string
): ModuleStats | undefined {
  return moduleStats?.find((s) => s.moduleId === moduleId);
}
