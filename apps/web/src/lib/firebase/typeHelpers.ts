/**
 * Firebase Type Safety Utilities
 *
 * This module provides type-safe helpers for working with Firebase Firestore,
 * addressing common type mismatches between TypeScript and Firebase's type system.
 */

import { Timestamp, serverTimestamp } from 'firebase/firestore';

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
): T & { createdAt: ReturnType<typeof serverTimestamp>; updatedAt: ReturnType<typeof serverTimestamp> } {
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
export function conditionalProps<T extends Record<string, unknown>>(
  props: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(props).filter(([_, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

/**
 * Type guard to check if a value is a Firestore Timestamp
 */
export function isFirestoreTimestamp(value: unknown): value is Timestamp {
  return value instanceof Timestamp;
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
