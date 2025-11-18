/**
 * Pressure Vessel Component Shape Definitions
 * Category 3: Pressure Vessel Components (7 shapes)
 * Compliant with ASME Section VIII Division 1
 */

import type { Shape } from '@vapour/types';
import { ShapeCategory, MaterialCategory } from '@vapour/types';

/**
 * 1. Cylindrical Shell
 * ASME UG-27 compliant cylindrical shell section
 */
export const cylindricalShell: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Cylindrical Shell',
  description:
    'ASME Section VIII Division 1 compliant cylindrical shell section (UG-27). For pressure vessels, tanks, and columns. Calculates material requirements for rolled and welded construction.',
  category: ShapeCategory.SHELL_CYLINDRICAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG27',
    title: 'Cylindrical Shells Under Internal Pressure',
    revision: '2021',
  },

  parameters: [
    {
      name: 'ID',
      label: 'Inside Diameter',
      description: 'Internal diameter of the shell',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      helpText: 'Shell inside diameter (100-10000 mm)',
      usedInFormulas: [
        'OD',
        'volume',
        'weight',
        'innerSurfaceArea',
        'outerSurfaceArea',
        'blankWidth',
      ],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Shell wall thickness (excluding corrosion allowance)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 200,
      order: 2,
      required: true,
      helpText: 'Nominal wall thickness (3-200 mm)',
      usedInFormulas: ['OD', 'volume', 'weight', 'outerSurfaceArea', 'blankWidth'],
    },
    {
      name: 'L',
      label: 'Tangent Length',
      description: 'Tangent-to-tangent length of the shell section',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 3000,
      minValue: 100,
      maxValue: 50000,
      order: 3,
      required: true,
      helpText: 'Shell length between head tangent lines (100-50000 mm)',
      usedInFormulas: [
        'volume',
        'weight',
        'innerSurfaceArea',
        'outerSurfaceArea',
        'blankLength',
        'weldLength',
      ],
    },
    {
      name: 'weldAllowance',
      label: 'Longitudinal Weld Allowance',
      description: 'Additional width for longitudinal weld seam',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 25,
      minValue: 10,
      maxValue: 100,
      order: 4,
      required: false,
      helpText: 'Material allowance for weld seam (typically 15-40 mm)',
      usedInFormulas: ['blankWidth', 'scrapPercentage'],
    },
    {
      name: 'lengthAllowance',
      label: 'Length Allowance',
      description: 'Additional length for end trimming',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 100,
      minValue: 0,
      maxValue: 500,
      order: 5,
      required: false,
      helpText: 'Extra length for squaring ends (typically 50-150 mm)',
      usedInFormulas: ['blankLength', 'scrapPercentage'],
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
    volume: {
      expression: 'pi * ((ID/2 + t)^2 - (ID/2)^2) * L',
      variables: ['ID', 't', 'L'],
      unit: 'mm³',
      description: 'Shell wall material volume',
    },

    weight: {
      expression: '(pi * ((ID/2 + t)^2 - (ID/2)^2) * L * density) / 1000000',
      variables: ['ID', 't', 'L'],
      unit: 'kg',
      description: 'Shell weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: 'pi * ID * L',
      variables: ['ID', 'L'],
      unit: 'mm²',
      description: 'Inner surface area',
    },

    outerSurfaceArea: {
      expression: 'pi * (ID + 2*t) * L',
      variables: ['ID', 't', 'L'],
      unit: 'mm²',
      description: 'Outer surface area',
    },

    weldLength: {
      expression: 'L',
      variables: ['L'],
      unit: 'mm',
      description: 'Longitudinal weld seam length',
    },

    blankDimensions: {
      blankType: 'RECTANGULAR',
      blankLength: {
        expression: 'L + lengthAllowance',
        variables: ['L', 'lengthAllowance'],
        unit: 'mm',
        description: 'Plate length for rolling',
      },
      blankWidth: {
        expression: 'pi * (ID + t) + weldAllowance',
        variables: ['ID', 't', 'weldAllowance'],
        unit: 'mm',
        description: 'Plate width (developed at mean diameter + weld allowance)',
      },
      blankThickness: 't',
      scrapFormula: {
        expression:
          '(((L + lengthAllowance) * (pi * (ID + t) + weldAllowance) * t) - (pi * ((ID/2 + t)^2 - (ID/2)^2) * L)) / (pi * ((ID/2 + t)^2 - (ID/2)^2) * L) * 100',
        variables: ['ID', 't', 'L', 'weldAllowance', 'lengthAllowance'],
        unit: '%',
        description: 'Material scrap percentage',
      },
      description: 'Plate blank for rolling with longitudinal weld',
    },

    customFormulas: [
      {
        name: 'OD',
        label: 'Outside Diameter',
        formula: {
          expression: 'ID + 2*t',
          variables: ['ID', 't'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'meanDiameter',
        label: 'Mean Diameter',
        formula: {
          expression: 'ID + t',
          variables: ['ID', 't'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: 'pi * (ID/2)^2 * L / 1000000',
          variables: ['ID', 'L'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    edgePreparationCostPerMeter: 80,
    cuttingCostPerMeter: 50,
    weldingCostPerMeter: 200,
    surfaceTreatmentCostPerSqm: 150,
  },

  tags: ['shell', 'cylinder', 'vessel', 'asme', 'pressure'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

/**
 * 2. Conical Shell
 * ASME UG-32 compliant conical shell section
 */
export const conicalShell: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Conical Shell',
  description:
    'ASME Section VIII Division 1 compliant conical shell/reducer section (UG-32). Used for transitions between different diameters.',
  category: ShapeCategory.SHELL_CONICAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG32',
    title: 'Conical Shells and Heads Under Internal Pressure',
    revision: '2021',
  },

  parameters: [
    {
      name: 'D1',
      label: 'Large End Diameter',
      description: 'Inside diameter at the large end',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1500,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      helpText: 'Larger diameter (100-10000 mm)',
      usedInFormulas: ['volume', 'weight', 'slantHeight', 'blankRadius'],
    },
    {
      name: 'D2',
      label: 'Small End Diameter',
      description: 'Inside diameter at the small end',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 50,
      maxValue: 9999,
      order: 2,
      required: true,
      helpText: 'Smaller diameter (must be less than large end)',
      usedInFormulas: ['volume', 'weight', 'slantHeight', 'blankRadius', 'coneAngle'],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Shell wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 12,
      minValue: 3,
      maxValue: 200,
      order: 3,
      required: true,
      helpText: 'Nominal wall thickness (3-200 mm)',
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea'],
    },
    {
      name: 'H',
      label: 'Axial Height',
      description: 'Vertical height of the conical section',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 500,
      minValue: 50,
      maxValue: 10000,
      order: 4,
      required: true,
      helpText: 'Height along the vertical axis (50-10000 mm)',
      usedInFormulas: ['volume', 'weight', 'slantHeight', 'coneAngle'],
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
    volume: {
      expression:
        '(pi/3) * H * ((D1/2 + t)^2 + (D1/2 + t)*(D2/2 + t) + (D2/2 + t)^2) - (pi/3) * H * ((D1/2)^2 + (D1/2)*(D2/2) + (D2/2)^2)',
      variables: ['D1', 'D2', 't', 'H'],
      unit: 'mm³',
      description: 'Conical shell material volume',
    },

    weight: {
      expression:
        '((pi/3) * H * ((D1/2 + t)^2 + (D1/2 + t)*(D2/2 + t) + (D2/2 + t)^2) - (pi/3) * H * ((D1/2)^2 + (D1/2)*(D2/2) + (D2/2)^2)) * density / 1000000',
      variables: ['D1', 'D2', 't', 'H'],
      unit: 'kg',
      description: 'Conical shell weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: 'pi * ((D1/2) + (D2/2)) * sqrt(H^2 + ((D1-D2)/2)^2)',
      variables: ['D1', 'D2', 'H'],
      unit: 'mm²',
      description: 'Inner surface area',
    },

    outerSurfaceArea: {
      expression: 'pi * ((D1/2 + t) + (D2/2 + t)) * sqrt(H^2 + ((D1-D2)/2)^2)',
      variables: ['D1', 'D2', 't', 'H'],
      unit: 'mm²',
      description: 'Outer surface area',
    },

    customFormulas: [
      {
        name: 'slantHeight',
        label: 'Slant Height',
        formula: {
          expression: 'sqrt(H^2 + ((D1-D2)/2)^2)',
          variables: ['D1', 'D2', 'H'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'coneAngle',
        label: 'Cone Half-Angle',
        formula: {
          expression: 'atan((D1-D2)/(2*H)) * 180 / pi',
          variables: ['D1', 'D2', 'H'],
          unit: 'degrees',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: '(pi/3) * H * ((D1/2)^2 + (D1/2)*(D2/2) + (D2/2)^2) / 1000000',
          variables: ['D1', 'D2', 'H'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    edgePreparationCostPerMeter: 100,
    cuttingCostPerMeter: 80,
    weldingCostPerMeter: 250,
    surfaceTreatmentCostPerSqm: 150,
  },

  tags: ['shell', 'cone', 'reducer', 'transition', 'asme'],
  isStandard: true,
  isActive: true,
  usageCount: 0,

  validationRules: [
    {
      field: 'D2',
      rule: 'D2_LESS_THAN_D1',
      errorMessage: 'Small end diameter must be less than large end diameter',
      severity: 'error',
    },
  ],
};

/**
 * 3. Hemispherical Head
 * ASME UG-32(f) compliant hemispherical head
 */
export const hemisphericalHead: Omit<
  Shape,
  'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
> = {
  name: 'Hemispherical Head',
  description:
    'ASME Section VIII Division 1 compliant hemispherical head (UG-32(f)). Most efficient head design for pressure vessels.',
  category: ShapeCategory.HEAD_HEMISPHERICAL,
  shapeType: 'STANDARD',
  standard: {
    standardBody: 'ASME',
    standardNumber: 'SEC-VIII-DIV1-UG32F',
    title: 'Hemispherical Heads',
    revision: '2021',
  },

  parameters: [
    {
      name: 'ID',
      label: 'Inside Diameter',
      description: 'Inside diameter of the head (same as shell ID)',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 1000,
      minValue: 100,
      maxValue: 10000,
      order: 1,
      required: true,
      helpText: 'Head inside diameter (100-10000 mm)',
      usedInFormulas: ['volume', 'weight', 'surfaceArea', 'blankDiameter'],
    },
    {
      name: 't',
      label: 'Wall Thickness',
      description: 'Head wall thickness',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 10,
      minValue: 3,
      maxValue: 200,
      order: 2,
      required: true,
      helpText: 'Nominal wall thickness (3-200 mm)',
      usedInFormulas: ['volume', 'weight', 'outerSurfaceArea', 'blankDiameter'],
    },
    {
      name: 'SF',
      label: 'Straight Flange',
      description: 'Straight flange length for welding to shell',
      unit: 'mm',
      dataType: 'NUMBER',
      defaultValue: 50,
      minValue: 25,
      maxValue: 300,
      order: 3,
      required: false,
      helpText: 'Cylindrical section at base (typically 25-100 mm)',
      usedInFormulas: ['height', 'weldCircumference'],
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
    volume: {
      expression: '(2/3) * pi * ((ID/2 + t)^3 - (ID/2)^3) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm³',
      description: 'Head material volume (hemisphere + straight flange)',
    },

    weight: {
      expression:
        '((2/3) * pi * ((ID/2 + t)^3 - (ID/2)^3) + pi * ((ID/2 + t)^2 - (ID/2)^2) * SF) * density / 1000000',
      variables: ['ID', 't', 'SF'],
      unit: 'kg',
      description: 'Head weight',
      requiresDensity: true,
    },

    innerSurfaceArea: {
      expression: '2 * pi * (ID/2)^2 + pi * ID * SF',
      variables: ['ID', 'SF'],
      unit: 'mm²',
      description: 'Inner surface area',
    },

    outerSurfaceArea: {
      expression: '2 * pi * (ID/2 + t)^2 + pi * (ID + 2*t) * SF',
      variables: ['ID', 't', 'SF'],
      unit: 'mm²',
      description: 'Outer surface area',
    },

    blankDimensions: {
      blankType: 'CIRCULAR',
      blankDiameter: {
        expression: 'ID + 2*t + 2*SF + 100',
        variables: ['ID', 't', 'SF'],
        unit: 'mm',
        description: 'Blank diameter for forming (includes forming allowance)',
      },
      blankThickness: 't',
      description: 'Circular blank for deep drawing/forming',
    },

    customFormulas: [
      {
        name: 'height',
        label: 'Overall Height',
        formula: {
          expression: 'ID/2 + SF',
          variables: ['ID', 'SF'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 1,
      },
      {
        name: 'internalVolume',
        label: 'Internal Volume',
        formula: {
          expression: '(2/3) * pi * (ID/2)^3 / 1000000 + pi * (ID/2)^2 * SF / 1000000',
          variables: ['ID', 'SF'],
          unit: 'liters',
        },
        displayInResults: true,
        order: 2,
      },
      {
        name: 'weldCircumference',
        label: 'Weld Circumference',
        formula: {
          expression: 'pi * (ID + 2*t)',
          variables: ['ID', 't'],
          unit: 'mm',
        },
        displayInResults: true,
        order: 3,
      },
    ],
  },

  fabricationCost: {
    cuttingCostPerMeter: 60,
    surfaceTreatmentCostPerSqm: 200,
    // Note: Forming cost would be calculated separately based on head size
  },

  tags: ['head', 'hemisphere', 'closure', 'asme', 'pressure'],
  isStandard: true,
  isActive: true,
  usageCount: 0,
};

// Due to size limits, I'll continue with the remaining 4 heads in a separate section
// For now, let's export what we have

export const pressureVesselShapes = [cylindricalShell, conicalShell, hemisphericalHead];
