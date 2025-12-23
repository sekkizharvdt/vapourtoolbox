/**
 * RFQ Query Operations
 *
 * Query and list operations for RFQs
 *
 * **Required Firestore Composite Indexes:**
 * - rfqs: (status ASC, createdAt DESC)
 * - rfqs: (projectIds ARRAY_CONTAINS, createdAt DESC)
 * - rfqs: (vendorIds ARRAY_CONTAINS, createdAt DESC)
 * - rfqs: (createdBy ASC, createdAt DESC)
 * - rfqs: (status ASC, projectIds ARRAY_CONTAINS, createdAt DESC)
 */

import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { RFQ } from '@vapour/types';
import type { ListRFQsFilters, PaginatedRFQsResult } from './types';

const logger = createLogger({ context: 'rfq/queries' });

/** Default page size for pagination */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Find RFQs that were created from a specific Purchase Request
 *
 * Useful for tracing PR -> RFQ conversion and debugging visibility issues.
 * Since RFQs store purchaseRequestIds as an array, this uses array-contains.
 */
export async function findRFQsByPurchaseRequestId(prId: string): Promise<RFQ[]> {
  const { db } = getFirebase();

  const q = query(
    collection(db, COLLECTIONS.RFQS),
    where('purchaseRequestIds', 'array-contains', prId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  const rfqs: RFQ[] = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RFQ[];

  logger.info('Found RFQs for PR', { prId, count: rfqs.length });

  return rfqs;
}
/** Maximum allowed page size */
const MAX_PAGE_SIZE = 100;

/**
 * List RFQs with optional filters and cursor-based pagination
 *
 * @param filters - Optional filters including pagination cursor
 * @returns Paginated result with items, cursor for next page, and hasMore flag
 */
export async function listRFQs(filters: ListRFQsFilters = {}): Promise<PaginatedRFQsResult> {
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

  // Handle cursor-based pagination
  if (filters.afterId) {
    const cursorDoc = await getDoc(doc(db, COLLECTIONS.RFQS, filters.afterId));
    if (cursorDoc.exists()) {
      constraints.push(startAfter(cursorDoc));
    } else {
      logger.warn('Pagination cursor document not found', { afterId: filters.afterId });
    }
  }

  // Apply limit (fetch one extra to determine hasMore)
  const pageSize = Math.min(filters.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  constraints.push(limit(pageSize + 1));

  const q = query(collection(db, COLLECTIONS.RFQS), ...constraints);
  const snapshot = await getDocs(q);

  const rfqs: RFQ[] = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RFQ[];

  // Check if there are more results
  const hasMore = rfqs.length > pageSize;
  if (hasMore) {
    rfqs.pop(); // Remove the extra item used for hasMore check
  }

  return {
    items: rfqs,
    lastDocId: rfqs.length > 0 ? (rfqs[rfqs.length - 1]?.id ?? null) : null,
    hasMore,
  };
}
