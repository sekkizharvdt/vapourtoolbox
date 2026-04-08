/**
 * MED Plant Cost Estimation
 *
 * Looks up material prices from the materials database and computes
 * equipment cost for each BOM item. Items without prices are marked
 * as unavailable so the team knows what needs sourcing.
 */

import type { Firestore } from 'firebase/firestore';
import type { MEDCompleteBOM } from '../medBOMGenerator';
import type { MEDCostEstimate, MEDCostItem } from './designerTypes';
import { searchMaterials } from '../../materials/queries';

/**
 * Compute cost estimate by looking up material prices from the database.
 *
 * For each unique material in the BOM, searches the materials database.
 * If a current price exists, computes cost = weight × rate.
 * If not found, marks the item as price unavailable.
 *
 * @param bom The complete BOM from medBOMGenerator
 * @param db Firestore instance for material price lookups
 * @param outputM3Day Distillate output in m³/day for cost/m³/day metric
 * @returns Cost estimate with per-item breakdown
 */
export async function computeCostEstimate(
  bom: MEDCompleteBOM,
  db: Firestore,
  outputM3Day: number
): Promise<MEDCostEstimate> {
  // Build unique material list from BOM
  const uniqueMaterials = new Set<string>();
  for (const item of bom.equipment) {
    if (item.material && item.totalWeightKg > 0) {
      uniqueMaterials.add(item.material);
    }
  }

  // Look up prices for each unique material
  const priceMap = new Map<string, { ratePerKg: number; currency: string }>();
  for (const materialName of uniqueMaterials) {
    try {
      const results = await searchMaterials(db, materialName, 5);
      // Find best match — prefer exact name match, then first with price
      const match = results.find(
        (m) => m.currentPrice && m.currentPrice.pricePerUnit.amount > 0 && m.baseUnit === 'kg'
      );
      if (match?.currentPrice) {
        priceMap.set(materialName, {
          ratePerKg: match.currentPrice.pricePerUnit.amount,
          currency: match.currentPrice.currency ?? 'INR',
        });
      }
    } catch {
      // Material not found in database — will be marked as unavailable
    }
  }

  // Compute per-item costs
  const equipmentItems: MEDCostItem[] = [];
  let totalCost = 0;
  let pricedCount = 0;
  let unpricedCount = 0;
  const unpricedMaterials = new Set<string>();
  let currency = 'INR';

  for (const item of bom.equipment) {
    if (item.totalWeightKg <= 0) continue;

    const price = priceMap.get(item.material);
    const priceAvailable = !!price;
    const ratePerKg = price?.ratePerKg ?? 0;
    const cost = item.totalWeightKg * ratePerKg;

    if (priceAvailable) {
      totalCost += cost;
      pricedCount++;
      currency = price!.currency;
    } else {
      unpricedCount++;
      if (item.material) unpricedMaterials.add(item.material);
    }

    equipmentItems.push({
      item: item.description,
      category: item.category,
      material: item.material,
      weightKg: item.totalWeightKg,
      ratePerKg,
      cost,
      currency: price?.currency ?? '',
      priceAvailable,
    });
  }

  return {
    equipmentItems,
    totalEquipmentCost: Math.round(totalCost),
    currency,
    costPerM3Day: outputM3Day > 0 ? Math.round(totalCost / outputM3Day) : 0,
    pricedItemCount: pricedCount,
    unpricedItemCount: unpricedCount,
    unpricedMaterials: Array.from(unpricedMaterials),
  };
}
