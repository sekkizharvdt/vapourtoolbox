/**
 * Three-Way Match Query Functions
 *
 * Functions for querying match status, line items, and history
 */

import { collection, getDocs, query, where, orderBy, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { ThreeWayMatch, MatchLineItem, MatchToleranceConfig } from '@vapour/types';

const logger = createLogger({ context: 'threeWayMatchService' });

/**
 * Get match status for a vendor bill
 */
export async function getMatchStatus(
  db: Firestore,
  vendorBillId: string
): Promise<ThreeWayMatch | null> {
  try {
    const matchesRef = collection(db, COLLECTIONS.THREE_WAY_MATCHES);
    const q = query(
      matchesRef,
      where('vendorBillId', '==', vendorBillId),
      orderBy('matchedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    return {
      id: firstDoc.id,
      ...firstDoc.data(),
    } as ThreeWayMatch;
  } catch (error) {
    logger.error('Failed to get match status', { error, vendorBillId });
    throw error;
  }
}

/**
 * Get match line items
 */
export async function getMatchLineItems(
  db: Firestore,
  threeWayMatchId: string
): Promise<MatchLineItem[]> {
  try {
    const lineItemsRef = collection(db, COLLECTIONS.MATCH_LINE_ITEMS);
    const q = query(
      lineItemsRef,
      where('threeWayMatchId', '==', threeWayMatchId),
      orderBy('lineNumber', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MatchLineItem[];
  } catch (error) {
    logger.error('Failed to get match line items', { error, threeWayMatchId });
    throw error;
  }
}

/**
 * Get matching history for a purchase order
 */
export async function getMatchHistory(
  db: Firestore,
  purchaseOrderId: string
): Promise<ThreeWayMatch[]> {
  try {
    const matchesRef = collection(db, COLLECTIONS.THREE_WAY_MATCHES);
    const q = query(
      matchesRef,
      where('purchaseOrderId', '==', purchaseOrderId),
      orderBy('matchedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ThreeWayMatch[];
  } catch (error) {
    logger.error('Failed to get match history', { error, purchaseOrderId });
    throw error;
  }
}

/**
 * Get default tolerance configuration
 */
export async function getDefaultToleranceConfig(
  db: Firestore
): Promise<MatchToleranceConfig | null> {
  try {
    const configsRef = collection(db, COLLECTIONS.MATCH_TOLERANCE_CONFIGS);
    const q = query(configsRef, where('isDefault', '==', true), where('isActive', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    return {
      id: firstDoc.id,
      ...firstDoc.data(),
    } as MatchToleranceConfig;
  } catch (error) {
    logger.error('Failed to get default tolerance config', { error });
    throw error;
  }
}
