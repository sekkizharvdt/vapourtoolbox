/**
 * BOM Calculations Engine
 *
 * Handles cost and weight calculations for BOM items by integrating with
 * Material Database and Shape Database.
 *
 * Week 1 Sprint - Material cost only (fabrication costs in Week 2)
 */

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { calculateShape } from '@/lib/shapes/shapeCalculator';
import { getShapeById } from '@/lib/shapes/shapeData';
import { calculateAllServiceCosts, resolveServiceRates } from '@/lib/services/serviceCalculations';
import { getBoughtOutItemById } from '@/lib/boughtOut/boughtOutService';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  BOMItem,
  BOMItemCostCalculation,
  CurrencyCode,
  Material,
  ShapeParameters,
} from '@vapour/types';

const logger = createLogger({ context: 'bomCalculations' });

// ============================================================================
// Cost Calculation Functions
// ============================================================================

/**
 * Calculate cost for a bought-out item
 *
 * For bought-out items, cost is direct (no fabrication cost). Pricing source:
 * - Components linked via `materialId` price from the material master's
 *   `currentPrice` (legacy path — pipes/flanges/fittings kept in materials).
 * - Components linked via `boughtOutItemId` (no materialId) price from the
 *   bought_out_items catalog doc's `pricing.listPrice`, which the
 *   procurement feedback loop keeps current (completion-plan A2 bridge).
 */
export async function calculateBoughtOutItemCost(
  db: Firestore,
  item: BOMItem
): Promise<BOMItemCostCalculation | null> {
  try {
    // Skip if no component or no priceable linkage defined
    if (!item.component || (!item.component.materialId && !item.component.boughtOutItemId)) {
      logger.debug('Item has no material or bought-out link, skipping cost calculation', {
        itemId: item.id,
      });
      return null;
    }

    // Verify component type is BOUGHT_OUT
    if (item.component.type !== 'BOUGHT_OUT') {
      logger.warn('Component type is not BOUGHT_OUT, use calculateItemCost instead', {
        itemId: item.id,
        type: item.component.type,
      });
      return null;
    }

    let weight = 0;
    let materialCostPerUnit = 0;
    let currency: CurrencyCode = 'INR';

    if (item.component.materialId) {
      // Fetch material definition
      const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, item.component.materialId));
      if (!materialDoc.exists()) {
        logger.warn('Material not found', { materialId: item.component.materialId });
        return null;
      }

      const material = docToTyped<Material>(materialDoc.id, materialDoc.data());

      // Get material price
      materialCostPerUnit = material.currentPrice?.pricePerUnit.amount ?? 0;
      currency = material.currentPrice?.pricePerUnit.currency || 'INR';

      // Weight from material document (weightPerPiece_kg for flanges/fittings,
      // weightPerMeter_kg for pipes). Materials sold per kg (raw stock —
      // thermal → BOM export lines) weigh exactly 1 kg per unit, so
      // totalWeight = quantity.
      weight =
        material.baseUnit === 'kg'
          ? 1
          : material.baseUnit === 'meter'
            ? material.weightPerMeter_kg || 0
            : material.weightPerPiece_kg || 0;
    } else {
      // A2 bridge: price from the bought_out_items catalog doc
      const boughtOutItem = await getBoughtOutItemById(db, item.component.boughtOutItemId!);
      if (!boughtOutItem) {
        logger.warn('Bought-out item not found', {
          itemId: item.id,
          boughtOutItemId: item.component.boughtOutItemId,
        });
        return null;
      }

      const listPrice = boughtOutItem.pricing?.listPrice;
      if (!listPrice || !(listPrice.amount > 0)) {
        // Expected for catalog entries created without a price — skip the
        // line (no cost written) rather than pricing it at 0.
        logger.debug('Bought-out item has no usable price, skipping cost calculation', {
          itemId: item.id,
          boughtOutItemId: item.component.boughtOutItemId,
        });
        return null;
      }

      materialCostPerUnit = roundToPaisa(listPrice.amount);
      currency = listPrice.currency || boughtOutItem.pricing.currency || 'INR';
      weight = 0; // Catalog carries no weight data
    }

    const fabricationCostPerUnit = 0; // No fabrication for bought-out items

    // Apply quantity (for pipes, quantity = meters; for flanges/fittings, quantity = pieces)
    const totalWeight = weight * item.quantity;
    const totalMaterialCost = roundToPaisa(materialCostPerUnit * item.quantity);
    const totalFabricationCost = 0;

    // Phase 3: Calculate service costs (procured/default rates resolved at
    // this async boundary — see resolveServiceRates)
    const resolvedRates = await resolveServiceRates(db, item.services);
    const serviceCosts = calculateAllServiceCosts(
      item.services,
      materialCostPerUnit,
      fabricationCostPerUnit,
      item.quantity,
      currency,
      resolvedRates
    );

    logger.info('Bought-out item cost calculated', {
      itemId: item.id,
      materialCostPerUnit,
      totalMaterialCost,
      serviceCostPerUnit: serviceCosts.serviceCostPerUnit.amount,
      quantity: item.quantity,
    });

    return {
      weight,
      totalWeight,
      materialCostPerUnit: {
        amount: materialCostPerUnit,
        currency,
      },
      totalMaterialCost: {
        amount: totalMaterialCost,
        currency,
      },
      fabricationCostPerUnit: {
        amount: fabricationCostPerUnit,
        currency,
      },
      totalFabricationCost: {
        amount: totalFabricationCost,
        currency,
      },
      serviceCostPerUnit: serviceCosts.serviceCostPerUnit,
      totalServiceCost: serviceCosts.totalServiceCost,
      serviceBreakdown: serviceCosts.serviceBreakdown,
    };
  } catch (error) {
    logger.error('Error calculating bought-out item cost', { itemId: item.id, error });
    return null;
  }
}

/**
 * Calculate cost for a single BOM item
 *
 * Routes to appropriate calculation based on component type:
 * - BOUGHT_OUT: Uses direct material pricing
 * - SHAPE: Integrates with Shape Database for weight and fabrication calculations
 */
export async function calculateItemCost(
  db: Firestore,
  item: BOMItem
): Promise<BOMItemCostCalculation | null> {
  try {
    // Skip if no component defined
    if (!item.component) {
      logger.debug('Item has no component, skipping cost calculation', {
        itemId: item.id,
      });
      return null;
    }

    // Route to appropriate calculation based on component type
    if (item.component.type === 'BOUGHT_OUT') {
      return calculateBoughtOutItemCost(db, item);
    }

    // For SHAPE type (or legacy items without type), use shape-based calculation
    if (!item.component.shapeId || !item.component.materialId) {
      logger.debug('Shape-based item has no shape or material, skipping cost calculation', {
        itemId: item.id,
      });
      return null;
    }

    // Shape definitions live in the local dataset (@/data/shapes), not Firestore
    const shape = getShapeById(item.component.shapeId);
    if (!shape) {
      logger.warn('Shape not found', { shapeId: item.component.shapeId });
      return null;
    }

    // Fetch material definition
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, item.component.materialId));
    if (!materialDoc.exists()) {
      logger.warn('Material not found', { materialId: item.component.materialId });
      return null;
    }

    const material = docToTyped<Material>(materialDoc.id, materialDoc.data());

    // Calculate shape properties
    const shapeResult = calculateShape({
      shape,
      material,
      parameterValues: item.component.parameters || {},
      quantity: 1, // Calculate for single unit first
    });

    // Extract weight and cost
    const weight = shapeResult.calculatedValues.weight;
    const materialCostPerUnit = shapeResult.costEstimate.materialCost;
    const fabricationCostPerUnit = shapeResult.costEstimate.fabricationCost;
    const currency = shapeResult.costEstimate.currency;

    // Apply quantity
    const totalWeight = weight * item.quantity;
    const totalMaterialCost = materialCostPerUnit * item.quantity;
    const totalFabricationCost = fabricationCostPerUnit * item.quantity;

    // Phase 3: Calculate service costs (procured/default rates resolved at
    // this async boundary — see resolveServiceRates)
    const resolvedRates = await resolveServiceRates(db, item.services);
    const serviceCosts = calculateAllServiceCosts(
      item.services,
      materialCostPerUnit,
      fabricationCostPerUnit,
      item.quantity,
      currency,
      resolvedRates
    );

    logger.info('Item cost calculated', {
      itemId: item.id,
      weight,
      totalWeight,
      materialCostPerUnit,
      totalMaterialCost,
      fabricationCostPerUnit,
      totalFabricationCost,
      serviceCostPerUnit: serviceCosts.serviceCostPerUnit.amount,
    });

    return {
      weight,
      totalWeight,
      materialCostPerUnit: {
        amount: materialCostPerUnit,
        currency,
      },
      totalMaterialCost: {
        amount: totalMaterialCost,
        currency,
      },
      fabricationCostPerUnit: {
        amount: fabricationCostPerUnit,
        currency,
      },
      totalFabricationCost: {
        amount: totalFabricationCost,
        currency,
      },
      serviceCostPerUnit: serviceCosts.serviceCostPerUnit,
      totalServiceCost: serviceCosts.totalServiceCost,
      serviceBreakdown: serviceCosts.serviceBreakdown,
    };
  } catch (error) {
    logger.error('Error calculating item cost', { itemId: item.id, error });
    return null;
  }
}

/**
 * Calculate cost for a BOM item and update it in Firestore
 */
export async function calculateAndUpdateItemCost(
  db: Firestore,
  bomId: string,
  item: BOMItem,
  userId: string
): Promise<void> {
  // rule5-exempt: estimation/BOM write; firestore.rules enforce MANAGE_ESTIMATION on the affected collections — server-side gated
  try {
    const calculation = await calculateItemCost(db, item);

    if (!calculation) {
      logger.debug('No calculation result, skipping update', { itemId: item.id });
      return;
    }

    // Update item with calculated values
    const itemRef = doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, item.id);

    await import('firebase/firestore').then(({ updateDoc, Timestamp }) =>
      updateDoc(itemRef, {
        calculatedProperties: {
          weight: calculation.weight,
          totalWeight: calculation.totalWeight,
        },
        cost: {
          materialCostPerUnit: calculation.materialCostPerUnit,
          totalMaterialCost: calculation.totalMaterialCost,
          fabricationCostPerUnit: calculation.fabricationCostPerUnit,
          totalFabricationCost: calculation.totalFabricationCost,
          serviceCostPerUnit: calculation.serviceCostPerUnit,
          totalServiceCost: calculation.totalServiceCost,
          serviceBreakdown: calculation.serviceBreakdown,
        },
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      })
    );

    logger.info('Item cost updated in Firestore', { itemId: item.id });
  } catch (error) {
    logger.error('Error updating item cost', { itemId: item.id, error });
    throw error;
  }
}

/**
 * Bulk calculate costs for all items in a BOM
 */
export async function calculateAllItemCosts(
  db: Firestore,
  bomId: string,
  items: BOMItem[],
  userId: string
): Promise<void> {
  try {
    logger.info('Calculating costs for all BOM items', { bomId, itemCount: items.length });

    // Calculate costs in parallel for performance
    const calculations = await Promise.allSettled(
      items.map((item) => calculateAndUpdateItemCost(db, bomId, item, userId))
    );

    const successCount = calculations.filter((r) => r.status === 'fulfilled').length;
    const failureCount = calculations.filter((r) => r.status === 'rejected').length;

    logger.info('Bulk cost calculation completed', {
      bomId,
      total: items.length,
      success: successCount,
      failures: failureCount,
    });

    if (failureCount > 0) {
      logger.warn('Some item calculations failed', { bomId, failureCount });
    }
  } catch (error) {
    logger.error('Error in bulk cost calculation', { bomId, error });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current material price
 */
export async function getMaterialPrice(db: Firestore, materialId: string): Promise<number> {
  try {
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));

    if (!materialDoc.exists()) {
      logger.warn('Material not found', { materialId });
      return 0;
    }

    const material = materialDoc.data() as Material;
    return material.currentPrice?.pricePerUnit.amount ?? 0;
  } catch (error) {
    logger.error('Error getting material price', { materialId, error });
    return 0;
  }
}

/**
 * Validate shape parameters against shape definition
 */
export function validateShapeParameters(
  shapeId: string,
  parameters: ShapeParameters
): { valid: boolean; errors: string[] } {
  try {
    const shape = getShapeById(shapeId);

    if (!shape) {
      return { valid: false, errors: ['Shape not found'] };
    }

    const errors: string[] = [];

    // Check all required parameters are provided
    for (const param of shape.parameters) {
      if (param.required && !(param.name in parameters)) {
        errors.push(`Required parameter '${param.label}' is missing`);
      }

      // Check min/max values
      if (param.name in parameters) {
        const value = parameters[param.name];

        if (value !== undefined && param.minValue !== undefined && value < param.minValue) {
          errors.push(`Parameter '${param.label}' is below minimum value (${param.minValue})`);
        }

        if (value !== undefined && param.maxValue !== undefined && value > param.maxValue) {
          errors.push(`Parameter '${param.label}' exceeds maximum value (${param.maxValue})`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    logger.error('Error validating shape parameters', { shapeId, error });
    return { valid: false, errors: ['Validation error occurred'] };
  }
}
