// Duplicate Entity Detection
// Prevents creating entities with duplicate PAN, GSTIN, or email

import type { Firestore } from 'firebase/firestore';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Check if an entity with the given PAN already exists
 * @param db Firestore instance
 * @param pan PAN to check
 * @param excludeId Optional entity ID to exclude (for updates)
 * @returns Entity ID if duplicate found, null otherwise
 */
export async function checkDuplicatePAN(
  db: Firestore,
  pan: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string }> {
  if (!pan || !pan.trim()) {
    return { isDuplicate: false };
  }

  const normalizedPAN = pan.trim().toUpperCase();

  try {
    const entitiesRef = collection(db, 'entities');
    const q = query(entitiesRef, where('taxIdentifiers.pan', '==', normalizedPAN), limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { isDuplicate: false };
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return { isDuplicate: false };
    }

    if (excludeId && doc.id === excludeId) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingEntityId: doc.id,
      existingEntityName: doc.data().name || 'Unknown Entity',
    };
  } catch (error) {
    console.error('Error checking duplicate PAN:', error);
    throw new Error('Failed to check for duplicate PAN');
  }
}

/**
 * Check if an entity with the given GSTIN already exists
 * @param db Firestore instance
 * @param gstin GSTIN to check
 * @param excludeId Optional entity ID to exclude (for updates)
 * @returns Entity ID if duplicate found, null otherwise
 */
export async function checkDuplicateGSTIN(
  db: Firestore,
  gstin: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string }> {
  if (!gstin || !gstin.trim()) {
    return { isDuplicate: false };
  }

  const normalizedGSTIN = gstin.trim().toUpperCase();

  try {
    const entitiesRef = collection(db, 'entities');
    const q = query(entitiesRef, where('taxIdentifiers.gstin', '==', normalizedGSTIN), limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { isDuplicate: false };
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return { isDuplicate: false };
    }

    if (excludeId && doc.id === excludeId) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingEntityId: doc.id,
      existingEntityName: doc.data().name || 'Unknown Entity',
    };
  } catch (error) {
    console.error('Error checking duplicate GSTIN:', error);
    throw new Error('Failed to check for duplicate GSTIN');
  }
}

/**
 * Check if an entity with the given email already exists
 * @param db Firestore instance
 * @param email Email to check
 * @param excludeId Optional entity ID to exclude (for updates)
 * @returns Entity ID if duplicate found, null otherwise
 */
export async function checkDuplicateEmail(
  db: Firestore,
  email: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string }> {
  if (!email || !email.trim()) {
    return { isDuplicate: false };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const entitiesRef = collection(db, 'entities');
    const q = query(entitiesRef, where('email', '==', normalizedEmail), limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { isDuplicate: false };
    }

    const doc = snapshot.docs[0];
    if (!doc) {
      return { isDuplicate: false };
    }

    if (excludeId && doc.id === excludeId) {
      return { isDuplicate: false };
    }

    return {
      isDuplicate: true,
      existingEntityId: doc.id,
      existingEntityName: doc.data().name || 'Unknown Entity',
    };
  } catch (error) {
    console.error('Error checking duplicate email:', error);
    throw new Error('Failed to check for duplicate email');
  }
}

/**
 * Check for all possible duplicates (PAN, GSTIN, email)
 * @param db Firestore instance
 * @param data Entity data to check
 * @param excludeId Optional entity ID to exclude (for updates)
 * @returns Object with duplicate status for each field
 */
export async function checkEntityDuplicates(
  db: Firestore,
  data: {
    email?: string;
    taxIdentifiers?: {
      pan?: string;
      gstin?: string;
    };
  },
  excludeId?: string
): Promise<{
  hasDuplicates: boolean;
  duplicates: {
    email?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
    pan?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
    gstin?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
  };
}> {
  const duplicates: {
    email?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
    pan?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
    gstin?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
  } = {};

  // Check email duplicate
  if (data.email) {
    duplicates.email = await checkDuplicateEmail(db, data.email, excludeId);
  }

  // Check PAN duplicate
  if (data.taxIdentifiers?.pan) {
    duplicates.pan = await checkDuplicatePAN(db, data.taxIdentifiers.pan, excludeId);
  }

  // Check GSTIN duplicate
  if (data.taxIdentifiers?.gstin) {
    duplicates.gstin = await checkDuplicateGSTIN(db, data.taxIdentifiers.gstin, excludeId);
  }

  const hasDuplicates =
    duplicates.email?.isDuplicate ||
    duplicates.pan?.isDuplicate ||
    duplicates.gstin?.isDuplicate ||
    false;

  return {
    hasDuplicates,
    duplicates,
  };
}

/**
 * Format duplicate error message for UI display
 */
export function formatDuplicateErrorMessage(duplicates: {
  email?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
  pan?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
  gstin?: { isDuplicate: boolean; existingEntityId?: string; existingEntityName?: string };
}): string[] {
  const errors: string[] = [];

  if (duplicates.email?.isDuplicate) {
    errors.push(
      `Email already exists for entity: ${duplicates.email.existingEntityName || 'Unknown'}`
    );
  }

  if (duplicates.pan?.isDuplicate) {
    errors.push(`PAN already exists for entity: ${duplicates.pan.existingEntityName || 'Unknown'}`);
  }

  if (duplicates.gstin?.isDuplicate) {
    errors.push(
      `GSTIN already exists for entity: ${duplicates.gstin.existingEntityName || 'Unknown'}`
    );
  }

  return errors;
}
