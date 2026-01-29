/**
 * Firebase Type Safety Utilities
 *
 * This module provides type-safe helpers for working with Firebase Firestore,
 * addressing common type mismatches between TypeScript and Firebase's type system.
 */

import {
  Timestamp,
  serverTimestamp,
  getDocs,
  type Query,
  type DocumentData,
} from 'firebase/firestore';

/**
 * Converts a date input (string or Date) to a Firestore Timestamp
 * @param date - Date string (e.g., "2025-01-15") or Date object
 * @returns Firestore Timestamp
 *
 * @example
 * const timestamp = toFirestoreTimestamp("2025-01-15");
 * const transaction = { date: timestamp };
 */
export function toFirestoreTimestamp(date: string | Date): Timestamp {
  if (typeof date === 'string') {
    return Timestamp.fromDate(new Date(date));
  }
  return Timestamp.fromDate(date);
}

/**
 * Converts a Firestore Timestamp to a date string (YYYY-MM-DD)
 * @param timestamp - Firestore Timestamp
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * const dateStr = fromFirestoreTimestamp(transaction.date);
 * // Returns: "2025-01-15"
 */
export function fromFirestoreTimestamp(timestamp: Timestamp | Date): string {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString().split('T')[0] || '';
  }
  return timestamp.toISOString().split('T')[0] || '';
}

/**
 * Type-safe helper for creating Firestore documents with timestamps
 * Automatically adds createdAt and updatedAt fields
 *
 * @example
 * const docData = createFirestoreDoc({
 *   type: 'JOURNAL_ENTRY' as const,
 *   description: 'Sample entry',
 *   date: toFirestoreTimestamp('2025-01-15')
 * });
 */
export function createFirestoreDoc<T extends Record<string, unknown>>(
  data: T
): T & {
  createdAt: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
} {
  return {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Type-safe helper for updating Firestore documents
 * Automatically adds/updates the updatedAt field
 *
 * @example
 * const updateData = updateFirestoreDoc({
 *   description: 'Updated description',
 *   status: 'POSTED'
 * });
 */
export function updateFirestoreDoc<T extends Record<string, unknown>>(
  data: T
): T & { updatedAt: ReturnType<typeof serverTimestamp> } {
  return {
    ...data,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Type-safe builder for creating transaction documents
 * Ensures all required transaction fields are present
 *
 * @example
 * const transaction = createTransactionDoc({
 *   type: 'JOURNAL_ENTRY' as const,
 *   date: toFirestoreTimestamp('2025-01-15'),
 *   description: 'Sample entry',
 *   amount: 1000,
 *   currency: 'INR',
 *   status: 'DRAFT'
 * });
 */
export interface TransactionDocBase {
  type: string;
  date: Timestamp;
  description: string;
  amount: number;
  currency: string;
  status: string;
  transactionNumber?: string;
}

export function createTransactionDoc<T extends TransactionDocBase>(
  data: T,
  existingDoc?: { transactionNumber?: string; createdAt?: Timestamp }
): T & {
  createdAt: Timestamp | ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
} {
  return {
    ...data,
    transactionNumber: data.transactionNumber || existingDoc?.transactionNumber,
    createdAt: existingDoc?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Conditionally adds properties to an object in a type-safe way
 * Useful for optional fields that should only be added if they have values
 *
 * @example
 * const data = {
 *   name: 'Example',
 *   ...conditionalProps({
 *     description: description || undefined,
 *     projectId: projectId || undefined
 *   })
 * };
 */
export function conditionalProps<T extends Record<string, unknown>>(props: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(props).filter(([_, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

/**
 * Removes undefined values from an object before sending to Firestore.
 * Firestore does not accept undefined values in documents.
 *
 * @example
 * const data = removeUndefinedValues({
 *   name: 'Example',
 *   description: description || undefined,  // Will be removed if undefined
 *   projectId: projectId || undefined        // Will be removed if undefined
 * });
 * await addDoc(collection, data);
 */
export function removeUndefinedValues<T extends object>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Type guard to check if a value is a Firestore Timestamp
 */
export function isFirestoreTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
}

/**
 * Converts any date-like value to a JavaScript Date object.
 * Handles Firestore Timestamps, Date objects, and date strings.
 *
 * @param value - Date value (Timestamp, Date, string, or object with toDate method)
 * @returns JavaScript Date object, or null if conversion fails
 *
 * @example
 * ```typescript
 * // Instead of:
 * const date = typeof value === 'object' && 'toDate' in value
 *   ? value.toDate()
 *   : new Date(value as string);
 *
 * // Use:
 * const date = toDate(value);
 * ```
 */
export function toDate(
  value: Date | Timestamp | string | { toDate?: () => Date } | null | undefined
): Date | null {
  if (!value) {
    return null;
  }

  // Already a Date
  if (value instanceof Date) {
    return value;
  }

  // Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  // Object with toDate method (Firestore Timestamp-like)
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  // String date
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Converts any date-like value to a date string in YYYY-MM-DD format.
 * Useful for date input fields.
 *
 * @param value - Date value to convert
 * @returns Date string in YYYY-MM-DD format, or empty string if invalid
 *
 * @example
 * ```typescript
 * const dateStr = toDateString(transaction.date);
 * // Returns: "2025-01-15" or "" if invalid
 * ```
 */
export function toDateString(
  value: Date | Timestamp | string | { toDate?: () => Date } | null | undefined
): string {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return date.toISOString().split('T')[0] || '';
}

/**
 * Safely converts any date-like value to a Firestore Timestamp
 * Returns null if conversion fails
 */
export function safeToTimestamp(value: unknown): Timestamp | null {
  try {
    if (isFirestoreTimestamp(value)) {
      return value;
    }
    if (value instanceof Date) {
      return Timestamp.fromDate(value);
    }
    if (typeof value === 'string') {
      return Timestamp.fromDate(new Date(value));
    }
    if (typeof value === 'number') {
      return Timestamp.fromMillis(value);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Type-safe conversion of Firestore document snapshot to typed object.
 * This is the preferred pattern over `as Type` assertions for document conversion.
 *
 * @param id - Document ID
 * @param data - Document data from doc.data()
 * @returns Typed document object with id
 *
 * @example
 * // Instead of:
 * // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
 * const material = { id: doc.id, ...doc.data() } as Material;
 *
 * // Use:
 * const material = docToTyped<Material>(doc.id, doc.data());
 */
export function docToTyped<T extends { id: string }>(
  id: string,
  data: Record<string, unknown> | undefined
): T {
  const result: { id: string } & Record<string, unknown> = { id, ...data };
  return result as T;
}

/**
 * Type-safe conversion of Firestore document with timestamp fields converted to Date.
 * Use this for documents that have date, createdAt, updatedAt as Timestamp fields
 * but the TypeScript type expects Date objects.
 *
 * @param id - Document ID
 * @param data - Document data from doc.data()
 * @returns Typed document object with timestamps converted to Date
 *
 * @example
 * const transaction = docToTypedWithDates<BaseTransaction>(doc.id, doc.data());
 */
export function docToTypedWithDates<T extends { id: string }>(
  id: string,
  data: Record<string, unknown> | undefined
): T {
  if (!data) {
    const result: { id: string } = { id };
    return result as T;
  }

  const result: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================================
// QUERY UTILITIES
// ============================================================================

/**
 * Execute a Firestore query and map results to typed objects.
 *
 * This utility reduces boilerplate for the common pattern:
 * ```
 * const snapshot = await getDocs(query);
 * const items = snapshot.docs.map(doc => docToTyped<T>(doc.id, doc.data()));
 * ```
 *
 * @param firestoreQuery - Firestore Query object
 * @returns Promise resolving to array of typed documents
 *
 * @example
 * const materials = await queryAndMap<Material>(
 *   query(collection(db, 'materials'), where('isActive', '==', true))
 * );
 */
export async function queryAndMap<T extends { id: string }>(
  firestoreQuery: Query<DocumentData>
): Promise<T[]> {
  const snapshot = await getDocs(firestoreQuery);
  return snapshot.docs.map((doc) => docToTyped<T>(doc.id, doc.data()));
}

/**
 * Execute a Firestore query and map results with timestamp-to-Date conversion.
 *
 * Use this variant when your TypeScript type expects Date objects
 * instead of Firestore Timestamps.
 *
 * @param firestoreQuery - Firestore Query object
 * @returns Promise resolving to array of typed documents with dates converted
 *
 * @example
 * const transactions = await queryAndMapWithDates<Transaction>(
 *   query(collection(db, 'transactions'), where('status', '==', 'PENDING'))
 * );
 */
export async function queryAndMapWithDates<T extends { id: string }>(
  firestoreQuery: Query<DocumentData>
): Promise<T[]> {
  const snapshot = await getDocs(firestoreQuery);
  return snapshot.docs.map((doc) => docToTypedWithDates<T>(doc.id, doc.data()));
}

/**
 * Result type for paginated queries
 */
export interface PaginatedResult<T> {
  items: T[];
  lastDocId: string | null;
  hasMore: boolean;
}

/**
 * Execute a Firestore query with pagination support.
 *
 * This utility handles the common pagination pattern:
 * - Fetches pageSize + 1 to determine if more results exist
 * - Returns hasMore flag and lastDocId for cursor-based pagination
 *
 * @param firestoreQuery - Firestore Query (should NOT include limit)
 * @param pageSize - Number of items per page
 * @returns Promise resolving to paginated result
 *
 * @example
 * const result = await queryAndMapPaginated<Material>(
 *   query(collection(db, 'materials'), orderBy('createdAt', 'desc')),
 *   50
 * );
 * // result.items - array of materials (max 50)
 * // result.hasMore - true if more pages exist
 * // result.lastDocId - use for cursor-based pagination
 */
export async function queryAndMapPaginated<T extends { id: string }>(
  firestoreQuery: Query<DocumentData>,
  pageSize: number
): Promise<PaginatedResult<T>> {
  const snapshot = await getDocs(firestoreQuery);
  let items = snapshot.docs.map((doc) => docToTyped<T>(doc.id, doc.data()));

  const hasMore = items.length > pageSize;
  if (hasMore) {
    items = items.slice(0, pageSize);
  }

  return {
    items,
    lastDocId: items.length > 0 ? (items[items.length - 1]?.id ?? null) : null,
    hasMore,
  };
}
