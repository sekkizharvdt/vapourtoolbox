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
 * Save a calculation to Firestore
 */
export async function saveCalculation(
  db: Firestore,
  userId: string,
  calculatorType: CalculatorType,
  name: string,
  inputs: Record<string, unknown>
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.SAVED_CALCULATIONS), {
    userId,
    calculatorType,
    name,
    inputs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
  const docRef = doc(db, COLLECTIONS.SAVED_CALCULATIONS, calculationId);
  // Firestore rules enforce ownership — if the doc's userId doesn't match,
  // the update will be rejected by security rules.
  await updateDoc(docRef, {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
}
