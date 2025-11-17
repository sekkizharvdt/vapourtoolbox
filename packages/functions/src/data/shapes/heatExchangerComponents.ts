/**
 * Heat Exchanger Component Shape Definitions
 * Category 4: Heat Exchanger Components (4 shapes)
 * Compliant with TEMA Standards
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 1. HX Tube Bundle
 * Heat exchanger tube bundle assembly
 */
export const hxTubeBundle: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'HX Tube Bundle',
  description:
    'Heat exchanger tube bundle for shell & tube heat exchangers. Calculates total tube material weight and surface area for heat transfer.',
  category: ShapeCategory.HX_TUBE_BUNDLE,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'TEMA',
    standardNumber: 'TEMA-TUBE-BUNDLE',
    title: 'Heat Exchanger Tube Bundle',
  },

  parameters: [
    {
      name: 'OD',
      label: 'Tube Outer Diameter',
      description: 'Outside diameter of individual tubes',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 25.4,
      minValue: 10,
      maxValue: 100,
      order: 1,
      required: true,
      helpText: 'Common sizes: 15.9mm (5/8"), 19.05mm (3/4"), 25.4mm (1")',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'totalTubeLength'],
    },
    {
      name: 't',
      label: 'Tube Wall Thickness',
      description: 'Tube wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 2,
      minValue: 0.5,
      maxValue: 10,
      order: 2,
      required: true,
      helpText: 'Common BWG: BWG 14 (2.11mm), BWG 16 (1.65mm)',
      usedInFormulas: ['volume', 'weight', 'innerSurfaceArea'],
    },
    {
      name: 'L',
      label: 'Tube Length',
      description: 'Length of individual tubes',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 3000,
      minValue: 500,
      maxValue: 12000,
      order: 3,
      required: true,
      helpText: 'Standard lengths: 3m, 4m, 6m',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'innerSurfaceArea', 'totalTubeLength'],
    },
    {
      name: 'N',
      label: 'Number of Tubes',
      description: 'Total number of tubes in bundle',
      unit: 'tubes',
      dataType: 'NUMBER',
      defaultValue: 100,
      minValue: 1,
      maxValue: 10000,
      order: 4,
      required: true,
      helpText: 'Total tube count in bundle',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'totalTubeLength'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PIPES_CARBON_STEEL,
    MaterialCategory.PIPES_STAINLESS_304L,
    MaterialCategory.PIPES_STAINLESS_316L,
  ],
  defaultMaterialCategory: MaterialCategory.PIPES_STAINLESS_316L,

  formulas: {
    volume: {
      expression: 'N * pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L',
      variables: ['OD', 't', 'L', 'N'],
      unit: 'mm³',
      description: 'Total tube bundle material volume',
    },

    weight: {
      expression: '(N * pi * ((OD/2)^2 - ((OD - 2*t)/2)^2) * L * density) / 1000000',
      variables: ['OD', 't', 'L', 'N'],
      unit: 'kg',
      description: 'Total tube bundle weight',
      requiresDensity: true,
    },

    outerSurfaceArea: {
      expression: 'N * pi * OD * L',
      variables: ['OD', 'L', 'N'],
      unit: 'mm²',
      description: 'Total tube outer surface area (shell-side heat transfer)',
    },

    innerSurfaceArea: {
      expression: 'N * pi * (OD - 2*t) * L',
      variables: ['OD', 't', 'L', 'N'],
      unit: 'mm²',
      description: 'Total tube inner surface area (tube-side heat transfer)',
    },

    surfaceArea: {
      expression: 'N * pi * OD * L + N * pi * (OD - 2*t) * L',
      variables: ['OD', 't', 'L', 'N'],
      unit: 'mm²',
      description: 'Total heat transfer surface area (both sides)',
    },

    customFormulas: [
      {
        name: 'totalTubeLength',
        label: 'Total Tube Length',
        formula: {
          expression: 'N * L',
          variables: ['N', 'L'],
          unit: 'mm',
          description: 'Total linear length of all tubes',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'ID',
        label: 'Tube Inner Diameter',
        formula: {
          expression: 'OD - 2*t',
          variables: ['OD', 't'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'flowArea',
        label: 'Total Flow Area',
        formula: {
          expression: 'N * pi * ((OD - 2*t)/2)^2',
          variables: ['OD', 't', 'N'],
          unit: 'mm²',
          description: 'Total tube-side flow area',
        },
        displayInResults: true,
        order: 3,
      },
      {
        name: 'heatTransferAreaSqm',
        label: 'Heat Transfer Area',
        formula: {
          expression: 'N * pi * OD * L / 1000000',
          variables: ['OD', 'L', 'N'],
          unit: 'm²',
          description: 'Shell-side heat transfer area in square meters',
        },
        displayInResults: true,
        order: 4,
      },
    ],
  },

  fabricationCost: {
    // Tube bundle assembly costs
    weldingCostPerMeter: 100, // Tube-to-tubesheet welding
  },

  tags: ['heat-exchanger', 'tube-bundle', 'tema', 'tubes'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 2. HX Tube Sheet
 * Heat exchanger tube sheet (tube-to-shell connection plate)
 */
export const hxTubeSheet: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'HX Tube Sheet',
  description:
    'Heat exchanger tube sheet for mounting tubes. Perforated circular plate with tube holes arranged in triangular or square pitch.',
  category: ShapeCategory.HX_TUBE_SHEET,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'TEMA',
    standardNumber: 'TEMA-TUBESHEET',
    title: 'Heat Exchanger Tube Sheet',
  },

  parameters: [
    {
      name: 'D',
      label: 'Tube Sheet Diameter',
      description: 'Outside diameter of the tube sheet',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 800,
      minValue: 200,
      maxValue: 3000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'solidArea'],
    },
    {
      name: 't',
      label: 'Tube Sheet Thickness',
      description: 'Thickness of the tube sheet',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 10,
      maxValue: 300,
      order: 2,
      required: true,
      helpText: 'Substantial thickness required for structural integrity',
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'tubeOD',
      label: 'Tube Hole Diameter',
      description: 'Diameter of tube holes (typically tube OD + 0.5-1mm clearance)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 26,
      minValue: 10,
      maxValue: 100,
      order: 3,
      required: true,
      usedInFormulas: ['holeArea', 'ligamentEfficiency'],
    },
    {
      name: 'N',
      label: 'Number of Tube Holes',
      description: 'Total number of holes drilled in tube sheet',
      unit: 'holes',
      dataType: 'NUMBER',
      defaultValue: 100,
      minValue: 1,
      maxValue: 10000,
      order: 4,
      required: true,
      usedInFormulas: ['holeArea', 'ligamentEfficiency', 'drillingCost'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
    MaterialCategory.PLATES_ALLOY_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    // Net weight (solid disc minus holes)
    volume: {
      expression: 'pi * (D/2)^2 * t - N * pi * (tubeOD/2)^2 * t',
      variables: ['D', 't', 'tubeOD', 'N'],
      unit: 'mm³',
      description: 'Net tube sheet volume (after drilling holes)',
    },

    weight: {
      expression: '(pi * (D/2)^2 * t - N * pi * (tubeOD/2)^2 * t) * density / 1000000',
      variables: ['D', 't', 'tubeOD', 'N'],
      unit: 'kg',
      description: 'Net tube sheet weight',
      requiresDensity: true,
    },

    surfaceArea: {
      expression: '2 * pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Total surface area (both faces)',
    },

    outerSurfaceArea: {
      expression: 'pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'One face area',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'D + 50',
        variables: ['D'],
        unit: 'mm',
        description: 'Blank diameter before machining',
      },
      blankThickness: 't',
      description: 'Circular plate blank',
    },

    customFormulas: [
      {
        name: 'solidArea',
        label: 'Solid Area',
        formula: {
          expression: 'pi * (D/2)^2',
          variables: ['D'],
          unit: 'mm²',
          description: 'Total area before drilling',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'holeArea',
        label: 'Total Hole Area',
        formula: {
          expression: 'N * pi * (tubeOD/2)^2',
          variables: ['N', 'tubeOD'],
          unit: 'mm²',
          description: 'Area removed by drilling',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'ligamentEfficiency',
        label: 'Ligament Efficiency',
        formula: {
          expression: '(1 - (N * pi * (tubeOD/2)^2) / (pi * (D/2)^2)) * 100',
          variables: ['D', 'tubeOD', 'N'],
          unit: '%',
          description: 'Percentage of solid material remaining',
        },
        displayInResults: true,
        order: 3,
      },
      {
        name: 'grossWeight',
        label: 'Gross Weight (before drilling)',
        formula: {
          expression: 'pi * (D/2)^2 * t * density / 1000000',
          variables: ['D', 't'],
          unit: 'kg',
          description: 'Initial blank weight',
        },
        displayInResults: true,
        order: 4,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 50,
    surfaceTreatmentCostPerSqm: 150,
    // Drilling cost per hole
  },

  tags: ['heat-exchanger', 'tubesheet', 'tema', 'perforated'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'ligamentEfficiency',
      rule: 'LIGAMENT_EFFICIENCY',
      errorMessage:
        'Ligament efficiency < 50% indicates heavily perforated tube sheet - verify structural adequacy',
      severity: 'warning',
    },
  ],
};

/**
 * 3. HX Baffle
 * Heat exchanger baffle plate for directing shell-side flow
 */
export const hxBaffle: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'HX Baffle',
  description:
    'Heat exchanger baffle plate for directing shell-side flow and supporting tubes. Segmental or disc-and-doughnut type with tube holes.',
  category: ShapeCategory.HX_BAFFLE,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'TEMA',
    standardNumber: 'TEMA-BAFFLE',
    title: 'Heat Exchanger Baffle Plate',
  },

  parameters: [
    {
      name: 'D',
      label: 'Baffle Diameter',
      description: 'Diameter of the baffle (shell ID minus clearance)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 750,
      minValue: 200,
      maxValue: 3000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'area', 'segmentArea'],
    },
    {
      name: 't',
      label: 'Baffle Thickness',
      description: 'Thickness of baffle plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 6,
      minValue: 3,
      maxValue: 25,
      order: 2,
      required: true,
      helpText: 'Typical: 5-10mm',
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'baffleCut',
      label: 'Baffle Cut (%)',
      description: 'Percentage of baffle diameter removed (segmental baffle)',
      unit: '%',
      dataType: 'NUMBER',
      defaultValue: 25,
      minValue: 15,
      maxValue: 45,
      order: 3,
      required: false,
      helpText: 'Typical: 20-35% for segmental baffles',
      usedInFormulas: ['area', 'segmentArea'],
    },
    {
      name: 'tubeOD',
      label: 'Tube Hole Diameter',
      description: 'Diameter of tube holes',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 26,
      minValue: 10,
      maxValue: 100,
      order: 4,
      required: true,
      usedInFormulas: ['holeArea'],
    },
    {
      name: 'N',
      label: 'Number of Tube Holes',
      description: 'Number of holes for tubes to pass through',
      unit: 'holes',
      dataType: 'NUMBER',
      defaultValue: 100,
      minValue: 1,
      maxValue: 10000,
      order: 5,
      required: true,
      usedInFormulas: ['holeArea', 'netWeight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    // Volume accounting for baffle cut and tube holes
    volume: {
      expression: 'pi * (D/2)^2 * t * (1 - baffleCut/100) - N * pi * (tubeOD/2)^2 * t',
      variables: ['D', 't', 'baffleCut', 'tubeOD', 'N'],
      unit: 'mm³',
      description: 'Net baffle volume (after cut and holes)',
    },

    weight: {
      expression:
        '(pi * (D/2)^2 * t * (1 - baffleCut/100) - N * pi * (tubeOD/2)^2 * t) * density / 1000000',
      variables: ['D', 't', 'baffleCut', 'tubeOD', 'N'],
      unit: 'kg',
      description: 'Net baffle weight',
      requiresDensity: true,
    },

    surfaceArea: {
      expression: '2 * pi * (D/2)^2 * (1 - baffleCut/100)',
      variables: ['D', 'baffleCut'],
      unit: 'mm²',
      description: 'Baffle surface area (both faces)',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'D + 20',
        variables: ['D'],
        unit: 'mm',
        description: 'Blank diameter before cutting',
      },
      blankThickness: 't',
      description: 'Circular plate blank',
    },

    customFormulas: [
      {
        name: 'area',
        label: 'Gross Area (before holes)',
        formula: {
          expression: 'pi * (D/2)^2 * (1 - baffleCut/100)',
          variables: ['D', 'baffleCut'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'segmentArea',
        label: 'Cut Segment Area',
        formula: {
          expression: 'pi * (D/2)^2 * (baffleCut/100)',
          variables: ['D', 'baffleCut'],
          unit: 'mm²',
          description: 'Area of removed segment',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'holeArea',
        label: 'Total Hole Area',
        formula: {
          expression: 'N * pi * (tubeOD/2)^2',
          variables: ['N', 'tubeOD'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 60,
    surfaceTreatmentCostPerSqm: 120,
  },

  tags: ['heat-exchanger', 'baffle', 'tema', 'segmental'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 4. HX Tube Support
 * Heat exchanger tube support plate
 */
export const hxTubeSupport: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'HX Tube Support',
  description:
    'Heat exchanger tube support plate for preventing tube vibration and sagging. Similar to baffle but with larger holes for less flow restriction.',
  category: ShapeCategory.HX_TUBE_SUPPORT,
  shapeType: 'PARAMETRIC',
  standard: {
    standardBody: 'TEMA',
    standardNumber: 'TEMA-TUBE-SUPPORT',
    title: 'Heat Exchanger Tube Support Plate',
  },

  parameters: [
    {
      name: 'D',
      label: 'Support Diameter',
      description: 'Diameter of the support plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 750,
      minValue: 200,
      maxValue: 3000,
      order: 1,
      required: true,
      usedInFormulas: ['volume', 'weight', 'area'],
    },
    {
      name: 't',
      label: 'Support Thickness',
      description: 'Thickness of support plate',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 8,
      minValue: 3,
      maxValue: 25,
      order: 2,
      required: true,
      usedInFormulas: ['volume', 'weight'],
    },
    {
      name: 'holeD',
      label: 'Support Hole Diameter',
      description: 'Diameter of support holes (larger than tube OD for clearance)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 30,
      minValue: 10,
      maxValue: 100,
      order: 3,
      required: true,
      helpText: 'Typically 3-5mm larger than tube OD',
      usedInFormulas: ['holeArea', 'openArea'],
    },
    {
      name: 'N',
      label: 'Number of Support Holes',
      description: 'Number of holes for tube support',
      unit: 'holes',
      dataType: 'NUMBER',
      defaultValue: 100,
      minValue: 1,
      maxValue: 10000,
      order: 4,
      required: true,
      usedInFormulas: ['holeArea', 'openArea', 'netWeight'],
    },
  ],

  allowedMaterialCategories: [
    MaterialCategory.PLATES_CARBON_STEEL,
    MaterialCategory.PLATES_STAINLESS_STEEL,
    MaterialCategory.PLATES_DUPLEX_STEEL,
  ],
  defaultMaterialCategory: MaterialCategory.PLATES_CARBON_STEEL,

  formulas: {
    volume: {
      expression: 'pi * (D/2)^2 * t - N * pi * (holeD/2)^2 * t',
      variables: ['D', 't', 'holeD', 'N'],
      unit: 'mm³',
      description: 'Net support volume (after drilling)',
    },

    weight: {
      expression: '(pi * (D/2)^2 * t - N * pi * (holeD/2)^2 * t) * density / 1000000',
      variables: ['D', 't', 'holeD', 'N'],
      unit: 'kg',
      description: 'Net support weight',
      requiresDensity: true,
    },

    surfaceArea: {
      expression: '2 * pi * (D/2)^2',
      variables: ['D'],
      unit: 'mm²',
      description: 'Total surface area',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'D + 20',
        variables: ['D'],
        unit: 'mm',
        description: 'Blank diameter',
      },
      blankThickness: 't',
      description: 'Circular plate blank',
    },

    customFormulas: [
      {
        name: 'area',
        label: 'Gross Area',
        formula: {
          expression: 'pi * (D/2)^2',
          variables: ['D'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'holeArea',
        label: 'Total Hole Area',
        formula: {
          expression: 'N * pi * (holeD/2)^2',
          variables: ['N', 'holeD'],
          unit: 'mm²',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'openArea',
        label: 'Open Area Percentage',
        formula: {
          expression: '(N * pi * (holeD/2)^2) / (pi * (D/2)^2) * 100',
          variables: ['D', 'holeD', 'N'],
          unit: '%',
          description: 'Percentage of open area for flow',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 50,
    surfaceTreatmentCostPerSqm: 120,
  },

  tags: ['heat-exchanger', 'support', 'tema', 'tube-support'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * Export all heat exchanger shapes
 */
export const heatExchangerShapes = [hxTubeBundle, hxTubeSheet, hxBaffle, hxTubeSupport];
