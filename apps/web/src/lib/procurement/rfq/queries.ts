/**
 * RFQ Query Operations
 *
 * Query and list operations for RFQs
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { RFQ } from '@vapour/types';
import type { ListRFQsFilters } from './types';

/**
 * List RFQs with optional filters
 */
export async function listRFQs(filters: ListRFQsFilters = {}): Promise<RFQ[]> {
  const { db } = getFirebase();

  const constraints: QueryConstraint[] = [];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }

  if (filters.projectId) {
    constraints.push(where('projectIds', 'array-contains', filters.projectId));
  }

  if (filters.vendorId) {
    constraints.push(where('vendorIds', 'array-contains', filters.vendorId));
  }

  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  if (filters.limit) {
    constraints.push(limit(filters.limit));
  }

  const q = query(collection(db, COLLECTIONS.RFQS), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RFQ[];
}
