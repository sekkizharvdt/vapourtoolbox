/**
 * Offer Workflow Functions
 *
 * Functions for managing offer lifecycle (select, reject, withdraw)
 */

import { doc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { getOfferById } from './crud';
import { getOffersByRFQ } from './queries';

const logger = createLogger({ context: 'offerService' });

/**
 * Select winning offer (changes status to SELECTED)
 */
export async function selectOffer(
  offerId: string,
  userId: string,
  completionNotes?: string
): Promise<void> {
  const { db } = getFirebase();

  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new Error('Offer not found');
  }

  // Mark other offers as rejected
  const allOffers = await getOffersByRFQ(offer.rfqId);
  const batch = writeBatch(db);

  allOffers.forEach((other) => {
    if (other.id === offerId) {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'SELECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    } else if (other.status !== 'WITHDRAWN' && other.status !== 'REJECTED') {
      batch.update(doc(db, COLLECTIONS.OFFERS, other.id), {
        status: 'REJECTED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    }
  });

  // Complete the RFQ with the selected offer
  batch.update(doc(db, COLLECTIONS.RFQS, offer.rfqId), {
    status: 'COMPLETED',
    selectedOfferId: offerId,
    completionNotes: completionNotes || `Offer ${offer.number} selected from ${offer.vendorName}`,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  await batch.commit();

  logger.info('Offer selected and RFQ completed', { offerId, rfqId: offer.rfqId });
}

/**
 * Reject an offer
 */
export async function rejectOffer(offerId: string, reason: string, _userId: string): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'REJECTED',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
  });

  logger.info('Offer rejected', { offerId });
}

/**
 * Withdraw an offer
 */
export async function withdrawOffer(
  offerId: string,
  reason: string,
  _userId: string
): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.OFFERS, offerId), {
    status: 'WITHDRAWN',
    evaluationNotes: reason,
    updatedAt: Timestamp.now(),
  });

  logger.info('Offer withdrawn', { offerId });
}
