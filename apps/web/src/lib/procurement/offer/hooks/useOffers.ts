'use client';

/**
 * React Query Hooks for Offers
 *
 * Provides cached and efficient data fetching for vendor offers/quotes.
 * Uses centralized query keys for consistent cache management.
 */

import { useQuery } from '@tanstack/react-query';
import { getOfferById, getOfferItems } from '../crud';
import { getOffersByRFQ, listOffers } from '../queries';
import { offerKeys } from '@/lib/queryKeys';
import { createLogger } from '@vapour/utils';
import type { ListOffersFilters } from '../types';

const logger = createLogger('useOffers');

/**
 * Hook to fetch offers with optional filters
 *
 * Features:
 * - Automatic caching for 5 minutes
 * - Background refetching when data becomes stale
 * - Automatic retry on failure
 * - Loading and error states
 *
 * @param filters - Filter options for offers
 * @param options - Additional React Query options
 */
export function useOffers(
  filters?: ListOffersFilters,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: offerKeys.list(filters),
    queryFn: async () => {
      logger.debug('Fetching offers', { filters });
      const offers = await listOffers(filters);
      logger.info('Offers fetched successfully', { count: offers.length });
      return offers;
    },
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single offer by ID
 *
 * @param offerId - Offer ID to fetch
 * @param options - Additional query options
 */
export function useOffer(
  offerId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: offerId ? offerKeys.detail(offerId) : ['offers', 'null'],
    queryFn: async () => {
      if (!offerId) {
        return null;
      }
      logger.debug('Fetching offer', { offerId });
      const offer = await getOfferById(offerId);
      logger.info('Offer fetched', { offerId, found: !!offer });
      return offer;
    },
    enabled: (options?.enabled ?? true) && !!offerId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch offer items
 *
 * @param offerId - Offer ID to fetch items for
 * @param options - Additional query options
 */
export function useOfferItems(
  offerId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: offerId ? offerKeys.items(offerId) : ['offers', 'items', 'null'],
    queryFn: async () => {
      if (!offerId) {
        return [];
      }
      logger.debug('Fetching offer items', { offerId });
      const items = await getOfferItems(offerId);
      logger.info('Offer items fetched', { offerId, count: items.length });
      return items;
    },
    enabled: (options?.enabled ?? true) && !!offerId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch offers by RFQ ID
 *
 * @param rfqId - RFQ ID to fetch offers for
 * @param options - Additional query options
 */
export function useOffersByRFQ(
  rfqId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: rfqId ? offerKeys.byRfq(rfqId) : ['offers', 'byRfq', 'null'],
    queryFn: async () => {
      if (!rfqId) {
        return [];
      }
      logger.debug('Fetching offers by RFQ', { rfqId });
      const offers = await getOffersByRFQ(rfqId);
      logger.info('Offers by RFQ fetched', { rfqId, count: offers.length });
      return offers;
    },
    enabled: (options?.enabled ?? true) && !!rfqId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
  });
}
