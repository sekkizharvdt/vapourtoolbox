/**
 * Tube Shape Definitions
 * Category 2: Tubes (1 shape)
 * - Straight Tube (custom fabricated, not catalog pipe)
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 1. Straight Tube
 * Custom-fabricated straight tube with specified OD, thickness, and length
 * Different from catalog pipes - this is for custom dimensions
 */
export const straightTube: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Straight Tube',
  description:
    'Custom-fabricated straight tube for special applications requiring non-standard dimensions. For standard pipes, use the Materials Database. Calculates volume, weight, surface areas, and blank plate requirements for tube rolling.',
  category: ShapeCategory.TUBE_STRAIGHT,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'CUSTOM',
    standardNumber: 'TUBE-STRAIGHT',
    code: 'CUSTOM TUBE-STRAIGHT',
    title: 'Custom Fabricated Straight Tube',
  },

  // Parameters
  parameters: [
    {
      name: 'OD',
      label: 'Outer Diameter',
      description: 'Outside diameter of the tube',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 500,
      minValue: 50,
      maxValue: 5000,
      order: 1,
      required: true,
      helpText: 'Tube outer diameter (50-5000 mm)',
      usedInFormulas: [
        'volume',
        'weight',
        'outerSurfaceArea',
        'innerSurfaceArea',
        'blankWidth',
        'outerCircumference',
      ],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Tube wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 1,
      maxValue: 100,
      order: 2,
      required: true,
      helpText: 'Wall thickness (1-100 mm)',
      usedInFormulas: ['volume', 'weight', 'innerSurfaceArea', 'ID', 'innerCircumference'],
    },
    {
      name: 'L',
      label: 'Length',
      description: 'Tube length',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 3000,
      minValue: 100,
      maxValue: 20000,
      order: 3,
      required: true,
      helpText: 'Tube length (100-20000 mm)',
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea', 'innerSurfaceArea', 'blankLength'],
    },
    {
      name: 'weldAllowance',
      label: 'Weld Seam Allowance',
      description: 'Additional width for longitudinal weld seam overlap',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 20,
      minValue: 5,
      maxValue: 100,
      order: 4,
      required: false,
      helpText: 'Extra material for weld seam (typically 10-30 mm)',
      usedInFormulas: ['blankWidth', 'scrapPercentage', 'weldLength'],
    },
    {
      name: 'lengthAllowance',
      label: 'Length Allowance',
      description: 'Additional length for end trimming',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 0,
      maxValue: 500,
      order: 5,
      required: false,
      helpText: 'Extra length for squaring ends (typically 25-100 mm)',
      usedInFormulas: ['blankLength', 'scrapPercentage'],
    },
  ],

  // Compatible materials (plates that can be rolled into tubes)
  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  // Formulas
  formulas: {
    // Volume in mm³ (hollow cylinder)
    volume: {
      expression: 'pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L',
      variables: ['OD', 't', 'L'],
      unit: 'mm³',
      description: 'Tube volume (hollow cylinder)',
      expectedRange: {
        min: 0,
        max: 1e12,
      },
    },

    // Weight in kg
    weight: {
      expression: '(pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L * density) / 1000000',
      variables: ['OD', 't', 'L'],
      unit: 'kg',
      description: 'Tube weight (requires material density)',
      requiresDensity: true,
      expectedRange: {
        min: 0,
        max: 50000,
      },
    },

    // Outer surface area
    outerSurfaceArea: {
      expression: 'pi * OD * L',
      variables: ['OD', 'L'],
      unit: 'mm²',
      description: 'Outer surface area (external)',
    },

    // Inner surface area
    innerSurfaceArea: {
      expression: 'pi * (OD - 2*t) * L',
      variables: ['OD', 't', 'L'],
      unit: 'mm²',
      description: 'Inner surface area (internal)',
    },

    // Total surface area (outer + inner + ends)
    surfaceArea: {
      expression: 'pi * OD * L + pi * (OD - 2*t) * L + 2 * pi * ((OD/2)^2 - ((OD - 2*t)/2)^2)',
      variables: ['OD', 't', 'L'],
      unit: 'mm²',
      description: 'Total surface area (outer + inner + both ends)',
    },

    // Wetted area (inner surface only, for process calculations)
    wettedArea: {
      expression: 'pi * (OD - 2*t) * L',
      variables: ['OD', 't', 'L'],
      unit: 'mm²',
      description: 'Wetted surface area (inner surface)',
    },

    // Longitudinal weld length
    weldLength: {
      expression: 'L',
      variables: ['L'],
      unit: 'mm',
      description: 'Longitudinal weld seam length',
    },

    // Blank dimensions (rectangular plate to be rolled)
    blankDimensions: {
      blankType: 'RECTANGULAR',
      blankLength: {
        expression: 'L + lengthAllowance',
        variables: ['L', 'lengthAllowance'],
        unit: 'mm',
        description: 'Blank length including end trimming allowance',
      },
      blankWidth: {
        expression: 'pi * (OD - t) + weldAllowance',
        variables: ['OD', 't', 'weldAllowance'],
        unit: 'mm',
        description: 'Blank width (developed length at neutral axis + weld allowance)',
      },
      blankThickness: 't',
      scrapFormula: {
        expression:
          '(((L + lengthAllowance) * (pi * (OD - t) + weldAllowance)) - (pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L / t)) / (pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L / t) * 100',
        variables: ['OD', 't', 'L', 'weldAllowance', 'lengthAllowance'],
        unit: '%',
        description: 'Scrap percentage from allowances',
      },
      description:
        'Rectangular plate blank for rolling into tube with longitudinal weld seam. Width calculated at neutral axis (OD - t).',
    },

    // Custom formulas
    customFormulas: [
      {
        name: 'ID',
        label: 'Inner Diameter',
        formula: {
          expression: 'OD - 2*t',
          variables: ['OD', 't'],
          unit: 'mm',
          description: 'Inner diameter',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'outerCircumference',
        label: 'Outer Circumference',
        formula: {
          expression: 'pi * OD',
          variables: ['OD'],
          unit: 'mm',
          description: 'Outer circumference',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'innerCircumference',
        label: 'Inner Circumference',
        formula: {
          expression: 'pi * (OD - 2*t)',
          variables: ['OD', 't'],
          unit: 'mm',
          description: 'Inner circumference',
        },
        displayInResults: true,
        order: 3,
      },
      {
        name: 'crossSectionalArea',
        label: 'Cross-sectional Area',
        formula: {
          expression: 'pi * ((OD/2)^2 - ((OD - 2*t)/2)^2)',
          variables: ['OD', 't'],
          unit: 'mm²',
          description: 'Metal cross-sectional area',
        },
        displayInResults: true,
        order: 4,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: 'pi * ((OD - 2*t)/2)^2 * L',
          variables: ['OD', 't', 'L'],
          unit: 'mm³',
          description: 'Internal cavity volume',
        },
        displayInResults: true,
        order: 5,
      },
      {
        name: 'DtoTRatio',
        label: 'D/t Ratio',
        formula: {
          expression: 'OD / t',
          variables: ['OD', 't'],
          unit: '',
          description: 'Diameter to thickness ratio (important for buckling)',
        },
        displayInResults: true,
        order: 6,
      },
    ],
  },

  // Fabrication costs
  fabricationCost: {
    edgePreparationCostPerMeter: 60, // Edge prep for weld seam
    cuttingCostPerMeter: 40, // Cutting plate to size
    weldingCostPerMeter: 150, // Longitudinal welding cost
    surfaceTreatmentCostPerSqm: 120,
  },

  // Metadata
  tags: ['tube', 'pipe', 'cylinder', 'rolled', 'custom', 'fabricated'],
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
      field: 'DtoTRatio',
      rule: 'D_TO_T_RATIO',
      errorMessage:
        'D/t ratio > 100 may indicate thin-walled tube requiring special forming considerations',
      severity: 'warning',
    },
    {
      field: 't',
      rule: 'THICKNESS_VS_DIAMETER',
      errorMessage: 'Wall thickness should typically be at least 1% of OD for structural integrity',
      severity: 'info',
    },
  ],
};

/**
 * Export all tube shapes
 */
export const tubeShapes = [straightTube];
