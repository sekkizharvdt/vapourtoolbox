/**
 * Plate and Sheet Shape Definitions
 * Category 1: Plates & Sheets (3 shapes)
 * - Rectangular Plate
 * - Circular Plate
 * - Custom Plate
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 1. Rectangular Plate
 * Standard rectangular plate with length, width, and thickness
 */
export const rectangularPlate: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Rectangular Plate',
  description:
    'Standard rectangular plate for general fabrication. Calculates weight, surface area, blank size, scrap percentage, edge preparation, and welding requirements.',
  category: ShapeCategory.PLATE_RECTANGULAR,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'GENERAL',
    standardNumber: 'RECT-PLATE',
    title: 'Standard Rectangular Plate',
  },

  // Parameters
  parameters: [
    {
      name: 'L',
      label: 'Length',
      description: 'Overall length of the plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 2000,
      minValue: 10,
      maxValue: 20000,
      order: 1,
      required: true,
      helpText: 'Length of the finished plate (10-20000 mm)',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'blankLength', 'edgeLength', 'perimeter'],
    },
    {
      name: 'W',
      label: 'Width',
      description: 'Overall width of the plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1500,
      minValue: 10,
      maxValue: 20000,
      order: 2,
      required: true,
      helpText: 'Width of the finished plate (10-20000 mm)',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'blankWidth', 'edgeLength', 'perimeter'],
    },
    {
      name: 't',
      label: 'Thickness',
      description: 'Plate thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 0.5,
      maxValue: 500,
      order: 3,
      required: true,
      helpText: 'Plate thickness (0.5-500 mm)',
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'allowance',
      label: 'Cutting Allowance',
      description: 'Additional material allowance for cutting and edge preparation',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 0,
      maxValue: 100,
      order: 4,
      required: false,
      helpText: 'Extra material around the perimeter for cutting (typically 5-20 mm)',
      usedInFormulas: ['blankLength', 'blankWidth', 'scrapPercentage'],
    },
  ],

  // Compatible materials
  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  // Formulas
  formulas: {
    // Volume in mm³
    volume: {
      expression: 'L * W * t',
      variables: ['L', 'W', 't'],
      unit: 'mm³',
      description: 'Plate volume',
      expectedRange: {
        min: 0,
        max: 1e12, // 1 million cm³
        warning: 'Volume seems unusually large',
      },
    },

    // Weight in kg
    weight: {
      expression: '(L * W * t * density) / 1000000000',
      variables: ['L', 'W', 't'],
      unit: 'kg',
      description: 'Plate weight (requires material density)',
      requiresDensity: true,
      expectedRange: {
        min: 0,
        max: 100000, // 100 tons
        warning: 'Weight seems unusually high',
      },
    },

    // Surface area (both sides)
    surfaceArea: {
      expression: '2 * L * W',
      variables: ['L', 'W'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
      expectedRange: {
        min: 0,
        max: 1e9,
      },
    },

    // Outer surface area (same as surface area for flat plate)
    outerSurfaceArea: {
      expression: 'L * W',
      variables: ['L', 'W'],
      unit: 'mm²',
      description: 'Outer surface area (one face)',
    },

    // Inner surface area (same as outer for flat plate)
    innerSurfaceArea: {
      expression: 'L * W',
      variables: ['L', 'W'],
      unit: 'mm²',
      description: 'Inner surface area (one face)',
    },

    // Perimeter (for cutting cost calculation)
    perimeter: {
      expression: '2 * (L + W)',
      variables: ['L', 'W'],
      unit: 'mm',
      description: 'Perimeter for cutting operations',
    },

    // Edge length (for edge preparation)
    edgeLength: {
      expression: '2 * (L + W)',
      variables: ['L', 'W'],
      unit: 'mm',
      description: 'Perimeter of the plate',
    },

    // Blank dimensions
    blankDimensions: {
      blankType: 'RECTANGULAR',
      blankLength: {
        expression: 'L + 2 * allowance',
        variables: ['L', 'allowance'],
        unit: 'mm',
        description: 'Blank length including cutting allowance',
      },
      blankWidth: {
        expression: 'W + 2 * allowance',
        variables: ['W', 'allowance'],
        unit: 'mm',
        description: 'Blank width including cutting allowance',
      },
      blankThickness: 't',
      scrapFormula: {
        expression: '((L + 2*allowance) * (W + 2*allowance) - L * W) / (L * W) * 100',
        variables: ['L', 'W', 'allowance'],
        unit: '%',
        description: 'Scrap percentage from cutting allowance',
      },
      description: 'Rectangular blank from standard plate sizes (1.5m×6m or 2m×6m)',
    },

    // Custom formulas
    customFormulas: [
      {
        name: 'perimeter',
        label: 'Perimeter',
        formula: {
          expression: '2 * (L + W)',
          variables: ['L', 'W'],
          unit: 'mm',
          description: 'Plate perimeter',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'area',
        label: 'Area (single face)',
        formula: {
          expression: 'L * W',
          variables: ['L', 'W'],
          unit: 'mm²',
          description: 'Single face area',
        },
        displayInResults: true,
        order: 2,
      },
    ],
  },

  // Fabrication costs
  fabricationCost: {
    edgePreparationCostPerMeter: 50, // ₹50 per meter
    cuttingCostPerMeter: 30, // ₹30 per meter
    surfaceTreatmentCostPerSqm: 100, // ₹100 per sq meter
  },

  // Metadata
  tags: ['plate', 'rectangular', 'standard', 'sheet'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  // Visualization
  imageUrl: '',
  threeDModelUrl: '',
  sketchUrl: '',

  // Validation rules
  validationRules: [
    {
      field: 'L',
      rule: 'LENGTH_GT_WIDTH',
      errorMessage: 'By convention, length should be greater than or equal to width',
      severity: 'warning',
    },
  ],
};

/**
 * 2. Circular Plate
 * Standard circular plate/disc with diameter and thickness
 */
export const circularPlate: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Circular Plate',
  description:
    'Standard circular plate or disc for heads, flanges, or general fabrication. Calculates weight, surface area, blank size, circumference, and cutting requirements.',
  category: ShapeCategory.PLATE_CIRCULAR,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'GENERAL',
    standardNumber: 'CIRC-PLATE',
    title: 'Standard Circular Plate',
  },

  // Parameters
  parameters: [
    {
      name: 'D',
      label: 'Diameter',
      description: 'Overall diameter of the circular plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 10,
      maxValue: 10000,
      order: 1,
      required: true,
      helpText: 'Diameter of the finished circular plate (10-10000 mm)',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'blankDiameter', 'circumference', 'area'],
    },
    {
      name: 't',
      label: 'Thickness',
      description: 'Plate thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 0.5,
      maxValue: 500,
      order: 2,
      required: true,
      helpText: 'Plate thickness (0.5-500 mm)',
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'allowance',
      label: 'Cutting Allowance',
      description: 'Additional material allowance for cutting',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 0,
      maxValue: 100,
      order: 3,
      required: false,
      helpText: 'Extra material around the perimeter for cutting (typically 5-20 mm)',
      usedInFormulas: ['blankDiameter', 'scrapPercentage'],
    },
  ],

  // Compatible materials
  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  // Formulas
  formulas: {
    // Volume in mm³
    volume: {
      expression: 'pi * (D/2)^2 * t',
      variables: ['D', 't'],
      unit: 'mm³',
      description: 'Circular plate volume',
      expectedRange: {
        min: 0,
        max: 1e12,
      },
    },

    // Weight in kg
    weight: {
      expression: '(pi * (D/2)^2 * t * density) / 1000000000',
      variables: ['D', 't'],
      unit: 'kg',
      description: 'Circular plate weight (requires material density)',
      requiresDensity: true,
      expectedRange: {
        min: 0,
        max: 100000,
      },
    },

    // Surface area (both sides)
    surfaceArea: {
      expression: '2 * pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
    },

    // Outer surface area
    outerSurfaceArea: {
      expression: 'pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Outer surface area (one face)',
    },

    // Inner surface area
    innerSurfaceArea: {
      expression: 'pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Inner surface area (one face)',
    },

    // Circumference/edge length
    edgeLength: {
      expression: 'pi * D',
      variables: ['D'],
      unit: 'mm',
      description: 'Circumference of the circular plate',
    },

    // Blank dimensions
    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'D + 2 * allowance',
        variables: ['D', 'allowance'],
        unit: 'mm',
        description: 'Blank diameter including cutting allowance',
      },
      blankThickness: 't',
      scrapFormula: {
        expression: '(pi * ((D + 2*allowance)/2)^2 - pi * (D/2)^2) / (pi * (D/2)^2) * 100',
        variables: ['D', 'allowance'],
        unit: '%',
        description: 'Scrap percentage from cutting allowance',
      },
      description:
        'Circular blank cut from rectangular plate (typically results in significant scrap)',
    },

    // Custom formulas
    customFormulas: [
      {
        name: 'circumference',
        label: 'Circumference',
        formula: {
          expression: 'pi * D',
          variables: ['D'],
          unit: 'mm',
          description: 'Circumference',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'area',
        label: 'Area (single face)',
        formula: {
          expression: 'pi * (D/2)^2',
          variables: ['D'],
          unit: 'mm²',
          description: 'Single face area',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'blankSquareSize',
        label: 'Square Blank Size',
        formula: {
          expression: 'D + 2 * allowance',
          variables: ['D', 'allowance'],
          unit: 'mm',
          description: 'Minimum square blank size needed',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  // Fabrication costs
  fabricationCost: {
    cuttingCostPerMeter: 50, // Higher cost for circular cutting (plasma/laser)
    edgePreparationCostPerMeter: 40,
    surfaceTreatmentCostPerSqm: 100,
  },

  // Metadata
  tags: ['plate', 'circular', 'disc', 'standard', 'round'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'D',
      rule: 'DIAMETER_PRACTICAL',
      errorMessage: 'Very large diameters may require special handling and cutting equipment',
      severity: 'warning',
    },
  ],
};

/**
 * 3. Custom Plate
 * Custom-shaped plate with user-defined area and perimeter
 */
export const customPlate: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Custom Plate',
  description:
    'Custom-shaped plate for irregular geometries. User provides area and perimeter measurements from CAD or manual calculation.',
  category: ShapeCategory.PLATE_CUSTOM,
  shapeType: 'CUSTOM',

  // Parameters
  parameters: [
    {
      name: 'area',
      label: 'Plate Area',
      description: 'Total area of the custom plate shape',
      unit: 'mm²',
      dataType: 'NUMBER',
      minValue: 100,
      maxValue: 1e9,
      order: 1,
      required: true,
      helpText: 'Total area from CAD or manual calculation',
      usedInFormulas: ['volume', 'weight', 'surfaceArea'],
    },
    {
      name: 'perimeter',
      label: 'Perimeter',
      description: 'Total perimeter/edge length of the custom plate',
      unit: 'mm',
      dataType: 'NUMBER',
      minValue: 10,
      maxValue: 1e6,
      order: 2,
      required: true,
      helpText: 'Total edge length from CAD or manual measurement',
      usedInFormulas: ['edgeLength'],
    },
    {
      name: 't',
      label: 'Thickness',
      description: 'Plate thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 0.5,
      maxValue: 500,
      order: 3,
      required: true,
      helpText: 'Plate thickness (0.5-500 mm)',
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'scrapPct',
      label: 'Scrap Percentage',
      description: 'Estimated scrap percentage from cutting',
      unit: '%',
      dataType: 'NUMBER',
      defaultValue: 25,
      minValue: 0,
      maxValue: 80,
      order: 4,
      required: false,
      helpText: 'Estimated material waste (typically 15-35% for custom shapes)',
      usedInFormulas: ['scrapPercentage'],
    },
  ],

  // Compatible materials
  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  // Formulas
  formulas: {
    // Volume in mm³
    volume: {
      expression: 'area * t',
      variables: ['area', 't'],
      unit: 'mm³',
      description: 'Custom plate volume',
    },

    // Weight in kg
    weight: {
      expression: '(area * t * density) / 1000000000',
      variables: ['area', 't'],
      unit: 'kg',
      description: 'Custom plate weight (requires material density)',
      requiresDensity: true,
    },

    // Surface area (both sides)
    surfaceArea: {
      expression: '2 * area',
      variables: ['area'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
    },

    // Outer surface area
    outerSurfaceArea: {
      expression: 'area',
      variables: ['area'],
      unit: 'mm²',
      description: 'Outer surface area (one face)',
    },

    // Inner surface area
    innerSurfaceArea: {
      expression: 'area',
      variables: ['area'],
      unit: 'mm²',
      description: 'Inner surface area (one face)',
    },

    // Edge length
    edgeLength: {
      expression: 'perimeter',
      variables: ['perimeter'],
      unit: 'mm',
      description: 'Total edge length',
    },

    // Scrap percentage
    scrapPercentage: {
      expression: 'scrapPct',
      variables: ['scrapPct'],
      unit: '%',
      description: 'Estimated scrap percentage',
    },
  },

  // Fabrication costs
  fabricationCost: {
    cuttingCostPerMeter: 60, // Higher cost for custom cutting
    edgePreparationCostPerMeter: 50,
    surfaceTreatmentCostPerSqm: 100,
  },

  // Metadata
  tags: ['plate', 'custom', 'irregular', 'cad'],
  isStandard: false,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'scrapPct',
      rule: 'SCRAP_REASONABLE',
      errorMessage: 'Scrap percentage above 50% indicates inefficient material usage',
      severity: 'warning',
    },
  ],
};

/**
 * Export all plate shapes
 */
export const plateShapes = [rectangularPlate, circularPlate, customPlate];
