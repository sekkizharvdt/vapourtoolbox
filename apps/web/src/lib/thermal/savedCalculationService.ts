/**
 * Saved Calculation Service
 *
 * Personal save/load for thermal calculator inputs.
 * No entityId — each user sees only their own saves.
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { SavedCalculation } from '@vapour/types';

type CalculatorType = SavedCalculation['calculatorType'];

/**
 * Recursively remove `undefined` values from a payload before writing to
 * Firestore (rule 12 — Firestore rejects `undefined`).
 *
 * - Object keys whose value is `undefined` are dropped.
 * - Arrays are preserved as arrays; `undefined` elements become `null`
 *   (dropping them would silently shift indices).
 * - Only plain objects and arrays are recursed into — Date, Firestore
 *   Timestamp, FieldValue sentinels, etc. are passed through untouched.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item))) as T;
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    // Non-plain objects (Date, Timestamp, FieldValue, class instances) pass through as-is
    if (proto !== Object.prototype && proto !== null) return value;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === undefined) continue;
      result[key] = stripUndefined(val);
    }
    return result as T;
  }
  return value;
}

/**
 * Save a calculation to Firestore
 */
export async function saveCalculation(
  db: Firestore,
  userId: string,
  calculatorType: CalculatorType,
  name: string,
  inputs: Record<string, unknown>
): Promise<string> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred to a future hardening pass (the static-export build can't make client-side gates load-bearing)
  const docRef = await addDoc(
    collection(db, COLLECTIONS.SAVED_CALCULATIONS),
    stripUndefined({
      userId,
      calculatorType,
      name,
      inputs,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return docRef.id;
}

/**
 * List saved calculations for a user and calculator type
 */
export async function listCalculations(
  db: Firestore,
  userId: string,
  calculatorType: CalculatorType
): Promise<SavedCalculation[]> {
  const q = query(
    collection(db, COLLECTIONS.SAVED_CALCULATIONS),
    where('userId', '==', userId),
    where('calculatorType', '==', calculatorType),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const results: SavedCalculation[] = [];

  snapshot.forEach((d) => {
    const data = d.data();
    // Client-side filter for soft deletes
    if (data.isDeleted) return;

    results.push({
      id: d.id,
      userId: data.userId,
      calculatorType: data.calculatorType,
      name: data.name,
      inputs: data.inputs,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    });
  });

  return results;
}

/**
 * Soft delete a saved calculation (verify ownership)
 */
export async function deleteCalculation(
  db: Firestore,
  _userId: string,
  calculationId: string
): Promise<void> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred to a future hardening pass (the static-export build can't make client-side gates load-bearing)
  // rule18-exempt: user-private calculator state
  const docRef = doc(db, COLLECTIONS.SAVED_CALCULATIONS, calculationId);
  // Firestore rules enforce ownership — if the doc's userId doesn't match,
  // the update will be rejected by security rules.
  await updateDoc(docRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
}
