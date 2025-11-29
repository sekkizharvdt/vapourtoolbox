/**
 * Code Generation Service
 * Generates unique document codes using counter-based approach
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@vapour/firebase';

const db = getFirestore();

/**
 * Counter document structure
 */
interface CounterDocument {
  currentValue: number;
  prefix: string;
  lastUpdated: FirebaseFirestore.Timestamp;
}

/**
 * Document code types and their prefixes
 */
export type DocumentCodeType =
  | 'SHAPE'
  | 'MATERIAL'
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_ORDER'
  | 'RFQ'
  | 'INVOICE'
  | 'BILL'
  | 'PROJECT'
  | 'PROPOSAL'
  | 'ENQUIRY'
  | 'BOM';

const CODE_PREFIXES: Record<DocumentCodeType, string> = {
  SHAPE: 'SHP',
  MATERIAL: 'MAT',
  PURCHASE_REQUEST: 'PR',
  PURCHASE_ORDER: 'PO',
  RFQ: 'RFQ',
  INVOICE: 'INV',
  BILL: 'BIL',
  PROJECT: 'PRJ',
  PROPOSAL: 'PROP',
  ENQUIRY: 'ENQ',
  BOM: 'BOM',
};

/**
 * Get the counter collection reference
 */
function getCounterRef(codeType: DocumentCodeType, entityId?: string) {
  const counterId = entityId ? `${codeType}_${entityId}` : codeType;
  return db.collection(COLLECTIONS.COUNTERS || 'counters').doc(counterId);
}

/**
 * Generate a unique document code using atomic counter increment
 *
 * Format: PREFIX-YYYY-NNNN (e.g., SHP-2025-0001)
 *
 * @param codeType - Type of document (SHAPE, MATERIAL, etc.)
 * @param entityId - Optional entity ID for entity-scoped codes
 * @returns Generated unique code
 */
export async function generateDocumentCode(
  codeType: DocumentCodeType,
  entityId?: string
): Promise<string> {
  const prefix = CODE_PREFIXES[codeType];
  const year = new Date().getFullYear();
  const counterRef = getCounterRef(codeType, entityId);

  try {
    // Use transaction for atomic increment
    const newNumber = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);

      let currentValue = 0;
      if (counterDoc.exists) {
        const data = counterDoc.data() as CounterDocument;
        currentValue = data.currentValue || 0;
      }

      const nextValue = currentValue + 1;

      transaction.set(
        counterRef,
        {
          currentValue: nextValue,
          prefix,
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return nextValue;
    });

    // Format: PREFIX-YYYY-NNNN
    const sequenceNumber = newNumber.toString().padStart(4, '0');
    return `${prefix}-${year}-${sequenceNumber}`;
  } catch (error) {
    // Fallback to random if transaction fails
    console.error('Counter transaction failed, using random fallback:', error);
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `${prefix}-${year}-${randomNum}`;
  }
}

/**
 * Generate code from material properties
 * Creates a descriptive code based on material characteristics
 *
 * Format: TYPE-GRADE-DIMS (e.g., CS-A36-100x50)
 */
export function generateCodeFromMaterial(
  materialType: string,
  grade?: string,
  dimensions?: string
): string {
  const parts: string[] = [];

  // Add abbreviated type
  if (materialType) {
    const typeAbbr = abbreviateType(materialType);
    parts.push(typeAbbr);
  }

  // Add grade if present
  if (grade) {
    parts.push(grade.toUpperCase().replace(/\s+/g, ''));
  }

  // Add dimensions if present
  if (dimensions) {
    parts.push(dimensions.replace(/\s+/g, ''));
  }

  return parts.join('-') || 'UNKNOWN';
}

/**
 * Abbreviate material type for code generation
 */
function abbreviateType(type: string): string {
  const abbreviations: Record<string, string> = {
    CARBON_STEEL: 'CS',
    STAINLESS_STEEL: 'SS',
    ALUMINUM: 'AL',
    COPPER: 'CU',
    BRASS: 'BR',
    TITANIUM: 'TI',
    NICKEL_ALLOY: 'NI',
    DUPLEX_STEEL: 'DPX',
    SUPER_DUPLEX: 'SDPX',
    INCONEL: 'INC',
    MONEL: 'MON',
    HASTELLOY: 'HAS',
  };

  const upper = type.toUpperCase().replace(/\s+/g, '_');
  return abbreviations[upper] || upper.substring(0, 3);
}

/**
 * Reset a counter (for testing or admin purposes)
 */
export async function resetCounter(
  codeType: DocumentCodeType,
  entityId?: string,
  startValue: number = 0
): Promise<void> {
  const counterRef = getCounterRef(codeType, entityId);

  await counterRef.set({
    currentValue: startValue,
    prefix: CODE_PREFIXES[codeType],
    lastUpdated: FieldValue.serverTimestamp(),
  });
}

/**
 * Get current counter value (for display/debugging)
 */
export async function getCurrentCounterValue(
  codeType: DocumentCodeType,
  entityId?: string
): Promise<number> {
  const counterRef = getCounterRef(codeType, entityId);
  const doc = await counterRef.get();

  if (!doc.exists) {
    return 0;
  }

  return (doc.data() as CounterDocument).currentValue || 0;
}
