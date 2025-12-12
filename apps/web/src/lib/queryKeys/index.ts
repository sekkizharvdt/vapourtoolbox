/**
 * Query Keys - Central Registry
 *
 * Centralized query key factories for React Query.
 * Import from this module to ensure consistent cache key usage across the application.
 *
 * @example
 * ```typescript
 * import { entityKeys, purchaseRequestKeys } from '@/lib/queryKeys';
 *
 * // In a query hook:
 * useQuery({
 *   queryKey: entityKeys.detail('entity-123'),
 *   queryFn: () => getEntity('entity-123'),
 * });
 *
 * // For cache invalidation:
 * queryClient.invalidateQueries({ queryKey: entityKeys.lists() });
 * ```
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

// Dashboard-related query keys
export { moduleStatsKeys, activityKeys, notificationKeys } from './dashboard';

// Entity-related query keys
export { entityKeys, userKeys, companyKeys, type EntityFilters } from './entities';

// Procurement-related query keys
export {
  purchaseRequestKeys,
  rfqKeys,
  purchaseOrderKeys,
  offerKeys,
  goodsReceiptKeys,
  threeWayMatchKeys,
  type ProcurementFilters,
} from './procurement';
