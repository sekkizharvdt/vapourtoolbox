/**
 * Offer Query Functions
 *
 * Query operations for retrieving offers
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { Offer } from '@vapour/types';
import type { ListOffersFilters } from './types';

/**
 * Get all offers for an RFQ
 */
export async function getOffersByRFQ(rfqId: string): Promise<Offer[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.OFFERS),
    where('rfqId', '==', rfqId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}

/**
 * List offers with optional filters
 */
export async function listOffers(filters: ListOffersFilters = {}): Promise<Offer[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.rfqId) {
    constraints.push(where('rfqId', '==', filters.rfqId));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorId', '==', filters.vendorId));
  }

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.isRecommended !== undefined) {
    constraints.push(where('isRecommended', '==', filters.isRecommended));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.OFFERS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Offer[];
}
