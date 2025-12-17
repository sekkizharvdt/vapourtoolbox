/**
 * Offer Evaluation Functions
 *
 * Functions for evaluating and comparing vendor offers
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { RFQ, RFQItem, OfferComparisonData } from '@vapour/types';
import type { EvaluateOfferInput } from './types';
import { getOfferById, getOfferItemsBatch } from './crud';
import { getOffersByRFQ } from './queries';
import { incrementOffersEvaluated } from '../rfq';

const logger = createLogger({ context: 'offerService' });

/**
 * Evaluate an offer
 */
export async function evaluateOffer(
  offerId: string,
  input: EvaluateOfferInput,
  userId: string,
  userName: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  const updateData: Record<string, unknown> = {
    status: 'EVALUATED',
    evaluationScore: input.evaluationScore,
    evaluationNotes: input.evaluationNotes,
    isRecommended: input.isRecommended || false,
    recommendationReason: input.recommendationReason,
    redFlags: input.redFlags || [],
    evaluatedBy: userId,
    evaluatedByName: userName,
    evaluatedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), updateData);

  // Update RFQ offers evaluated count
  try {
    await incrementOffersEvaluated(offer.rfqId);
  } catch (err) {
    logger.error('Failed to increment RFQ evaluations count', { rfqId: offer.rfqId, error: err });
    // Don't fail offer evaluation if counter update fails
  }

  logger.info('Offer evaluated', { offerId });
}

/**
 * Mark offer as recommended
 */
export async function markOfferAsRecommended(
  offerId: string,
  reason: string,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Unmark other offers for this RFQ
  const otherOffers = await getOffersByRFQ(offer.rfqId);
  const batch = writeBatch(db);

  otherOffers.forEach((other) => {
    if (other.id !== offerId && other.isRecommended) {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        isRecommended: false,
        updatedAt: Timestamp.now(),
      });
    }
  });

  // Mark this offer as recommended
  batch.update(doc(db, COLLECTIONS.OFFERS, offerId), {
    isRecommended: true,
    recommendationReason: reason,
    updatedAt: Timestamp.now(),
  });

  await batch.commit();

  logger.info('Offer marked as recommended', { offerId });
}

/**
 * Get offer comparison data for an RFQ
 */
export async function getOfferComparison(rfqId: string): Promise<OfferComparisonData> {
  const { db } = getFirebase();

  // Get RFQ and all its offers
  const [rfq, offers] = await Promise.all([
    (async () => {
      const rfqDoc = await getDoc(doc(db, COLLECTIONS.RFQS, rfqId));
      return rfqDoc.exists() ? ({ id: rfqDoc.id, ...rfqDoc.data() } as RFQ) : null;
    })(),
    getOffersByRFQ(rfqId),
  ]);

  if (!rfq) {
    throw new Error('RFQ not found');
  }

  // Get all offer items in a single batch query (avoid N+1 queries)
  const offerIds = offers.map((o) => o.id);
  const offerItemsMap = await getOfferItemsBatch(offerIds);

  const offersWithItems = offers.map((offer) => ({
    offer,
    items: offerItemsMap.get(offer.id) || [],
  }));

  // Get RFQ items
  const rfqItemsQuery = query(
    collection(db, COLLECTIONS.RFQ_ITEMS),
    where('rfqId', '==', rfqId),
    orderBy('lineNumber', 'asc')
  );
  const rfqItemsSnapshot = await getDocs(rfqItemsQuery);
  const rfqItems = rfqItemsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RFQItem[];

  // Build comparison matrix
  const itemComparisons = rfqItems.map((rfqItem) => {
    const itemOffers = offersWithItems.map(({ offer, items }) => {
      const matchingItem = items.find((item) => item.rfqItemId === rfqItem.id);

      return {
        offerId: offer.id,
        vendorName: offer.vendorName,
        unitPrice: matchingItem?.unitPrice || 0,
        totalPrice: matchingItem?.amount || 0,
        deliveryPeriod: matchingItem?.deliveryPeriod,
        meetsSpec: matchingItem?.meetsSpec || false,
        deviations: matchingItem?.deviations,
        makeModel: matchingItem?.makeModel,
      };
    });

    // Find lowest price
    const validPrices = itemOffers.filter((o) => o.unitPrice > 0).map((o) => o.unitPrice);
    const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

    return {
      rfqItemId: rfqItem.id,
      description: rfqItem.description,
      quantity: rfqItem.quantity,
      unit: rfqItem.unit,
      offers: itemOffers,
      lowestPrice,
    };
  });

  // Calculate totals and stats
  const offerStats = offers.map((offer) => {
    const itemsForOffer = offersWithItems.find((o) => o.offer.id === offer.id)?.items || [];

    const meetsAllSpecs = itemsForOffer.every((item) => item.meetsSpec);
    const hasDeviations = itemsForOffer.some((item) => item.deviations);

    return {
      offerId: offer.id,
      vendorName: offer.vendorName,
      totalAmount: offer.totalAmount,
      meetsAllSpecs,
      hasDeviations,
      isRecommended: offer.isRecommended,
      evaluationScore: offer.evaluationScore,
      redFlags: offer.redFlags,
    };
  });

  // Find lowest total
  const lowestTotal = offerStats.length > 0 ? Math.min(...offerStats.map((s) => s.totalAmount)) : 0;

  return {
    rfq,
    offers,
    itemComparisons,
    offerStats,
    lowestTotal,
  };
}
