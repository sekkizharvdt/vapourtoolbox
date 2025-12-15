/**
 * BOM Summary Calculation Service
 *
 * Aggregates BOM item costs and applies cost configuration
 * (overhead, contingency, profit) to generate final BOM cost summary.
 */

import { collection, getDocs, query, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { BOMItem, BOMSummary, CostConfiguration, Money, CurrencyCode } from '@vapour/types';

const logger = createLogger({ context: 'bomSummary' });

/**
 * Calculate BOM summary from all BOM items
 *
 * @param db Firestore instance
 * @param bomId BOM ID
 * @param costConfig Optional cost configuration to apply overhead/contingency/profit
 * @returns Complete BOM summary with all cost breakdowns
 */
export async function calculateBOMSummary(
  db: Firestore,
  bomId: string,
  costConfig?: CostConfiguration
): Promise<BOMSummary> {
  try {
    logger.info('Calculating BOM summary', { bomId });

    // Fetch all BOM items
    const itemsQuery = query(collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS));
    const itemsSnapshot = await getDocs(itemsQuery);

    const items: BOMItem[] = [];
    itemsSnapshot.forEach((d) => {
      items.push(docToTyped<BOMItem>(d.id, d.data()));
    });

    // Aggregate direct costs from all items
    let totalWeight = 0;
    let totalMaterialCost = 0;
    let totalFabricationCost = 0;
    let totalServiceCost = 0;
    let currency: CurrencyCode = 'INR'; // Default currency

    const serviceBreakdownMap = new Map<string, number>();

    for (const item of items) {
      // Weight
      totalWeight += item.calculatedProperties?.totalWeight || 0;

      // Material cost
      if (item.cost?.totalMaterialCost) {
        totalMaterialCost += item.cost.totalMaterialCost.amount;
        currency = item.cost.totalMaterialCost.currency; // Use currency from first item
      }

      // Fabrication cost
      if (item.cost?.totalFabricationCost) {
        totalFabricationCost += item.cost.totalFabricationCost.amount;
      }

      // Service cost
      if (item.cost?.totalServiceCost) {
        totalServiceCost += item.cost.totalServiceCost.amount;

        // Aggregate service breakdown
        if (item.cost.serviceBreakdown) {
          for (const service of item.cost.serviceBreakdown) {
            const existing = serviceBreakdownMap.get(service.serviceId) || 0;
            serviceBreakdownMap.set(service.serviceId, existing + service.totalCost.amount);
          }
        }
      }
    }

    // Calculate total direct cost
    const totalDirectCost = totalMaterialCost + totalFabricationCost + totalServiceCost;

    // Apply cost configuration if provided
    let overhead = 0;
    let contingency = 0;
    let profit = 0;
    let costConfigId: string | undefined;

    if (costConfig) {
      costConfigId = costConfig.id;

      // Calculate overhead based on applicability
      if (costConfig.overhead.enabled) {
        const overheadBase = getOverheadBaseCost(
          costConfig.overhead.applicableTo,
          totalMaterialCost,
          totalFabricationCost,
          totalServiceCost
        );
        overhead = (overheadBase * costConfig.overhead.ratePercent) / 100;
      }

      // Calculate contingency (applied to direct cost + overhead)
      if (costConfig.contingency.enabled) {
        const contingencyBase = totalDirectCost + overhead;
        contingency = (contingencyBase * costConfig.contingency.ratePercent) / 100;
      }

      // Calculate profit (applied to subtotal)
      if (costConfig.profit.enabled) {
        const profitBase = totalDirectCost + overhead + contingency;
        profit = (profitBase * costConfig.profit.ratePercent) / 100;
      }
    }

    // Calculate final total
    const totalCost = totalDirectCost + overhead + contingency + profit;

    // Build service breakdown object
    const serviceBreakdown: Record<string, Money> = {};
    for (const [serviceId, amount] of serviceBreakdownMap.entries()) {
      serviceBreakdown[serviceId] = { amount, currency };
    }

    const summary: BOMSummary = {
      totalWeight,
      totalMaterialCost: { amount: totalMaterialCost, currency },
      totalFabricationCost: { amount: totalFabricationCost, currency },
      totalServiceCost: { amount: totalServiceCost, currency },
      totalDirectCost: { amount: totalDirectCost, currency },
      overhead: { amount: overhead, currency },
      contingency: { amount: contingency, currency },
      profit: { amount: profit, currency },
      totalCost: { amount: totalCost, currency },
      itemCount: items.length,
      currency,
      serviceBreakdown: Object.keys(serviceBreakdown).length > 0 ? serviceBreakdown : undefined,
      costConfigId,
      lastCalculated: (await import('firebase/firestore')).Timestamp.now(),
    };

    logger.info('BOM summary calculated', {
      bomId,
      itemCount: items.length,
      totalDirectCost,
      totalCost,
    });

    return summary;
  } catch (error) {
    logger.error('Error calculating BOM summary', { bomId, error });
    throw error;
  }
}

/**
 * Determine base cost for overhead calculation based on applicability
 */
function getOverheadBaseCost(
  applicableTo: string,
  materialCost: number,
  fabricationCost: number,
  serviceCost: number
): number {
  switch (applicableTo) {
    case 'MATERIAL':
      return materialCost;
    case 'FABRICATION':
      return fabricationCost;
    case 'SERVICE':
      return serviceCost;
    case 'ALL':
    default:
      return materialCost + fabricationCost + serviceCost;
  }
}

/**
 * Update BOM summary in Firestore
 *
 * @param db Firestore instance
 * @param bomId BOM ID
 * @param costConfig Optional cost configuration
 */
export async function updateBOMSummary(
  db: Firestore,
  bomId: string,
  costConfig?: CostConfiguration
): Promise<void> {
  try {
    const summary = await calculateBOMSummary(db, bomId, costConfig);

    const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
    const bomRef = doc(db, COLLECTIONS.BOMS, bomId);

    await updateDoc(bomRef, {
      summary,
      updatedAt: Timestamp.now(),
    });

    logger.info('BOM summary updated in Firestore', { bomId });
  } catch (error) {
    logger.error('Error updating BOM summary', { bomId, error });
    throw error;
  }
}
