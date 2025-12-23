'use client';

/**
 * React Query Hooks for Business Entities
 *
 * Provides cached and efficient data fetching for business entities (vendors, customers, etc.)
 * Uses centralized query keys for consistent cache management.
 */

import { useQuery } from '@tanstack/react-query';
import { useFirestore } from '@/lib/firebase/hooks';
import {
  queryEntities,
  getEntityById,
  getActiveEntitiesByRole,
  getVendors,
  getCustomers,
  searchEntities,
  type EntityQueryOptions,
} from '../businessEntityService';
import { entityKeys, type EntityFilters } from '@/lib/queryKeys';
import { createLogger } from '@vapour/logger';
import type { EntityRole } from '@vapour/types';

const logger = createLogger({ context: 'useEntities' });

/**
 * Hook to fetch entities with filtering options
 *
 * Features:
 * - Automatic caching for 5 minutes
 * - Background refetching when data becomes stale
 * - Automatic retry on failure
 * - Loading and error states
 *
 * @param options - Entity query options for filtering
 * @param queryOptions - Additional React Query options
 */
export function useEntities(
  options?: EntityQueryOptions,
  queryOptions?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  const filters: EntityFilters = {
    status: options?.status,
    role: options?.role,
    isActive: options?.isActive,
  };

  return useQuery({
    queryKey: entityKeys.list(filters),
    queryFn: async () => {
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      logger.debug('Fetching entities', { options });
      const result = await queryEntities(db, options);
      logger.info('Entities fetched successfully', { count: result.items.length });
      return result.items;
    },
    enabled: (queryOptions?.enabled ?? true) && !!db,
    staleTime: queryOptions?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single entity by ID
 *
 * @param entityId - Entity ID to fetch
 * @param options - Additional query options
 */
export function useEntity(
  entityId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: entityId ? entityKeys.detail(entityId) : ['entities', 'null'],
    queryFn: async () => {
      if (!db || !entityId) {
        return null;
      }
      logger.debug('Fetching entity', { entityId });
      const entity = await getEntityById(db, entityId);
      logger.info('Entity fetched', { entityId, found: !!entity });
      return entity;
    },
    enabled: (options?.enabled ?? true) && !!db && !!entityId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch active entities by role (for dropdowns/selectors)
 *
 * @param role - Entity role to filter by
 * @param options - Additional query options
 */
export function useActiveEntitiesByRole(
  role: EntityRole,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: entityKeys.byRole(role),
    queryFn: async () => {
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      logger.debug('Fetching active entities by role', { role });
      const entities = await getActiveEntitiesByRole(db, role);
      logger.info('Active entities fetched', { role, count: entities.length });
      return entities;
    },
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch vendors (convenience wrapper)
 *
 * @param activeOnly - Whether to fetch only active vendors (default: true)
 * @param options - Additional query options
 */
export function useVendors(
  activeOnly = true,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: entityKeys.vendors(activeOnly),
    queryFn: async () => {
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      logger.debug('Fetching vendors', { activeOnly });
      const vendors = await getVendors(db, activeOnly);
      logger.info('Vendors fetched', { count: vendors.length, activeOnly });
      return vendors;
    },
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch customers (convenience wrapper)
 *
 * @param activeOnly - Whether to fetch only active customers (default: true)
 * @param options - Additional query options
 */
export function useCustomers(
  activeOnly = true,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: entityKeys.customers(activeOnly),
    queryFn: async () => {
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      logger.debug('Fetching customers', { activeOnly });
      const customers = await getCustomers(db, activeOnly);
      logger.info('Customers fetched', { count: customers.length, activeOnly });
      return customers;
    },
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to search entities by name or code
 *
 * @param searchTerm - Search term to filter entities
 * @param options - Entity query options for additional filtering
 * @param queryOptions - Additional React Query options
 */
export function useSearchEntities(
  searchTerm: string,
  options?: EntityQueryOptions,
  queryOptions?: {
    enabled?: boolean;
    staleTime?: number;
    minSearchLength?: number;
  }
) {
  const db = useFirestore();
  const minSearchLength = queryOptions?.minSearchLength ?? 2;
  const isSearchValid = searchTerm.length >= minSearchLength;

  return useQuery({
    queryKey: entityKeys.search(searchTerm),
    queryFn: async () => {
      if (!db) {
        throw new Error('Firestore not initialized');
      }
      logger.debug('Searching entities', { searchTerm, options });
      const entities = await searchEntities(db, searchTerm, options);
      logger.info('Entity search completed', { searchTerm, count: entities.length });
      return entities;
    },
    enabled: (queryOptions?.enabled ?? true) && !!db && isSearchValid,
    staleTime: queryOptions?.staleTime ?? 2 * 60 * 1000, // 2 minutes for search results
  });
}
