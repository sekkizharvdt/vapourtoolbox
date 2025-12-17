/**
 * Materialized Aggregations
 *
 * Provides utilities for maintaining pre-computed aggregate values
 * to avoid expensive real-time calculations.
 *
 * Strategy:
 * - Store aggregate values in dedicated counter documents
 * - Update counters atomically during writes using increment()
 * - Read counters instead of querying and counting
 *
 * Use cases:
 * - Dashboard statistics (PO counts, total values)
 * - Status counts (pending approvals, overdue items)
 * - Entity metrics (vendor spend, project costs)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'materializedAggregations' });

/**
 * Collection name for storing aggregation documents
 */
export const AGGREGATIONS_COLLECTION = 'aggregations';

/**
 * Types of supported aggregations
 */
export type AggregationType = 'count' | 'sum' | 'min' | 'max' | 'avg';

/**
 * Aggregation document structure
 */
export interface AggregationDocument {
  /** Unique key identifying this aggregation */
  key: string;
  /** Type of aggregation */
  type: AggregationType;
  /** Current aggregated value */
  value: number;
  /** Count of items (for calculating averages) */
  itemCount: number;
  /** Last update timestamp */
  updatedAt: typeof Timestamp.prototype;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Generate a unique key for an aggregation
 *
 * @param entity - Entity type (e.g., 'purchaseOrders', 'projects')
 * @param field - Field being aggregated (e.g., 'status', 'totalAmount')
 * @param scope - Optional scope (e.g., projectId, fiscalYear)
 */
export function aggregationKey(
  entity: string,
  field: string,
  scope?: string | Record<string, string>
): string {
  const scopePart =
    typeof scope === 'string'
      ? scope
      : scope
        ? Object.entries(scope)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join('/')
        : 'global';

  return `${entity}/${field}/${scopePart}`;
}

/**
 * Get an aggregation value
 *
 * @param db - Firestore instance
 * @param key - Aggregation key
 * @returns The current aggregated value, or 0 if not found
 */
export async function getAggregation(db: Firestore, key: string): Promise<number> {
  const docRef = doc(db, AGGREGATIONS_COLLECTION, encodeKey(key));
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return 0;
  }

  return docSnap.data()?.value ?? 0;
}

/**
 * Get multiple aggregations at once
 *
 * @param db - Firestore instance
 * @param keys - Array of aggregation keys
 * @returns Map of key to value
 */
export async function getAggregations(db: Firestore, keys: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Fetch in parallel
  const promises = keys.map(async (key) => {
    const value = await getAggregation(db, key);
    return { key, value };
  });

  const values = await Promise.all(promises);

  for (const { key, value } of values) {
    results.set(key, value);
  }

  return results;
}

/**
 * Increment a counter aggregation
 *
 * @param db - Firestore instance
 * @param key - Aggregation key
 * @param amount - Amount to increment (default: 1, can be negative)
 */
export async function incrementCounter(
  db: Firestore,
  key: string,
  amount: number = 1
): Promise<void> {
  const docRef = doc(db, AGGREGATIONS_COLLECTION, encodeKey(key));

  try {
    await updateDoc(docRef, {
      value: increment(amount),
      itemCount: increment(amount > 0 ? 1 : -1),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    // Document might not exist, create it
    if (isNotFoundError(error)) {
      await setDoc(docRef, {
        key,
        type: 'count',
        value: amount,
        itemCount: amount > 0 ? 1 : 0,
        updatedAt: Timestamp.now(),
      });
    } else {
      throw error;
    }
  }

  logger.debug('Counter incremented', { key, amount });
}

/**
 * Update a sum aggregation
 *
 * @param db - Firestore instance
 * @param key - Aggregation key
 * @param delta - Amount to add (can be negative)
 */
export async function updateSum(db: Firestore, key: string, delta: number): Promise<void> {
  const docRef = doc(db, AGGREGATIONS_COLLECTION, encodeKey(key));

  try {
    await updateDoc(docRef, {
      value: increment(delta),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    // Document might not exist, create it
    if (isNotFoundError(error)) {
      await setDoc(docRef, {
        key,
        type: 'sum',
        value: delta,
        itemCount: 1,
        updatedAt: Timestamp.now(),
      });
    } else {
      throw error;
    }
  }

  logger.debug('Sum updated', { key, delta });
}

/**
 * Set an aggregation value directly (for initialization or recomputation)
 *
 * @param db - Firestore instance
 * @param key - Aggregation key
 * @param value - New value
 * @param type - Aggregation type
 * @param itemCount - Optional item count
 */
export async function setAggregation(
  db: Firestore,
  key: string,
  value: number,
  type: AggregationType = 'count',
  itemCount?: number
): Promise<void> {
  const docRef = doc(db, AGGREGATIONS_COLLECTION, encodeKey(key));

  await setDoc(docRef, {
    key,
    type,
    value,
    itemCount: itemCount ?? (type === 'count' ? value : 1),
    updatedAt: Timestamp.now(),
  });

  logger.debug('Aggregation set', { key, value, type });
}

/**
 * Update status counters when entity status changes
 *
 * @param db - Firestore instance
 * @param entity - Entity type
 * @param oldStatus - Previous status (null for new entities)
 * @param newStatus - New status
 * @param scope - Optional scope for the counter
 */
export async function updateStatusCounter(
  db: Firestore,
  entity: string,
  oldStatus: string | null,
  newStatus: string,
  scope?: string | Record<string, string>
): Promise<void> {
  const updates: Promise<void>[] = [];

  // Decrement old status counter
  if (oldStatus && oldStatus !== newStatus) {
    const oldKey = aggregationKey(entity, `status:${oldStatus}`, scope);
    updates.push(incrementCounter(db, oldKey, -1));
  }

  // Increment new status counter
  const newKey = aggregationKey(entity, `status:${newStatus}`, scope);
  updates.push(incrementCounter(db, newKey, 1));

  await Promise.all(updates);
}

/**
 * Helper to encode key for use as document ID
 * Firestore document IDs cannot contain '/'
 */
function encodeKey(key: string): string {
  return key.replace(/\//g, '__');
}

/**
 * Check if error is a "not found" error
 */
function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('No document to update') || error.message.includes('NOT_FOUND'))
  );
}

// ============================================================================
// Pre-defined Aggregation Keys
// ============================================================================

/**
 * Common aggregation key factories for the application
 */
export const AggregationKeys = {
  // Purchase Orders
  poCountByStatus: (status: string, projectId?: string) =>
    aggregationKey('purchaseOrders', `status:${status}`, projectId ? { projectId } : undefined),

  poTotalByProject: (projectId: string) =>
    aggregationKey('purchaseOrders', 'totalAmount', { projectId }),

  // Purchase Requests
  prCountByStatus: (status: string, projectId?: string) =>
    aggregationKey('purchaseRequests', `status:${status}`, projectId ? { projectId } : undefined),

  // Projects
  projectCount: () => aggregationKey('projects', 'count'),

  projectCountByStatus: (status: string) => aggregationKey('projects', `status:${status}`),

  // Vendor metrics
  vendorSpend: (vendorId: string, fiscalYear?: number) =>
    aggregationKey(
      'vendors',
      'totalSpend',
      fiscalYear ? { vendorId, fiscalYear: String(fiscalYear) } : { vendorId }
    ),

  // Document metrics
  documentCountByStatus: (status: string, projectId?: string) =>
    aggregationKey('documents', `status:${status}`, projectId ? { projectId } : undefined),

  // User activity
  userActionCount: (userId: string, action: string) =>
    aggregationKey('userActivity', action, { userId }),
} as const;
