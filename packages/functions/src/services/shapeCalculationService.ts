/**
 * Shape Calculation Service
 * Evaluates shape formulas and calculates dimensions, weights, costs
 */

import type {
  Shape,
  ParameterValue,
  BlankDefinition,
  FabricationCost,
  Material,
  FormulaDefinition,
} from '@vapour/types';
import { evaluateFormula, evaluateFormulas } from './formulaEngineService';
import { getMaterialById } from './materialService';

export interface CalculationInput {
  shapeId: string;
  shape: Shape;
  parameterValues: ParameterValue[];
  materialId: string;
  material?: Material;
  quantity?: number;
}

export interface CalculationResult {
  shapeId: string;
  shapeName: string;
  materialId: string;
  materialName: string;
  quantity: number;

  // Dimensional calculations
  volume?: number;
  volumeUnit?: string;

  surfaceArea?: number;
  surfaceAreaUnit?: string;

  innerSurfaceArea?: number;
  outerSurfaceArea?: number;
  wettedArea?: number;

  // Weight calculations
  weight?: number;
  weightUnit?: string;
  totalWeight?: number;

  // Blank/Material calculations
  blankDimensions?: BlankCalculationResult;
  blankArea?: number;
  blankAreaUnit?: string;
  finishedArea?: number;
  scrapPercentage?: number;
  scrapWeight?: number;

  // Edge and weld calculations
  edgeLength?: number;
  edgeLengthUnit?: string;
  weldLength?: number;
  weldLengthUnit?: string;

  // Cost calculations
  materialCost?: number;
  fabricationCost?: number;
  surfaceTreatmentCost?: number;
  edgePreparationCost?: number;
  cuttingCost?: number;
  weldingCost?: number;
  totalCost?: number;
  costPerUnit?: number;

  // Custom formula results
  customResults?: Record<string, { result: number; unit: string }>;

  // Validation
  warnings?: string[];
  errors?: string[];
}

export interface BlankCalculationResult {
  blankType: 'RECTANGULAR' | 'CIRCULAR' | 'CUSTOM';
  blankLength?: number;
  blankWidth?: number;
  blankDiameter?: number;
  blankThickness?: number;
  blankArea?: number;
  scrapPercentage?: number;
  description?: string;
}

/**
 * Build parameter value map from array
 */
function buildParameterMap(parameterValues: ParameterValue[]): Record<string, number> {
  const map: Record<string, number> = {};

  parameterValues.forEach((param) => {
    if (param.value !== undefined) {
      // Convert value to number (SELECT parameters may have numeric values)
      const numValue =
        typeof param.value === 'number' ? param.value : parseFloat(String(param.value));
      map[param.name] = isNaN(numValue) ? 0 : numValue;
    }
  });

  return map;
}

/**
 * Calculate blank dimensions
 */
function calculateBlankDimensions(
  blankDef: BlankDefinition,
  parameterMap: Record<string, number>,
  density?: number
): BlankCalculationResult {
  const result: BlankCalculationResult = {
    blankType: blankDef.blankType,
    description: blankDef.description,
  };

  try {
    if (blankDef.blankType === 'RECTANGULAR' && blankDef.blankLength && blankDef.blankWidth) {
      const length = evaluateFormula(blankDef.blankLength, parameterMap, density);
      const width = evaluateFormula(blankDef.blankWidth, parameterMap, density);

      result.blankLength = length.result;
      result.blankWidth = width.result;
      result.blankArea = length.result * width.result;
    } else if (blankDef.blankType === 'CIRCULAR' && blankDef.blankDiameter) {
      const diameter = evaluateFormula(blankDef.blankDiameter, parameterMap, density);

      result.blankDiameter = diameter.result;
      result.blankArea = Math.PI * Math.pow(diameter.result / 2, 2);
    }

    // Get blank thickness from parameter map if specified
    if (blankDef.blankThickness && parameterMap[blankDef.blankThickness]) {
      result.blankThickness = parameterMap[blankDef.blankThickness];
    }

    // Calculate scrap percentage
    if (blankDef.scrapFormula) {
      const scrap = evaluateFormula(blankDef.scrapFormula, parameterMap, density);
      result.scrapPercentage = scrap.result;
    }
  } catch (error) {
    console.error('Blank calculation error:', error);
  }

  return result;
}

/**
 * Calculate fabrication costs
 */
function calculateFabricationCosts(
  fabricationCost: FabricationCost | undefined,
  parameterMap: Record<string, number>,
  edgeLength?: number,
  weldLength?: number,
  surfaceArea?: number
): {
  edgePreparationCost?: number;
  cuttingCost?: number;
  weldingCost?: number;
  surfaceTreatmentCost?: number;
  totalFabricationCost: number;
} {
  let edgePreparationCost = 0;
  let cuttingCost = 0;
  let weldingCost = 0;
  let surfaceTreatmentCost = 0;

  if (!fabricationCost) {
    return { totalFabricationCost: 0 };
  }

  try {
    // Edge preparation cost
    if (fabricationCost.edgePreparationCostPerMeter && edgeLength) {
      edgePreparationCost = fabricationCost.edgePreparationCostPerMeter * (edgeLength / 1000); // Convert mm to m
    }

    // Cutting cost
    if (fabricationCost.cuttingCostPerMeter && edgeLength) {
      cuttingCost = fabricationCost.cuttingCostPerMeter * (edgeLength / 1000);
    }

    // Welding cost
    if (fabricationCost.weldingCostPerMeter && weldLength) {
      weldingCost = fabricationCost.weldingCostPerMeter * (weldLength / 1000);
    }

    // Surface treatment cost
    if (fabricationCost.surfaceTreatmentCostPerSqm && surfaceArea) {
      surfaceTreatmentCost = fabricationCost.surfaceTreatmentCostPerSqm * (surfaceArea / 1000000); // Convert mm² to m²
    }
  } catch (error) {
    console.error('Fabrication cost calculation error:', error);
  }

  return {
    edgePreparationCost,
    cuttingCost,
    weldingCost,
    surfaceTreatmentCost,
    totalFabricationCost: edgePreparationCost + cuttingCost + weldingCost + surfaceTreatmentCost,
  };
}

/**
 * Calculate all shape dimensions and costs
 */
export async function calculateShape(input: CalculationInput): Promise<CalculationResult> {
  const { shape, parameterValues, materialId, quantity = 1 } = input;

  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Get material if not provided
    let material: Material | undefined = input.material;
    if (!material) {
      const fetchedMaterial = await getMaterialById(materialId);
      if (!fetchedMaterial) {
        throw new Error(`Material not found: ${materialId}`);
      }
      material = fetchedMaterial;
    }

    // Build parameter map
    const parameterMap = buildParameterMap(parameterValues);
    const density = material.properties?.density;

    // Evaluate all formulas
    const formulaResults = evaluateFormulas(
      shape.formulas as Record<string, any>,
      parameterMap,
      density
    );

    // Collect warnings from formula evaluations
    Object.entries(formulaResults).forEach(([key, result]) => {
      if (result.rangeWarning) {
        warnings.push(result.rangeWarning);
      }
      if (result.error) {
        errors.push(`${key}: ${result.error}`);
      }
    });

    // Extract dimensional results
    const volume = formulaResults.volume?.result;
    const surfaceArea = formulaResults.surfaceArea?.result;
    const innerSurfaceArea = formulaResults.innerSurfaceArea?.result;
    const outerSurfaceArea = formulaResults.outerSurfaceArea?.result;
    const wettedArea = formulaResults.wettedArea?.result;
    const weight = formulaResults.weight?.result;
    const edgeLength = formulaResults.edgeLength?.result;
    const weldLength = formulaResults.weldLength?.result;

    // Calculate blank dimensions
    let blankDimensions: BlankCalculationResult | undefined;
    let blankArea: number | undefined;
    let scrapPercentage: number | undefined;
    let scrapWeight: number | undefined;

    if (shape.formulas.blankDimensions) {
      blankDimensions = calculateBlankDimensions(
        shape.formulas.blankDimensions,
        parameterMap,
        density
      );
      blankArea = blankDimensions.blankArea;
      scrapPercentage = blankDimensions.scrapPercentage;

      // Calculate scrap weight
      if (weight && scrapPercentage) {
        scrapWeight = weight * (scrapPercentage / 100);
      }
    }

    // Calculate costs using latest unit price from material master data.
    // Note: This uses material.currentPrice which reflects the most recent price.
    // It does not account for quantity-based price breaks, date-specific pricing,
    // or supplier-specific rates. For procurement pricing, use the procurement service.
    const pricePerKg = material.currentPrice?.pricePerUnit?.amount || 0;
    const materialCost = weight ? weight * pricePerKg : 0;

    const fabricationCosts = calculateFabricationCosts(
      shape.fabricationCost,
      parameterMap,
      edgeLength,
      weldLength,
      surfaceArea
    );

    const totalCost = materialCost + fabricationCosts.totalFabricationCost;

    const totalWeight = weight ? weight * quantity : undefined;
    const totalCostAll = totalCost * quantity;

    // Build result
    const result: CalculationResult = {
      shapeId: shape.id || '',
      shapeName: shape.name,
      materialId,
      materialName: material.name,
      quantity,

      volume,
      volumeUnit: formulaResults.volume?.unit,

      surfaceArea,
      surfaceAreaUnit: formulaResults.surfaceArea?.unit,

      innerSurfaceArea,
      outerSurfaceArea,
      wettedArea,

      weight,
      weightUnit: formulaResults.weight?.unit,
      totalWeight,

      blankDimensions,
      blankArea,
      blankAreaUnit: 'mm²',
      finishedArea: formulaResults.finishedArea?.result,
      scrapPercentage,
      scrapWeight,

      edgeLength,
      edgeLengthUnit: formulaResults.edgeLength?.unit,
      weldLength,
      weldLengthUnit: formulaResults.weldLength?.unit,

      materialCost,
      fabricationCost: fabricationCosts.totalFabricationCost,
      surfaceTreatmentCost: fabricationCosts.surfaceTreatmentCost,
      edgePreparationCost: fabricationCosts.edgePreparationCost,
      cuttingCost: fabricationCosts.cuttingCost,
      weldingCost: fabricationCosts.weldingCost,
      totalCost: totalCostAll,
      costPerUnit: totalCost,

      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };

    // Add custom formula results
    if (shape.formulas.customFormulas && shape.formulas.customFormulas.length > 0) {
      result.customResults = {};
      shape.formulas.customFormulas.forEach(
        (customFormula: { name: string; formula: FormulaDefinition }) => {
          try {
            const customResult = evaluateFormula(customFormula.formula, parameterMap, density);
            result.customResults![customFormula.name] = {
              result: customResult.result,
              unit: customResult.unit,
            };
          } catch (error) {
            errors.push(
              `Custom formula '${customFormula.name}': ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      );
    }

    return result;
  } catch (error) {
    throw new Error(
      `Shape calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Batch calculate multiple shapes
 */
export async function calculateShapes(inputs: CalculationInput[]): Promise<CalculationResult[]> {
  const results: CalculationResult[] = [];

  for (const input of inputs) {
    try {
      const result = await calculateShape(input);
      results.push(result);
    } catch (error) {
      // Add error result
      results.push({
        shapeId: input.shapeId,
        shapeName: input.shape.name,
        materialId: input.materialId,
        materialName: 'Unknown',
        quantity: input.quantity || 1,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    }
  }

  return results;
}

/**
 * Validate parameter values against shape requirements
 */
export function validateParameterValues(
  shape: Shape,
  parameterValues: ParameterValue[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build parameter map
  const providedParams = new Set(parameterValues.map((p) => p.name));

  // Check required parameters
  shape.parameters.forEach((param: any) => {
    if (param.required && !providedParams.has(param.name)) {
      errors.push(`Required parameter '${param.label}' (${param.name}) is missing`);
    }

    // Check value ranges
    const paramValue = parameterValues.find((p) => p.name === param.name);
    if (paramValue && paramValue.value !== undefined) {
      if (param.minValue !== undefined && paramValue.value < param.minValue) {
        errors.push(
          `Parameter '${param.label}' value ${paramValue.value} is below minimum ${param.minValue}`
        );
      }
      if (param.maxValue !== undefined && paramValue.value > param.maxValue) {
        errors.push(
          `Parameter '${param.label}' value ${paramValue.value} is above maximum ${param.maxValue}`
        );
      }
    }
  });

  // Check for unused parameters
  const shapeParams = new Set(shape.parameters.map((p: any) => p.name));
  parameterValues.forEach((param: any) => {
    if (!shapeParams.has(param.name)) {
      warnings.push(`Unknown parameter '${param.name}' provided`);
    }
  });

  // Run custom validation rules
  if (shape.validationRules) {
    shape.validationRules.forEach((rule: any) => {
      // Validation rule execution would go here
      // For now, just log the rule
      console.log('Validation rule:', rule);
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
