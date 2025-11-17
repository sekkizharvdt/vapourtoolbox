/**
 * Shape Calculation Service
 *
 * Performs complete shape calculations including weight, volume, surface areas,
 * blank requirements, and cost estimation.
 */

import { evaluateMultipleFormulas, type EvaluationContext } from './formulaEvaluator';
import type { Shape, Material, ShapeInstance } from '@vapour/types';

// Type alias for calculation result
type ShapeCalculationResult = Omit<
  ShapeInstance,
  'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'
>;

export interface CalculateShapeInput {
  shape: Shape;
  material: Material;
  parameterValues: Record<string, number>;
  quantity?: number;
}

/**
 * Calculate all properties for a shape instance
 *
 * @param input - Shape, material, and parameter values
 * @returns Complete calculation results
 */
export function calculateShape(input: CalculateShapeInput): ShapeCalculationResult {
  const { shape, material, parameterValues, quantity = 1 } = input;

  // Get material density (default to 7850 kg/m³ for steel if not specified)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const density = (material as any).physicalProperties?.density || 7850;

  // Build evaluation context
  const context: EvaluationContext = { ...parameterValues };

  // Evaluate all formulas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formulaResults = evaluateMultipleFormulas(shape.formulas as any, context, density);

  // Extract key results
  const volume = formulaResults.volume?.result || 0;
  const weight = formulaResults.weight?.result || 0;
  const surfaceArea = formulaResults.surfaceArea?.result || 0;
  const innerSurfaceArea = formulaResults.innerSurfaceArea?.result;
  const outerSurfaceArea = formulaResults.outerSurfaceArea?.result;
  const wettedArea = formulaResults.wettedArea?.result;

  // Blank/scrap calculations
  const blankArea = formulaResults.blankArea?.result;
  const finishedArea = formulaResults.finishedArea?.result;
  const scrapPercentage = formulaResults.scrapPercentage?.result;

  // Edge and weld calculations
  const edgeLength = formulaResults.edgeLength?.result;
  const weldLength = formulaResults.weldLength?.result;
  const perimeter = formulaResults.perimeter?.result;

  // Calculate costs
  const materialCost = calculateMaterialCost(weight, material, blankArea, finishedArea);
  const fabricationCost = calculateFabricationCost(shape, {
    weight,
    surfaceArea,
    edgeLength,
    weldLength,
    perimeter,
  });

  const totalCost = materialCost + fabricationCost;

  // Calculate quantity-based totals
  const totalWeight = weight * quantity;
  const totalCostWithQuantity = totalCost * quantity;

  // Build result
  const result: any = {
    shapeId: shape.id!,
    shapeName: shape.name,
    shapeCategory: shape.category,
    materialId: material.id!,
    materialName: material.name,
    materialDensity: density,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    materialPricePerKg: (material as any).pricingDetails?.basePrice || 0,

    // Parameter values
    parameterValues: Object.entries(parameterValues).map(([name, value]) => {
      const param = shape.parameters.find((p) => p.name === name);
      return {
        parameterName: name,
        value,
        unit: param?.unit || '',
      };
    }),

    // Calculated values
    calculatedValues: {
      volume,
      volumeUnit: 'mm³',
      weight,
      weightUnit: 'kg',
      surfaceArea,
      surfaceAreaUnit: 'mm²',
      ...(innerSurfaceArea !== undefined && {
        innerSurfaceArea,
        innerSurfaceAreaUnit: 'mm²',
      }),
      ...(outerSurfaceArea !== undefined && {
        outerSurfaceArea,
        outerSurfaceAreaUnit: 'mm²',
      }),
      ...(wettedArea !== undefined && {
        wettedArea,
        wettedAreaUnit: 'mm²',
      }),
      ...(blankArea !== undefined &&
        finishedArea !== undefined && {
          blankArea,
          blankAreaUnit: 'mm²',
          finishedArea,
          finishedAreaUnit: 'mm²',
        }),
      ...(scrapPercentage !== undefined && {
        scrapPercentage,
        scrapWeight: ((blankArea! - finishedArea!) * density * (parameterValues.t || 0)) / 1000000,
      }),
      ...(edgeLength !== undefined && {
        edgeLength,
        edgeLengthUnit: 'mm',
      }),
      ...(weldLength !== undefined && {
        weldLength,
        weldLengthUnit: 'mm',
      }),
      ...(perimeter !== undefined && {
        perimeter,
        perimeterUnit: 'mm',
      }),
    },

    // Cost estimation
    costEstimate: {
      materialCost,
      fabricationCost,
      totalCost,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      currency: (material as any).pricingDetails?.currency || 'INR',
      costBreakdown: {
        // Detailed breakdown can be added here
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        baseMaterialCost: weight * ((material as any).pricingDetails?.basePrice || 0),
        scrapCost:
          blankArea && finishedArea
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((blankArea - finishedArea) *
                density *
                (parameterValues.t || 0) *
                ((material as any).pricingDetails?.basePrice || 0)) /
              1000000
            : 0,
        ...(edgeLength && { edgePreparationCost: calculateEdgeCost(edgeLength) }),
        ...(weldLength && {
          weldingCost: calculateWeldingCost(weldLength, parameterValues.t || 0),
        }),
        ...(surfaceArea && { surfaceTreatmentCost: calculateSurfaceTreatmentCost(surfaceArea) }),
      },
    },

    // Quantity
    quantity,
    totalWeight,
    totalCost: totalCostWithQuantity,
  };

  return result;
}

/**
 * Calculate material cost including blank and scrap
 */
function calculateMaterialCost(
  weight: number,
  material: Material,
  blankArea?: number,
  finishedArea?: number
): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const basePrice = (material as any).pricingDetails?.basePrice || 0;

  // If blank/scrap calculation available, use actual blank material
  if (blankArea && finishedArea) {
    // Calculate blank weight (this is simplified - would need thickness and density)
    // For now, use the weight ratio
    const scrapRatio = (blankArea - finishedArea) / finishedArea;
    const totalMaterialWeight = weight * (1 + scrapRatio);
    return totalMaterialWeight * basePrice;
  }

  // Otherwise use finished weight
  return weight * basePrice;
}

/**
 * Calculate fabrication cost based on shape properties
 */
function calculateFabricationCost(
  shape: Shape,
  properties: {
    weight: number;
    surfaceArea?: number;
    edgeLength?: number;
    weldLength?: number;
    perimeter?: number;
  }
): number {
  let cost = 0;

  // Use shape-specific fabrication formula if available
  if (shape.fabricationCost?.formula) {
    // TODO: Evaluate fabrication formula
    // For now, use simple heuristics
  }

  // Simple cost heuristics
  if (shape.fabricationCost) {
    cost += shape.fabricationCost.baseCost || 0;
    cost += properties.weight * (shape.fabricationCost.costPerKg || 0);
    cost +=
      ((properties.surfaceArea || 0) * (shape.fabricationCost.costPerSurfaceArea || 0)) / 1000000; // Convert mm² to m²
  }

  // Add cutting cost
  if (properties.perimeter) {
    cost += calculateCuttingCost(properties.perimeter);
  }

  // Add edge preparation cost
  if (properties.edgeLength) {
    cost += calculateEdgeCost(properties.edgeLength);
  }

  // Add welding cost
  if (properties.weldLength) {
    cost += calculateWeldingCost(properties.weldLength, 10); // Assuming 10mm thickness for now
  }

  return cost;
}

/**
 * Calculate cutting cost per mm of perimeter
 */
function calculateCuttingCost(perimeter: number): number {
  // ₹0.05 per mm of cutting (example rate)
  return (perimeter / 1000) * 0.05; // Convert to meters
}

/**
 * Calculate edge preparation cost
 */
function calculateEdgeCost(edgeLength: number): number {
  // ₹0.1 per mm of edge preparation (example rate)
  return (edgeLength / 1000) * 0.1;
}

/**
 * Calculate welding cost based on length and thickness
 */
function calculateWeldingCost(weldLength: number, thickness: number): number {
  // Cost increases with thickness (more passes required)
  const ratePerMm = 0.5 + thickness * 0.05; // ₹0.5 base + ₹0.05 per mm thickness
  return (weldLength / 1000) * ratePerMm;
}

/**
 * Calculate surface treatment cost (painting, coating, etc.)
 */
function calculateSurfaceTreatmentCost(surfaceArea: number): number {
  // ₹50 per m² (example rate)
  return (surfaceArea / 1000000) * 50;
}
