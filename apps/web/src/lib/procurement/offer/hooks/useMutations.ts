'use client';

/**
 * React Query Mutation Hooks for Offers
 *
 * Provides mutation hooks with automatic cache invalidation for offer operations.
 * Uses centralized query keys for consistent cache management.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOffer, updateOffer } from '../crud';
import { selectOffer, rejectOffer, withdrawOffer } from '../workflow';
import { evaluateOffer, markOfferAsRecommended } from '../evaluation';
import { offerKeys, rfqKeys } from '@/lib/queryKeys';
import { createLogger } from '@vapour/utils';
import type {
  CreateOfferInput,
  CreateOfferItemInput,
  UpdateOfferInput,
  EvaluateOfferInput,
} from '../types';

const logger = createLogger('useOfferMutations');

/**
 * Hook to create a new offer
 *
 * Features:
 * - Automatic cache invalidation for offer lists
 * - Error handling with detailed logging
 * - Optimistic updates support
 */
export function useCreateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      items,
      userId,
      userName,
    }: {
      input: CreateOfferInput;
      items: CreateOfferItemInput[];
      userId: string;
      userName: string;
    }) => {
      logger.debug('Creating offer', { rfqId: input.rfqId, vendorId: input.vendorId });
      const offerId = await createOffer(input, items, userId, userName);
      logger.info('Offer created', { offerId });
      return offerId;
    },
    onSuccess: (_, variables) => {
      // Invalidate offer lists and RFQ-specific offers
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      if (variables.input.rfqId) {
        queryClient.invalidateQueries({ queryKey: offerKeys.byRfq(variables.input.rfqId) });
        queryClient.invalidateQueries({ queryKey: rfqKeys.offers(variables.input.rfqId) });
        // RFQ may need refresh due to offersReceived count
        queryClient.invalidateQueries({ queryKey: rfqKeys.detail(variables.input.rfqId) });
      }
    },
    onError: (error) => {
      logger.error('Failed to create offer', { error });
    },
  });
}

/**
 * Hook to update an offer
 */
export function useUpdateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      input,
      userId,
    }: {
      offerId: string;
      input: UpdateOfferInput;
      userId: string;
    }) => {
      logger.debug('Updating offer', { offerId });
      await updateOffer(offerId, input, userId);
      logger.info('Offer updated', { offerId });
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific offer and lists
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
    onError: (error) => {
      logger.error('Failed to update offer', { error });
    },
  });
}

/**
 * Hook to evaluate an offer
 */
export function useEvaluateOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      input,
      userId,
      userName,
    }: {
      offerId: string;
      input: EvaluateOfferInput;
      userId: string;
      userName: string;
    }) => {
      logger.debug('Evaluating offer', { offerId });
      await evaluateOffer(offerId, input, userId, userName);
      logger.info('Offer evaluated', { offerId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
    },
    onError: (error) => {
      logger.error('Failed to evaluate offer', { error });
    },
  });
}

/**
 * Hook to mark an offer as recommended
 */
export function useRecommendOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      reason,
      userId,
      rfqId,
    }: {
      offerId: string;
      reason: string;
      userId: string;
      rfqId?: string;
    }) => {
      logger.debug('Marking offer as recommended', { offerId });
      await markOfferAsRecommended(offerId, reason, userId);
      logger.info('Offer marked as recommended', { offerId });
      return { offerId, rfqId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(result.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      if (result.rfqId) {
        queryClient.invalidateQueries({ queryKey: offerKeys.byRfq(result.rfqId) });
      }
    },
    onError: (error) => {
      logger.error('Failed to recommend offer', { error });
    },
  });
}

/**
 * Hook to select a winning offer
 *
 * This also marks all other offers as rejected and completes the RFQ
 */
export function useSelectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      userId,
      rfqId,
      completionNotes,
    }: {
      offerId: string;
      userId: string;
      rfqId?: string;
      completionNotes?: string;
    }) => {
      logger.debug('Selecting offer', { offerId });
      await selectOffer(offerId, userId, completionNotes);
      logger.info('Offer selected', { offerId });
      return { offerId, rfqId };
    },
    onSuccess: (result) => {
      // Invalidate all offers (status changes for multiple)
      queryClient.invalidateQueries({ queryKey: offerKeys.all });
      if (result.rfqId) {
        // RFQ status changed to COMPLETED
        queryClient.invalidateQueries({ queryKey: rfqKeys.detail(result.rfqId) });
        queryClient.invalidateQueries({ queryKey: rfqKeys.lists() });
      }
    },
    onError: (error) => {
      logger.error('Failed to select offer', { error });
    },
  });
}

/**
 * Hook to reject an offer
 */
export function useRejectOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      reason,
      userId,
      rfqId,
    }: {
      offerId: string;
      reason: string;
      userId: string;
      rfqId?: string;
    }) => {
      logger.debug('Rejecting offer', { offerId });
      await rejectOffer(offerId, reason, userId);
      logger.info('Offer rejected', { offerId });
      return { offerId, rfqId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(result.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      if (result.rfqId) {
        queryClient.invalidateQueries({ queryKey: offerKeys.byRfq(result.rfqId) });
      }
    },
    onError: (error) => {
      logger.error('Failed to reject offer', { error });
    },
  });
}

/**
 * Hook to withdraw an offer
 */
export function useWithdrawOffer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      reason,
      userId,
      rfqId,
    }: {
      offerId: string;
      reason: string;
      userId: string;
      rfqId?: string;
    }) => {
      logger.debug('Withdrawing offer', { offerId });
      await withdrawOffer(offerId, reason, userId);
      logger.info('Offer withdrawn', { offerId });
      return { offerId, rfqId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(result.offerId) });
      queryClient.invalidateQueries({ queryKey: offerKeys.lists() });
      if (result.rfqId) {
        queryClient.invalidateQueries({ queryKey: offerKeys.byRfq(result.rfqId) });
      }
    },
    onError: (error) => {
      logger.error('Failed to withdraw offer', { error });
    },
  });
}
