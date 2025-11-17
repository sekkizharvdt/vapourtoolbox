/**
 * Shape Calculation Service
 *
 * Performs complete shape calculations including weight, volume, surface areas,
 * blank requirements, and cost estimation.
 */

import { evaluateMultipleFormulas, type EvaluationContext } from './formulaEvaluator';
import type { Shape, Material, ShapeInstance, FormulaDefinition } from '@vapour/types';

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
  const density = material.properties.density || 7850;

  // Build evaluation context
  const context: EvaluationContext = { ...parameterValues };

  // Evaluate all formulas
  const formulaResults = evaluateMultipleFormulas(
    shape.formulas as unknown as Record<string, FormulaDefinition>,
    context,
    density
  );

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

  // Calculate individual cost components
  const basePrice = material.currentPrice?.pricePerUnit.amount || 0;
  const materialCost = weight * basePrice; // Finished weight cost

  // Calculate scrap weight and costs
  let scrapWeight = 0;
  let materialCostActual = materialCost;
  let scrapRecoveryValue = 0;

  if (blankArea && finishedArea && parameterValues.t) {
    const thickness = parameterValues.t as number;
    scrapWeight = ((blankArea - finishedArea) * density * thickness) / 1000000; // Convert mm³ to kg
    materialCostActual = (weight + scrapWeight) * basePrice;
    scrapRecoveryValue = scrapWeight * basePrice * 0.3; // Assume 30% recovery value
  }

  // Individual fabrication costs
  const cuttingCost = perimeter ? calculateCuttingCost(perimeter) : 0;
  const edgePreparationCost = edgeLength ? calculateEdgeCost(edgeLength) : 0;
  const weldingCost = weldLength
    ? calculateWeldingCost(weldLength, (parameterValues.t as number) || 10)
    : 0;
  const surfaceTreatmentCost = surfaceArea ? calculateSurfaceTreatmentCost(surfaceArea) : 0;

  // Fabrication cost (base + weight-based + other costs)
  const fabricationCost =
    (shape.fabricationCost?.baseCost || 0) + weight * (shape.fabricationCost?.costPerKg || 0);

  const totalCost =
    materialCostActual -
    scrapRecoveryValue +
    fabricationCost +
    cuttingCost +
    edgePreparationCost +
    weldingCost +
    surfaceTreatmentCost;

  // Calculate quantity-based totals
  const totalWeight = weight * quantity;
  const totalCostWithQuantity = totalCost * quantity;

  // Build result
  const result = {
    shapeId: shape.id,
    shapeName: shape.name,
    shapeCategory: shape.category,
    materialId: material.id,
    materialName: material.name,
    materialDensity: density,
    materialPricePerKg: material.currentPrice?.pricePerUnit.amount || 0,

    // Parameter values
    parameterValues: Object.entries(parameterValues).map(([name, value]) => {
      const param = shape.parameters.find((p) => p.name === name);
      return {
        name, // Alias for parameterName
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
      materialCost, // Finished weight × price
      materialCostActual, // Blank weight × price (including scrap)
      scrapRecoveryValue, // Negative value for recovery
      fabricationCost, // Base + weight-based fabrication cost
      surfaceTreatmentCost,
      edgePreparationCost,
      cuttingCost,
      weldingCost,
      totalCost,
      currency: material.currentPrice?.currency || 'INR',
      effectiveCostPerKg: weight > 0 ? totalCost / weight : 0,
    },

    // Quantity
    quantity,
    totalWeight,
    totalCost: totalCostWithQuantity,
  };

  return result;
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
