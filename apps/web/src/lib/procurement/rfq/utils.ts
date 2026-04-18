/**
 * RFQ Service Utilities
 *
 * Internal utility functions for RFQ operations
 */

import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { RFQ } from '@vapour/types';

/**
 * Generate RFQ number in format: RFQ/YYYY/XXX (yearly sequence, 3-digit).
 *
 * Picks the next sequence by scanning the highest existing `RFQ/{year}/...`
 * number in the current calendar year — works with both the new yearly format
 * and any legacy `RFQ/{year}/MM/XXXX` entries, since we always parse the last
 * `/`-separated segment as the sequence number.
 */
export async function generateRFQNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.RFQS),
    where('createdAt', '>=', Timestamp.fromDate(yearStart)),
    where('createdAt', '<=', Timestamp.fromDate(yearEnd)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  let maxSequence = 0;
  for (const d of snapshot.docs) {
    const lastRFQ = d.data() as RFQ;
    const parts = (lastRFQ.number || '').split('/');
    const seqStr = parts[parts.length - 1] || '0';
    const seq = parseInt(seqStr, 10);
    if (Number.isFinite(seq) && seq > maxSequence) maxSequence = seq;
  }

  const sequence = maxSequence + 1;
  const sequenceStr = String(sequence).padStart(3, '0');
  return `RFQ/${year}/${sequenceStr}`;
}
