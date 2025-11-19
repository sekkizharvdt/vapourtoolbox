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
import { createLogger } from '@vapour/logger';
import type {
  BOMItem,
  BOMItemCostCalculation,
  Material,
  Shape,
  ShapeParameters,
} from '@vapour/types';

const logger = createLogger({ context: 'bomCalculations' });

// ============================================================================
// Cost Calculation Functions
// ============================================================================

/**
 * Calculate cost for a bought-out item
 *
 * For bought-out items, cost is based directly on material price (no fabrication cost)
 */
export async function calculateBoughtOutItemCost(
  db: Firestore,
  item: BOMItem
): Promise<BOMItemCostCalculation | null> {
  try {
    // Skip if no component or materialId defined
    if (!item.component || !item.component.materialId) {
      logger.debug('Item has no material, skipping cost calculation', {
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

    // Fetch material definition
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, item.component.materialId));
    if (!materialDoc.exists()) {
      logger.warn('Material not found', { materialId: item.component.materialId });
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const material: Material = { id: materialDoc.id, ...materialDoc.data() } as Material;

    // Get material price
    const materialPrice = material.currentPrice?.pricePerUnit.amount || 0;
    const currency = material.currentPrice?.pricePerUnit.currency || 'INR';

    // For bought-out items:
    // - No weight calculation (items are bought complete)
    // - No fabrication cost (no fabrication needed)
    // - Cost is direct from material price
    const weight = 0; // Not applicable for bought-out items
    const materialCostPerUnit = materialPrice;
    const fabricationCostPerUnit = 0; // No fabrication for bought-out items

    // Apply quantity
    const totalWeight = 0;
    const totalMaterialCost = materialCostPerUnit * item.quantity;
    const totalFabricationCost = 0;

    logger.info('Bought-out item cost calculated', {
      itemId: item.id,
      materialCostPerUnit,
      totalMaterialCost,
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

    // Fetch shape definition
    const shapeDoc = await getDoc(doc(db, COLLECTIONS.SHAPES, item.component.shapeId));
    if (!shapeDoc.exists()) {
      logger.warn('Shape not found', { shapeId: item.component.shapeId });
      return null;
    }

    // Fetch material definition
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, item.component.materialId));
    if (!materialDoc.exists()) {
      logger.warn('Material not found', { materialId: item.component.materialId });
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const shape: Shape = { id: shapeDoc.id, ...shapeDoc.data() } as Shape;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const material: Material = { id: materialDoc.id, ...materialDoc.data() } as Material;

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

    logger.info('Item cost calculated', {
      itemId: item.id,
      weight,
      totalWeight,
      materialCostPerUnit,
      totalMaterialCost,
      fabricationCostPerUnit,
      totalFabricationCost,
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
    return material.currentPrice?.pricePerUnit.amount || 0;
  } catch (error) {
    logger.error('Error getting material price', { materialId, error });
    return 0;
  }
}

/**
 * Validate shape parameters against shape definition
 */
export async function validateShapeParameters(
  db: Firestore,
  shapeId: string,
  parameters: ShapeParameters
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const shapeDoc = await getDoc(doc(db, COLLECTIONS.SHAPES, shapeId));

    if (!shapeDoc.exists()) {
      return { valid: false, errors: ['Shape not found'] };
    }

    const shape = shapeDoc.data() as Shape;
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
