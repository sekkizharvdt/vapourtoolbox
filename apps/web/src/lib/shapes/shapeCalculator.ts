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

  // Filter out non-FormulaDefinition entries (blankDimensions, customFormulas)
  // and only pass FormulaDefinition objects to the evaluator
  const formulasToEvaluate: Record<string, FormulaDefinition> = {};
  for (const [key, value] of Object.entries(shape.formulas)) {
    // Check if the value is a FormulaDefinition (has expression and variables)
    if (value && typeof value === 'object' && 'expression' in value && 'variables' in value) {
      formulasToEvaluate[key] = value as FormulaDefinition;
    }
  }

  // Evaluate all formulas
  const formulaResults = evaluateMultipleFormulas(formulasToEvaluate, context, density);

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

  // Get fabrication rates from shape configuration (with fallback defaults)
  const cuttingRate = shape.fabricationCost?.cuttingCostPerMeter ?? 50; // ₹50 per meter default
  const edgePreparationRate = shape.fabricationCost?.edgePreparationCostPerMeter ?? 100; // ₹100 per meter default
  const weldingRate = shape.fabricationCost?.weldingCostPerMeter ?? 500; // ₹500 per meter default
  const surfaceTreatmentRate = shape.fabricationCost?.surfaceTreatmentCostPerSqm ?? 50; // ₹50 per m² default

  // Individual fabrication costs using configurable rates
  const cuttingCost = perimeter ? calculateCuttingCost(perimeter, cuttingRate) : 0;
  const edgePreparationCost = edgeLength ? calculateEdgeCost(edgeLength, edgePreparationRate) : 0;
  const weldingCost = weldLength
    ? calculateWeldingCost(weldLength, (parameterValues.t as number) || 10, weldingRate)
    : 0;
  const surfaceTreatmentCost = surfaceArea
    ? calculateSurfaceTreatmentCost(surfaceArea, surfaceTreatmentRate)
    : 0;

  // Base fabrication cost (setup + weight-based)
  const baseFabricationCost =
    (shape.fabricationCost?.baseCost || 0) +
    weight * (shape.fabricationCost?.costPerKg || 0) +
    (shape.fabricationCost?.laborHours || 0) * 500; // Assume ₹500/hour labor rate

  // Total fabrication cost = base + all operation costs
  const totalFabricationCost =
    baseFabricationCost + cuttingCost + edgePreparationCost + weldingCost + surfaceTreatmentCost;

  const totalCost = materialCostActual - scrapRecoveryValue + totalFabricationCost;

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
      fabricationCost: totalFabricationCost, // All fabrication costs combined
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
 * Calculate cutting cost based on perimeter length and rate
 * @param perimeter - Perimeter length in mm
 * @param ratePerMeter - Cost per meter in INR
 */
function calculateCuttingCost(perimeter: number, ratePerMeter: number): number {
  return (perimeter / 1000) * ratePerMeter; // Convert mm to meters
}

/**
 * Calculate edge preparation cost
 * @param edgeLength - Edge length in mm
 * @param ratePerMeter - Cost per meter in INR
 */
function calculateEdgeCost(edgeLength: number, ratePerMeter: number): number {
  return (edgeLength / 1000) * ratePerMeter;
}

/**
 * Calculate welding cost based on length, thickness, and base rate
 * Cost increases with thickness due to more weld passes required
 * @param weldLength - Weld length in mm
 * @param thickness - Material thickness in mm
 * @param baseRatePerMeter - Base welding cost per meter in INR
 */
function calculateWeldingCost(
  weldLength: number,
  thickness: number,
  baseRatePerMeter: number
): number {
  // Apply thickness multiplier (thicker materials require more passes)
  const thicknessMultiplier = 1 + (thickness - 10) / 50; // Example: 10mm=1.0x, 20mm=1.2x, 30mm=1.4x
  const effectiveRate = baseRatePerMeter * Math.max(thicknessMultiplier, 0.5); // Minimum 0.5x
  return (weldLength / 1000) * effectiveRate;
}

/**
 * Calculate surface treatment cost (painting, coating, blasting, etc.)
 * @param surfaceArea - Surface area in mm²
 * @param ratePerSqMeter - Cost per square meter in INR
 */
function calculateSurfaceTreatmentCost(surfaceArea: number, ratePerSqMeter: number): number {
  return (surfaceArea / 1000000) * ratePerSqMeter; // Convert mm² to m²
}
