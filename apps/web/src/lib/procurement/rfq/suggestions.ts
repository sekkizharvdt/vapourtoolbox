/**
 * RFQ Vendor Suggestions
 *
 * Suggests vendors for an RFQ based on preferred vendors
 * stored on materials referenced in the Purchase Request items.
 */

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Material } from '@vapour/types';

const logger = createLogger({ context: 'rfq:suggestions' });

export interface VendorSuggestion {
  vendorId: string;
  vendorName: string;
  /** Number of line items this vendor supplies */
  materialCount: number;
  /** Material codes this vendor is preferred for */
  materialCodes: string[];
}

/**
 * Suggest vendors for an RFQ based on material preferred vendors.
 *
 * Looks up each materialId from the PR items, collects preferredVendors
 * from the material database, then returns a ranked list (most-referenced first).
 *
 * @param db - Firestore instance
 * @param materialIds - Array of materialIds from PR items (may contain duplicates/undefined)
 * @returns Ranked list of vendor suggestions
 */
export async function suggestVendorsForRFQ(
  db: Firestore,
  materialIds: (string | undefined)[]
): Promise<VendorSuggestion[]> {
  const uniqueIds = [...new Set(materialIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return [];
  }

  // Batch-fetch materials
  const materialResults = await Promise.all(
    uniqueIds.map(async (materialId) => {
      try {
        const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
        if (materialDoc.exists()) {
          return { id: materialDoc.id, ...materialDoc.data() } as Material;
        }
      } catch (err) {
        logger.warn('Failed to fetch material for vendor suggestion', { materialId, error: err });
      }
      return null;
    })
  );

  // Aggregate vendor references across materials
  const vendorMap = new Map<string, { count: number; codes: string[] }>();

  for (const material of materialResults) {
    if (!material?.preferredVendors?.length) continue;

    for (const vendorId of material.preferredVendors) {
      const existing = vendorMap.get(vendorId) || { count: 0, codes: [] };
      existing.count += 1;
      if (material.materialCode) {
        existing.codes.push(material.materialCode);
      }
      vendorMap.set(vendorId, existing);
    }
  }

  if (vendorMap.size === 0) {
    return [];
  }

  // Fetch vendor names in parallel
  const vendorEntries = Array.from(vendorMap.entries());
  const vendorNames: string[] = await Promise.all(
    vendorEntries.map(async ([vendorId]): Promise<string> => {
      try {
        const vendorDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, vendorId));
        if (vendorDoc.exists()) {
          return (vendorDoc.data().name as string) || vendorId;
        }
      } catch (err) {
        logger.warn('Failed to fetch vendor name', { vendorId, error: err });
      }
      return vendorId;
    })
  );

  // Build and sort suggestions (most-referenced first)
  const suggestions: VendorSuggestion[] = vendorEntries.map(([vendorId, info], idx) => ({
    vendorId,
    vendorName: vendorNames[idx] || vendorId,
    materialCount: info.count,
    materialCodes: info.codes,
  }));

  suggestions.sort((a, b) => b.materialCount - a.materialCount);

  return suggestions;
}
